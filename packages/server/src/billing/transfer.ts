import type { FastifyInstance, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { requireUser, getUser } from '../auth/middleware.js';
import { config } from '../config/index.js';
import { PLAN_DEFS, trialEndOf } from '../plans/index.js';

/**
 * รับเงินแบบโอนตรง: ผู้ใช้โอนเข้าบัญชี/พร้อมเพย์ → อัปสลิป (+ ข้อความใน QR ของสลิปที่เบราว์เซอร์อ่านได้)
 * - เลขอ้างอิงรายการจาก QR = providerRef (unique) → สลิปเดียวใช้ซ้ำไม่ได้
 * - ตั้ง EASYSLIP_API_KEY → ตรวจยอด/บัญชีผู้รับ/วันที่อัตโนมัติ ผ่าน = เปิด Pro ทันที
 * - ไม่ตั้ง หรือตรวจไม่ผ่าน → รอแอดมินอนุมัติที่หน้า /dashboard/admin/
 */
const PROVIDER = 'transfer';
const MONTH_OPTIONS = [1, 3, 6, 12];
const DAY = 86_400_000;
const pro = () => PLAN_DEFS.find((p) => p.code === 'pro')!;

export const transferEnabled = () => !!(config.transfer.accountNo || config.transfer.promptpay);

export function isAdmin(req: FastifyRequest): boolean {
  const c = getUser(req);
  return !!c && (c.role === 'ADMIN' || config.adminEmails.includes(c.email.toLowerCase()));
}

/** อ่านเลขอ้างอิงรายการจากข้อความ QR ของสลิปธนาคารไทย (TLV: แท็ก 00 → ย่อย 01 = รหัสธนาคาร, 02 = เลขอ้างอิง) */
export function parseSlipQr(payload: string): { bank?: string; transRef?: string } {
  const tlv = (s: string): Record<string, string> => {
    const out: Record<string, string> = {};
    let i = 0;
    while (i + 4 <= s.length) {
      const tag = s.slice(i, i + 2), len = Number(s.slice(i + 2, i + 4));
      if (!Number.isFinite(len)) break;
      out[tag] = s.slice(i + 4, i + 4 + len);
      i += 4 + len;
    }
    return out;
  };
  try {
    const top = tlv(payload), inner = top['00'] ? tlv(top['00']) : {};
    return { bank: inner['01'], transRef: inner['02'] };
  } catch { return {}; }
}

interface SlipCheck { ok: boolean; amount?: number; reason?: string; raw?: unknown }

/** เลขบัญชีในสลิปมักถูกปิดบางหลักด้วย x → เทียบเฉพาะหลักที่เห็น (ชิดขวา) */
function accountMatch(masked: string, full: string): boolean {
  if (!masked || !full || masked.replace(/[xX]/g, '').length < 3) return false;
  const m = masked.slice(-full.length), f = full.slice(-m.length);
  return [...m].every((ch, k) => /[xX]/.test(ch) || ch === f[k]);
}

/** ตรวจสลิปกับ EasySlip: ยอด >= ที่ต้องจ่าย, บัญชีผู้รับตรง, วันที่ไม่เกิน 3 วัน */
async function verifySlip(qr: string, expectBaht: number): Promise<SlipCheck> {
  if (!config.easySlipKey) return { ok: false, reason: 'ยังไม่ได้ตั้งระบบตรวจสลิปอัตโนมัติ' };
  try {
    const res = await fetch(`https://developer.easyslip.com/api/v1/verify?payload=${encodeURIComponent(qr)}`, {
      headers: { Authorization: `Bearer ${config.easySlipKey}` }, signal: AbortSignal.timeout(10_000),
    });
    type Acc = { bank?: { account?: string }; proxy?: { account?: string } };
    const j = await res.json() as { status?: number; data?: { amount?: { amount?: number }; date?: string; receiver?: { account?: Acc } } };
    if (!res.ok || j.status !== 200 || !j.data) return { ok: false, reason: 'ระบบตรวจสลิปตรวจไม่ผ่าน', raw: j };
    const d = j.data, amount = Number(d.amount?.amount ?? 0);
    const digits = (s?: string) => (s ?? '').replace(/[^0-9xX]/g, '');
    const recv = [digits(d.receiver?.account?.bank?.account), digits(d.receiver?.account?.proxy?.account)];
    const toUs = recv.some((r) => accountMatch(r, config.transfer.accountNo) || accountMatch(r, config.transfer.promptpay));
    const fresh = !d.date || Date.now() - new Date(d.date).getTime() < 3 * DAY;
    if (!toUs) return { ok: false, amount, reason: 'บัญชีผู้รับในสลิปไม่ตรงกับบัญชีของเรา', raw: j };
    if (amount + 0.001 < expectBaht) return { ok: false, amount, reason: `ยอดในสลิป ${amount} บาท น้อยกว่าที่ต้องจ่าย ${expectBaht} บาท`, raw: j };
    if (!fresh) return { ok: false, amount, reason: 'สลิปเก่าเกิน 3 วัน', raw: j };
    return { ok: true, amount, raw: j };
  } catch (err) {
    return { ok: false, reason: 'ติดต่อระบบตรวจสลิปไม่ได้', raw: String(err) };
  }
}

/** เปิด/ต่ออายุ Pro: นับต่อจากวันหมดอายุเดิม หรือวันหมดช่วงทดลองฟรี (ไม่เสียวันฟรี) */
async function activatePro(userId: string, months: number): Promise<Date> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true, subscription: true } });
  const plan = await prisma.plan.findUnique({ where: { code: 'pro' } });
  if (!user || !plan) throw new Error('ไม่พบผู้ใช้หรือแพลน');
  const cur = user.subscription?.status === 'ACTIVE' ? user.subscription.currentPeriodEnd?.getTime() ?? 0 : 0;
  const base = Math.max(Date.now(), trialEndOf(user.createdAt).getTime(), cur);
  const end = new Date(base + months * 30 * DAY);
  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, planId: plan.id, status: 'ACTIVE', provider: PROVIDER, currentPeriodEnd: end, cancelAtPeriodEnd: true },
    update: { planId: plan.id, status: 'ACTIVE', provider: PROVIDER, providerSubId: null, currentPeriodEnd: end, cancelAtPeriodEnd: true },
  });
  return end;
}

type Row = { id: string; amountCents: number; status: string; createdAt: Date; rawPayload: Prisma.JsonValue };
const view = (p: Row) => {
  const r = (p.rawPayload ?? {}) as Record<string, unknown>;
  return { id: p.id, amount: p.amountCents / 100, status: p.status, createdAt: p.createdAt, months: r.months ?? 1, note: r.reason ?? null, auto: !!r.auto };
};

export async function transferRoutes(app: FastifyInstance): Promise<void> {
  // ข้อมูลบัญชีรับโอน + ราคาตามจำนวนเดือน
  app.get('/api/billing/transfer/info', async () => ({
    enabled: transferEnabled(), autoVerify: !!config.easySlipKey,
    bankName: config.transfer.bankName, accountName: config.transfer.accountName,
    accountNo: config.transfer.accountNo, promptpay: config.transfer.promptpay,
    options: MONTH_OPTIONS.map((m) => ({ months: m, amount: (pro().priceCents / 100) * m })),
  }));

  // อัปสลิป
  app.post('/api/billing/transfer', {
    preHandler: requireUser, bodyLimit: 4 * 1024 * 1024,
    config: { rateLimit: { max: 15, timeWindow: '1 hour' } },
  }, async (req, reply) => {
    if (!transferEnabled()) return reply.code(501).send({ error: 'ยังไม่เปิดรับโอน' });
    const claims = getUser(req)!;
    const b = (req.body ?? {}) as { months?: number; slip?: string; qr?: string };
    const months = MONTH_OPTIONS.includes(Number(b.months)) ? Number(b.months) : 1;
    if (typeof b.slip !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(b.slip) || b.slip.length > 3_500_000) {
      return reply.code(400).send({ error: 'แนบรูปสลิป (jpg/png) ขนาดไม่เกิน ~2.5MB' });
    }
    const qr = typeof b.qr === 'string' ? b.qr.slice(0, 500) : '';
    const ref = qr ? (parseSlipQr(qr).transRef || qr) : `noqr-${claims.userId}-${Date.now()}`;
    if (qr && await prisma.payment.findUnique({ where: { provider_providerRef: { provider: PROVIDER, providerRef: ref } } })) {
      return reply.code(409).send({ error: 'สลิปนี้ถูกใช้ไปแล้ว' });
    }
    const amount = (pro().priceCents / 100) * months;
    const check: SlipCheck = qr ? await verifySlip(qr, amount) : { ok: false, reason: 'อ่าน QR บนสลิปไม่ได้' };
    const payment = await prisma.payment.create({
      data: {
        userId: claims.userId, provider: PROVIDER, providerRef: ref, amountCents: amount * 100, currency: 'thb',
        status: check.ok ? 'PAID' : 'PENDING',
        rawPayload: { months, qr, slip: b.slip, auto: check.ok, reason: check.reason ?? null, slipAmount: check.amount ?? null, verify: (check.raw ?? null) as Prisma.InputJsonValue },
      },
    });
    if (check.ok) {
      const end = await activatePro(claims.userId, months);
      return { status: 'PAID', until: end, message: `ตรวจสลิปผ่าน เปิด Pro ถึง ${end.toLocaleDateString('th-TH', { dateStyle: 'long' })} แล้ว 🎉` };
    }
    return {
      status: 'PENDING', id: payment.id,
      message: config.easySlipKey && check.reason ? `${check.reason} — ส่งให้แอดมินตรวจแล้ว` : 'ได้รับสลิปแล้ว รอแอดมินตรวจสอบ',
    };
  });

  // รายการโอนของฉัน (ไม่ส่งรูปสลิปกลับ)
  app.get('/api/billing/transfer/mine', { preHandler: requireUser }, async (req) => {
    const rows = await prisma.payment.findMany({ where: { userId: getUser(req)!.userId, provider: PROVIDER }, orderBy: { createdAt: 'desc' }, take: 20 });
    return { transfers: rows.map(view) };
  });

  // ---- แอดมิน: ตรวจ/อนุมัติสลิป ----
  app.get('/api/admin/transfers', { preHandler: requireUser }, async (req, reply) => {
    if (!isAdmin(req)) return reply.code(403).send({ error: 'สำหรับแอดมินเท่านั้น' });
    const all = (req.query as { status?: string }).status === 'all';
    const rows = await prisma.payment.findMany({
      where: { provider: PROVIDER, ...(all ? {} : { status: 'PENDING' as const }) },
      orderBy: { createdAt: 'desc' }, take: 50,
      include: { user: { select: { email: true, tiktokUsername: true } } },
    });
    return {
      transfers: rows.map((p) => {
        const r = (p.rawPayload ?? {}) as Record<string, unknown>;
        return { ...view(p), email: p.user.email, tiktok: p.user.tiktokUsername, slip: r.slip ?? null, slipAmount: r.slipAmount ?? null, ref: p.providerRef };
      }),
    };
  });

  app.post('/api/admin/transfers/:id/:action', { preHandler: requireUser }, async (req, reply) => {
    if (!isAdmin(req)) return reply.code(403).send({ error: 'สำหรับแอดมินเท่านั้น' });
    const { id, action } = req.params as { id: string; action: string };
    const p = await prisma.payment.findUnique({ where: { id } });
    if (!p || p.provider !== PROVIDER) return reply.code(404).send({ error: 'ไม่พบรายการ' });
    if (p.status !== 'PENDING') return reply.code(409).send({ error: 'รายการนี้ตรวจไปแล้ว' });
    const r = (p.rawPayload ?? {}) as Record<string, unknown>;
    if (action === 'approve') {
      await prisma.payment.update({ where: { id }, data: { status: 'PAID' } });
      const end = await activatePro(p.userId, Number(r.months) || 1);
      return { ok: true, until: end };
    }
    if (action === 'reject') {
      await prisma.payment.update({ where: { id }, data: { status: 'FAILED' } });
      return { ok: true };
    }
    return reply.code(400).send({ error: 'action ไม่ถูกต้อง' });
  });
}
