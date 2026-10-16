import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireUser, getUser } from '../auth/middleware.js';
import { isAdmin } from '../admin/routes.js';
import { audit } from '../admin/store.js';
import { config } from '../config/index.js';
import { getPlans, getPlan, trialEndOf, getEntitlements } from '../plans/index.js';
import { settings as sys } from '../settings/index.js';
import { supportNotice } from '../support/routes.js';
import { verifySlipV2, easyslipKey } from '../donate/easyslip.js';
import { sendMail, mailEnabled } from '../mail/send.js';

/**
 * ชำระค่าแพลนด้วยการโอน + แนบสลิป (ใช้ตอนยังไม่เปิดระบบตัดบัตร Stripe)
 * - แอดมินตั้งบัญชีรับเงิน (พร้อมเพย์ / บัญชีธนาคาร) ที่ data/payaccount.json
 * - วีเจโอนตามยอดแพลน แล้วแนบสลิป → ตรวจด้วย EasySlip/SlipOK (ตัวเดียวกับโดเนท)
 *   ผ่าน (ยอดครบ · เข้าบัญชีเรา · ไม่ซ้ำ) = เปิดแพลน 30 วันทันที · ตรวจไม่ได้ = รอแอดมินกดยืนยัน
 * - เงินห้ามหาย: บันทึกรูปสลิป + log (data/payslips) ก่อนเสมอ แล้วค่อยลงตาราง Payment (provider 'slip')
 */
const DATA = process.env.SNAPSHOT_DIR ? path.dirname(process.env.SNAPSHOT_DIR) : path.resolve(process.cwd(), '../../data');
const ACC_FILE = path.join(DATA, 'payaccount.json');
const SLIPS = path.join(DATA, 'payslips');
const LOG = path.join(SLIPS, 'log.jsonl');
const DAYS = 30;
const DAY = 86_400_000;
const PROVIDER = 'slip';

interface PayAccount { promptpay: string; bank: string; bankAccount: string; bankHolder: string }
const EMPTY: PayAccount = { promptpay: '', bank: '', bankAccount: '', bankHolder: '' };
let acc: PayAccount | null = null;
function readAcc(): PayAccount {
  if (acc) return acc;
  try { acc = { ...EMPTY, ...(JSON.parse(fs.readFileSync(ACC_FILE, 'utf8')) as Partial<PayAccount>) }; } catch { acc = { ...EMPTY }; }
  return acc;
}
const digits = (s: string) => String(s ?? '').replace(/\D/g, '');
/** บัญชีที่ใช้รับเงินได้จริง (พร้อมเพย์ ≥10 หลัก · บัญชีธนาคารต้องมีรหัสธนาคาร + ≥10 หลัก) */
function receiving() {
  const a = readAcc();
  const pp = digits(a.promptpay).length >= 10 ? digits(a.promptpay) : '';
  const bank = a.bank && digits(a.bankAccount).length >= 10 ? { code: a.bank, account: digits(a.bankAccount), holder: a.bankHolder } : null;
  return { promptpay: pp, bank, enabled: !!(pp || bank) };
}

/** เลขบัญชีปลายทางในสลิปมักถูกปิดบางหลัก (xxx-xxx-1234) → เทียบเฉพาะหลักที่เห็นจากท้าย (แบบเดียวกับโดเนท) */
function receiverMatches(masked: string | undefined, target: string): boolean | null {
  if (!masked) return null;
  const vis = masked.replace(/[^0-9xX]/g, '');
  const tail = vis.split(/[xX]/).pop() ?? '';
  if (tail.length < 3) return null;
  return target.endsWith(tail) || target.replace(/^0/, '66').endsWith(tail);
}

/** ตรวจไฟล์รูปจริงจาก magic bytes (ไม่เชื่อ content-type ที่ส่งมา) */
function imageKind(buf: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 4).toString('hex') === '89504e47') return 'png';
  if (buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;

/** เก็บรูปสลิป + บรรทัด log ลงดิสก์ (ทำก่อนทุกอย่าง — DB ล่มก็ยังตามเงินได้) */
function saveSlip(id: string, img: Buffer, kind: keyof typeof MIME): void {
  fs.mkdirSync(SLIPS, { recursive: true });
  fs.writeFileSync(path.join(SLIPS, `${id}.${kind}`), img);
}
function logLine(entry: Record<string, unknown>): void {
  try { fs.mkdirSync(SLIPS, { recursive: true }); fs.appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n'); }
  catch (err) { console.error('[payslip] log failed', err); }
}
function slipFile(id: string): { file: string; mime: string } | null {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, '');
  for (const k of ['jpg', 'png', 'webp'] as const) {
    const f = path.join(SLIPS, `${safe}.${k}`);
    if (fs.existsSync(f)) return { file: f, mime: MIME[k] };
  }
  return null;
}

/** เปิด/ต่ออายุแพลนจากการโอน — นับต่อจากวันหมดเดิม/วันหมดทดลอง (ไม่เสียวันที่เหลือ) · ไม่ตัดเงินซ้ำ (cancelAtPeriodEnd) */
async function activate(userId: string, planCode: string, days = DAYS): Promise<Date | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true, tiktokUsername: true, subscription: true } });
  const plan = await prisma.plan.findUnique({ where: { code: planCode } });
  if (!user || !plan) return null;
  const sub = user.subscription;
  const cur = sub?.status === 'ACTIVE' ? sub.currentPeriodEnd?.getTime() ?? 0 : 0;
  const end = new Date(Math.max(Date.now(), trialEndOf(user.createdAt, user.tiktokUsername).getTime(), cur) + days * DAY);
  const data = { planId: plan.id, status: 'ACTIVE' as const, provider: PROVIDER, providerSubId: null, currentPeriodEnd: end, cancelAtPeriodEnd: true };
  await prisma.subscription.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  return end;
}

/** แจ้งแอดมินทางอีเมลเมื่อมีสลิปรอตรวจ (ถ้าตั้งเมลเซิร์ฟเวอร์ไว้) — ไม่ให้ error กระทบการส่งสลิป */
function notifyAdmins(email: string, planName: string, baht: number, note: string): void {
  if (!mailEnabled() || !config.adminEmails.length) return;
  const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]!));
  const html = `<p>มีสลิปค่าแพลนรอตรวจ</p><p>ลูกค้า: ${esc(email)}<br>แพลน: ${esc(planName)} · ฿${baht.toLocaleString('th-TH')}<br>${esc(note)}</p><p><a href="${config.publicBaseUrl}/dashboard/admin/">เปิดหลังบ้าน → การชำระเงิน</a></p>`;
  for (const to of config.adminEmails) void sendMail(to, `🧾 สลิปรอตรวจ ${planName} ฿${baht}`, html).catch(() => {});
}

async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  await requireUser(req, reply);
  if (reply.sent) return;
  if (!isAdmin(req)) await reply.code(403).send({ error: 'สำหรับแอดมินเท่านั้น' });
}

interface SlipRaw { product?: 'mascot'; kind: 'slip'; slipId: string; planCode: string; planName: string; priceCents: number; slipAmount?: number; ref?: string; auto: boolean; note?: string; periodEnd?: string }

const submitSchema = z.object({
  planCode: z.string().min(2).max(20),
  slip: z.string().regex(/^data:image\/(jpeg|png|webp);base64,/).max(5_600_000), // ~4MB หลังถอด base64
  manual: z.boolean().optional(), // ระบบอ่านสลิปไม่ได้ → ผู้ใช้ขอให้แอดมินตรวจเอง
  // สั่งทำมาสคอต (planCode = 'mascot'): รูปหน้า 1–3 รูป + สไตล์ที่อยากได้
  photos: z.array(z.string().regex(/^data:image\/(jpeg|png|webp);base64,/).max(3_000_000)).max(3).optional(),
  note: z.string().trim().max(500).optional(),
});
/** สั่งทำมาสคอต: ราคา (สตางค์) หลังหักส่วนลดตามแพลน — ราคาจากเซิร์ฟเวอร์เท่านั้น */
async function mascotPriceCents(userId: string): Promise<number> {
  const ent = await getEntitlements(userId);
  return Math.round(sys().mascotPrice * (1 - Math.max(0, Math.min(100, ent.mascotDiscountPct ?? 0)) / 100)) * 100; // ปัดเป็นบาทเต็ม (ไม่มีสตางค์ — QR/สลิปตรงยอดง่าย)
}
/** สั่งทำมาสคอต: ส่งรายละเอียด + รูปเข้าแชทลูกค้า (แอดมินเห็นในแชทลูกค้า) */
async function mascotOrderNotice(userId: string, status: string, baht: number, note?: string, photos: string[] = []): Promise<void> {
  await supportNotice(userId, `🧸 สั่งทำมาสคอตหน้าตัวเอง — ${status} ฿${baht}
🎨 สไตล์ที่อยากได้: ${note || '(ไม่ได้ระบุ)'}
📷 รูปหน้า ${photos.length} รูป (ด้านล่าง)`, photos).catch(() => {});
}
const accSchema = z.object({
  promptpay: z.string().trim().max(20).default('').refine((s) => !s || [10, 13, 15].includes(digits(s).length), 'พร้อมเพย์ต้องเป็นเบอร์ 10 หลัก / เลขบัตร 13 หลัก / e-Wallet 15 หลัก'),
  bank: z.string().trim().max(12).regex(/^[a-z]*$/).default(''),
  bankAccount: z.string().trim().max(24).default('').refine((s) => !s || (digits(s).length >= 10 && digits(s).length <= 15), 'เลขบัญชีต้องมี 10–15 หลัก'),
  bankHolder: z.string().trim().max(80).default(''),
});

export async function slipBillingRoutes(app: FastifyInstance): Promise<void> {
  // ---- ของวีเจ ----
  // บัญชีรับเงินของเรา (ไว้สร้าง QR พร้อมเพย์ / แสดงเลขบัญชี) — เป็นบัญชีรับเงินธุรกิจ แสดงให้ลูกค้าเห็นอยู่แล้ว
  app.get('/api/billing/slip/info', { preHandler: requireUser }, async (req) => {
    const r = receiving();
    return { enabled: r.enabled, promptpay: r.promptpay, bank: r.bank, autoVerify: !!easyslipKey(), days: DAYS, mascotPriceCents: await mascotPriceCents(getUser(req)!.userId), mascotFullCents: sys().mascotPrice * 100 };
  });

  app.post('/api/billing/slip', { preHandler: requireUser, bodyLimit: 16_000_000, config: { rateLimit: { max: 6, timeWindow: '10 minutes' } } }, async (req, reply) => {
    const { userId, email } = getUser(req)!;
    const p = submitSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: 'แนบรูปสลิป (JPG/PNG) ขนาดไม่เกิน 4MB' });
    const rcv = receiving();
    if (!rcv.enabled) return reply.code(400).send({ error: 'ยังไม่เปิดรับชำระด้วยการโอน — ทักแชททีมงานได้เลย' });
    // ราคาจากเซิร์ฟเวอร์เท่านั้น (ไม่เชื่อยอดจากหน้าเว็บ)
    const isMascot = p.data.planCode === 'mascot';
    const plan = isMascot
      ? { code: 'mascot', name: 'มาสคอตหน้าตัวเอง', priceCents: await mascotPriceCents(userId), currency: 'thb' }
      : getPlans().find((x) => x.code === p.data.planCode && x.priceCents > 0);
    if (!plan) return reply.code(400).send({ error: 'ไม่พบแพลนนี้' });
    if (isMascot && !p.data.photos?.length) return reply.code(400).send({ error: 'แนบรูปหน้าตัวเองอย่างน้อย 1 รูป' });
    const sub = isMascot ? null : await prisma.subscription.findUnique({ where: { userId } });
    if (sub?.provider === 'stripe' && ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(sub.status)) return reply.code(409).send({ error: 'คุณตัดบัตรอัตโนมัติอยู่แล้ว — เปลี่ยนแพลนผ่านแชททีมงาน' });
    const waiting = await prisma.payment.count({ where: { userId, provider: PROVIDER, status: 'PENDING' } });
    if (waiting >= 3) return reply.code(429).send({ error: 'มีสลิปรอตรวจอยู่หลายรายการแล้ว — รอแอดมินตรวจสักครู่นะ' });

    const img = Buffer.from(p.data.slip.slice(p.data.slip.indexOf(',') + 1), 'base64');
    const kind = imageKind(img);
    if (!kind || img.length > 4_200_000) return reply.code(400).send({ error: 'ไฟล์สลิปต้องเป็นรูป JPG/PNG/WEBP ไม่เกิน 4MB' });

    const id = 'ps_' + crypto.randomBytes(9).toString('base64url').replace(/[^a-zA-Z0-9]/g, 'x');
    saveSlip(id, img, kind); // บันทึกรูปก่อนเสมอ
    const baht = plan.priceCents / 100;
    const base: SlipRaw = { ...(isMascot ? { product: 'mascot' as const } : {}), kind: 'slip', slipId: id, planCode: plan.code, planName: plan.name, priceCents: plan.priceCents, auto: false };

    const v = p.data.manual ? null : await verifySlipV2(img);
    logLine({ id, userId, plan: plan.code, price: baht, verify: v ?? (p.data.manual ? 'manual' : 'unavailable') });

    const record = async (status: 'PAID' | 'PENDING', raw: SlipRaw, ref?: string) => {
      const row = await prisma.payment.create({ data: { userId, provider: PROVIDER, providerRef: ref ?? id, amountCents: Math.round((raw.slipAmount ?? baht) * 100), currency: plan.currency, status, rawPayload: raw as unknown as Prisma.InputJsonValue } });
      if (status === 'PENDING') notifyAdmins(email, plan.name, raw.slipAmount ?? baht, raw.note ?? '');
      return row;
    };
    const pending = async (note: string, extra: Partial<SlipRaw> = {}, ref?: string) => {
      await record('PENDING', { ...base, ...extra, note }, ref);
      if (isMascot) await mascotOrderNotice(userId, 'ส่งสลิปแล้ว รอตรวจ', baht, p.data.note, p.data.photos);
      return { ok: true, status: 'pending' as const };
    };

    if (!v) return pending(p.data.manual ? 'ผู้ใช้ขอให้แอดมินตรวจเอง (ระบบอ่านสลิปไม่ได้)' : easyslipKey() ? 'ระบบตรวจสลิปขัดข้อง — รอแอดมินตรวจ' : 'ยังไม่ได้เปิดตรวจสลิปอัตโนมัติ — รอแอดมินตรวจ');
    if (v.pending) return pending(v.reason ?? 'ธนาคารยังไม่ส่งข้อมูลสลิป — รอแอดมินตรวจ');
    if (!v.ok) {
      if (v.duplicate) { logLine({ id, rejected: 'duplicate' }); return reply.code(400).send({ error: 'สลิปนี้ถูกใช้ไปแล้ว' }); }
      // อ่าน QR ไม่ได้ ฯลฯ → ให้ลองใหม่ หรือกดส่งให้แอดมินตรวจเอง (เงินไม่หาย)
      return reply.code(400).send({ error: v.reason ?? 'ตรวจสลิปไม่ผ่าน', canManual: true });
    }
    // สลิปเดิมห้ามใช้ซ้ำ (เลขอ้างอิงธุรกรรม = providerRef ที่ unique)
    if (v.ref && await prisma.payment.findUnique({ where: { provider_providerRef: { provider: PROVIDER, providerRef: v.ref } } })) {
      logLine({ id, rejected: 'used-ref', ref: v.ref });
      return reply.code(400).send({ error: 'สลิปนี้ถูกใช้ชำระไปแล้ว' });
    }
    const checks = [rcv.promptpay, rcv.bank?.account].filter((x): x is string => !!x).flatMap((d) => (v.receivers?.length ? v.receivers : [undefined]).map((rc) => receiverMatches(rc, d)));
    const match = checks.includes(true) ? true : checks.length && checks.every((c) => c === false) ? false : null;
    const got = v.amount ?? 0;
    const extra: Partial<SlipRaw> = { slipAmount: got || undefined, ref: v.ref };
    if (match === false) { logLine({ id, rejected: 'receiver', ref: v.ref, receivers: v.receivers }); return reply.code(400).send({ error: 'สลิปนี้ไม่ได้โอนเข้าบัญชีของ VJLiveKit — เช็กบัญชีปลายทางอีกครั้ง' }); }
    if (match === null) return pending('ตรวจบัญชีปลายทางในสลิปไม่ได้ — รอแอดมินตรวจ', extra, v.ref);
    if (got * 100 < plan.priceCents) return pending(`ยอดในสลิป ฿${got} น้อยกว่าราคาแพลน ฿${baht} — รอแอดมินตรวจ`, extra, v.ref);

    // ผ่านครบ → บันทึกก่อน (เลขอ้างอิง unique = กันส่งสลิปเดียวกันพร้อมกัน) แล้วเปิดแพลนทันที
    let row;
    try { row = await record('PAID', { ...base, ...extra, auto: true }, v.ref); }
    catch { return reply.code(400).send({ error: 'สลิปนี้ถูกใช้ชำระไปแล้ว' }); }
    if (isMascot) { // จ่ายผ่าน → ส่งงานเข้าแชท (ไม่มีแพลนให้เปิด)
      await mascotOrderNotice(userId, '✅ จ่ายแล้ว (ตรวจสลิปผ่าน)', got || baht, p.data.note, p.data.photos);
      return { ok: true, status: 'paid' as const, plan: plan.name };
    }
    try {
      const end = await activate(userId, plan.code);
      await prisma.payment.update({ where: { id: row.id }, data: { rawPayload: { ...base, ...extra, auto: true, periodEnd: end?.toISOString() } as unknown as Prisma.InputJsonValue } });
      return { ok: true, status: 'paid' as const, plan: plan.name, periodEnd: end?.toISOString() };
    } catch (err) {
      // เปิดแพลนไม่สำเร็จ → คืนเป็นรอแอดมิน (เงินไม่หาย)
      req.log.error(err);
      await prisma.payment.update({ where: { id: row.id }, data: { status: 'PENDING', rawPayload: { ...base, ...extra, note: 'ตรวจสลิปผ่าน แต่เปิดแพลนอัตโนมัติไม่สำเร็จ — แอดมินกดอนุมัติ' } as unknown as Prisma.InputJsonValue } }).catch(() => {});
      return { ok: true, status: 'pending' as const };
    }
  });

  // ---- แอดมิน ----
  app.get('/api/admin/payaccount', { preHandler: requireAdmin }, async () => ({ account: readAcc(), enabled: receiving().enabled, autoVerify: !!easyslipKey() }));
  app.put('/api/admin/payaccount', { preHandler: requireAdmin }, async (req, reply) => {
    const p = accSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' });
    const next: PayAccount = { promptpay: digits(p.data.promptpay), bank: p.data.bank, bankAccount: digits(p.data.bankAccount), bankHolder: p.data.bankHolder };
    fs.mkdirSync(path.dirname(ACC_FILE), { recursive: true });
    fs.writeFileSync(ACC_FILE, JSON.stringify(next), { mode: 0o600 });
    acc = next;
    audit(getUser(req)!.email, 'ตั้งบัญชีรับเงิน (โอน+สลิป)', undefined, `พร้อมเพย์ ${next.promptpay ? 'ลงท้าย ' + next.promptpay.slice(-4) : '-'} · ${next.bank || '-'} ${next.bankAccount ? 'ลงท้าย ' + next.bankAccount.slice(-4) : ''}`);
    return { account: next, enabled: receiving().enabled, autoVerify: !!easyslipKey() };
  });

  // สลิปค่าแพลน (ค่าเริ่มต้น = รอตรวจ)
  app.get('/api/admin/payslips', { preHandler: requireAdmin }, async (req) => {
    const st = String((req.query as { status?: string }).status ?? 'PENDING').toUpperCase();
    const where: Prisma.PaymentWhereInput = { provider: PROVIDER, ...(['PENDING', 'PAID', 'FAILED'].includes(st) ? { status: st as 'PENDING' | 'PAID' | 'FAILED' } : {}) };
    const rows = await prisma.payment.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200,
      select: { id: true, providerRef: true, amountCents: true, status: true, createdAt: true, rawPayload: true, user: { select: { id: true, email: true, tiktokUsername: true } } } });
    return { slips: rows, pending: await prisma.payment.count({ where: { provider: PROVIDER, status: 'PENDING' } }) };
  });
  app.get('/api/admin/payslips/:id/image', { preHandler: requireAdmin }, async (req, reply) => {
    const row = await prisma.payment.findUnique({ where: { id: (req.params as { id: string }).id }, select: { provider: true, rawPayload: true } });
    const slipId = (row?.rawPayload as SlipRaw | null)?.slipId;
    const f = row?.provider === PROVIDER && slipId ? slipFile(slipId) : null;
    if (!f) return reply.code(404).send({ error: 'ไม่พบสลิป' });
    return reply.type(f.mime).header('Cache-Control', 'private, max-age=3600').send(fs.createReadStream(f.file));
  });
  app.post('/api/admin/payslips/:id/:act', { preHandler: requireAdmin }, async (req, reply) => {
    const { id, act } = req.params as { id: string; act: string };
    if (act !== 'approve' && act !== 'reject') return reply.code(400).send({ error: 'คำสั่งไม่ถูกต้อง' });
    const row = await prisma.payment.findUnique({ where: { id } });
    if (!row || row.provider !== PROVIDER) return reply.code(404).send({ error: 'ไม่พบรายการ' });
    if (row.status !== 'PENDING') return reply.code(409).send({ error: 'รายการนี้ตรวจไปแล้ว' });
    const raw = (row.rawPayload ?? {}) as unknown as SlipRaw;
    const admin = getUser(req)!.email;
    if (act === 'reject') {
      await prisma.payment.update({ where: { id }, data: { status: 'FAILED', rawPayload: { ...raw, note: 'แอดมินปฏิเสธสลิปนี้' } as unknown as Prisma.InputJsonValue } });
      audit(admin, 'ปฏิเสธสลิปค่าแพลน', row.userId, `${raw.planName ?? ''} ฿${row.amountCents / 100}`);
      return { ok: true };
    }
    if (raw.product === 'mascot') { // สั่งทำมาสคอต: อนุมัติ = รับงาน (ไม่เปิดแพลน)
      const lk = await prisma.payment.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'PAID' } });
      if (!lk.count) return reply.code(409).send({ error: 'รายการนี้ตรวจไปแล้ว' });
      await supportNotice(row.userId, `✅ แอดมินยืนยันสลิปค่ามาสคอตแล้ว ฿${row.amountCents / 100} — เริ่มทำมาสคอตให้เลย`).catch(() => {});
      audit(admin, 'อนุมัติสลิปค่ามาสคอต', row.userId, `฿${row.amountCents / 100}`);
      return { ok: true };
    }
    const planCode = getPlan(raw.planCode ?? '') ? raw.planCode : 'pro';
    // กันกดซ้ำพร้อมกัน: เปลี่ยนสถานะแบบมีเงื่อนไขก่อน แล้วค่อยเปิดแพลน
    const lock = await prisma.payment.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'PAID' } });
    if (!lock.count) return reply.code(409).send({ error: 'รายการนี้ตรวจไปแล้ว' });
    const end = await activate(row.userId, planCode);
    await prisma.payment.update({ where: { id }, data: { rawPayload: { ...raw, note: undefined, periodEnd: end?.toISOString() } as unknown as Prisma.InputJsonValue } });
    audit(admin, 'อนุมัติสลิปค่าแพลน', row.userId, `${raw.planName ?? planCode} ฿${row.amountCents / 100} → ถึง ${end?.toISOString().slice(0, 10) ?? '-'}`);
    return { ok: true, periodEnd: end?.toISOString() };
  });
}
