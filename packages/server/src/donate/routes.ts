import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireUser, getUser } from '../auth/middleware.js';
import { getEntitlements } from '../plans/index.js';
import { getHub } from '../realtime/hub.js';
import { config } from '../config/index.js';
import { addDonation, listDonations, updateDonation, slipPath, isUsedRef, markRef, type Donation } from './store.js';

/**
 * โดเนทขึ้นจอ — คนดูโอนเข้าพร้อมเพย์ของวีเจโดยตรง (เงินไม่ผ่านเรา) แล้วแนบสลิป
 * - มี EASYSLIP_API_KEY → ตรวจสลิปอัตโนมัติ (ยอดจริง · เข้าบัญชีวีเจ · ไม่ซ้ำ) ผ่านแล้วขึ้นจอทันที
 * - ไม่มีคีย์ / ตรวจไม่ชัด → รอวีเจกดยืนยันในแดชบอร์ด
 */
interface DonateSettings { promptpay?: string; min?: number; title?: string }

const digits = (s: string) => String(s ?? '').replace(/\D/g, '');

async function ownerByHandle(handle: string) {
  const u = String(handle ?? '').replace(/^@/, '').trim();
  if (!/^[A-Za-z0-9._]{2,24}$/.test(u)) return null;
  const user = await prisma.user.findFirst({ where: { tiktokUsername: { equals: u, mode: 'insensitive' } }, select: { id: true, displayName: true, tiktokUsername: true } });
  if (!user?.tiktokUsername) return null;
  const ent = await getEntitlements(user.id);
  if (!ent.widgets.includes('donate')) return null; // สิทธิ์ Pro/ทดลอง
  const cfg = await prisma.widgetConfig.findUnique({ where: { userId_type: { userId: user.id, type: 'donate' } }, select: { settings: true } });
  const s = (cfg?.settings ?? {}) as DonateSettings;
  if (!s.promptpay || digits(s.promptpay).length < 10) return null;
  return { user, settings: { promptpay: digits(s.promptpay), min: Math.max(1, Number(s.min) || 10), title: s.title || '' } };
}

function announce(userId: string, tiktok: string, d: Donation) {
  getHub()?.emitOwner(userId, tiktok, 'donation', { id: d.id, name: d.name, message: d.message, amount: d.amount });
}

/** ตรวจสลิปกับ EasySlip — คืนผล หรือ null ถ้าเรียกไม่ได้ */
async function verifySlip(img: Buffer): Promise<{ ok: boolean; amount?: number; ref?: string; receiver?: string; reason?: string } | null> {
  if (!config.easyslipKey) return null;
  try {
    const form = new FormData();
    form.append('file', new Blob([img], { type: 'image/jpeg' }), 'slip.jpg');
    const r = await fetch('https://developer.easyslip.com/api/v1/verify', { method: 'POST', headers: { Authorization: `Bearer ${config.easyslipKey}` }, body: form, signal: AbortSignal.timeout(15_000) });
    const j = await r.json().catch(() => null) as { status?: number; message?: string; data?: { transRef?: string; amount?: { amount?: number }; receiver?: { account?: { proxy?: { account?: string }; bank?: { account?: string } } } } } | null;
    if (!j || j.status !== 200 || !j.data) return { ok: false, reason: j?.message === 'slip_not_found' ? 'ไม่พบสลิปนี้ในระบบธนาคาร' : 'อ่านสลิปไม่ได้ — ลองถ่าย/แคปให้ชัดขึ้น' };
    const acc = j.data.receiver?.account;
    return { ok: true, amount: Number(j.data.amount?.amount) || 0, ref: j.data.transRef, receiver: acc?.proxy?.account ?? acc?.bank?.account };
  } catch (err) {
    console.warn('[donate] easyslip failed', (err as Error).message);
    return null;
  }
}

/** เลขบัญชีปลายทางในสลิปมักถูกปิดบางหลัก (xxx-xxx-1234) → เทียบเฉพาะหลักที่เห็นจากท้าย */
function receiverMatches(masked: string | undefined, promptpay: string): boolean | null {
  if (!masked) return null;
  const vis = masked.replace(/[^0-9xX]/g, '');
  const tail = vis.split(/[xX]/).pop() ?? '';
  if (tail.length < 3) return null;
  return promptpay.endsWith(tail) || promptpay.replace(/^0/, '66').endsWith(tail);
}

const submitSchema = z.object({
  u: z.string().min(2).max(30),
  name: z.string().trim().min(1).max(40),
  message: z.string().trim().max(150).default(''),
  amount: z.number().positive().max(100_000),
  slip: z.string().regex(/^data:image\/(jpeg|png|webp);base64,/).max(4_000_000),
});

export async function donateRoutes(app: FastifyInstance): Promise<void> {
  // หน้าโดเนทสาธารณะ: ข้อมูลที่ต้องใช้สร้าง QR พร้อมเพย์
  app.get('/api/donate/page', async (req, reply) => {
    const o = await ownerByHandle((req.query as { u?: string }).u ?? '');
    if (!o) return reply.code(404).send({ error: 'ไม่พบหน้าโดเนทนี้ หรือวีเจยังไม่ได้เปิดรับโดเนท' });
    return { name: o.user.displayName || o.user.tiktokUsername, tiktok: o.user.tiktokUsername, promptpay: o.settings.promptpay, min: o.settings.min, title: o.settings.title, autoVerify: !!config.easyslipKey };
  });

  app.post('/api/donate/submit', { bodyLimit: 5_000_000, config: { rateLimit: { max: 8, timeWindow: '10 minutes' } } }, async (req, reply) => {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'ข้อมูลไม่ครบ — ใส่ชื่อ ยอดเงิน และแนบสลิป' });
    const { u, name, message, amount, slip } = parsed.data;
    const o = await ownerByHandle(u);
    if (!o) return reply.code(404).send({ error: 'ไม่พบหน้าโดเนทนี้' });
    if (amount < o.settings.min) return reply.code(400).send({ error: `โดเนทขั้นต่ำ ${o.settings.min} บาท` });
    const img = Buffer.from(slip.slice(slip.indexOf(',') + 1), 'base64');

    const v = await verifySlip(img);
    const base = { name, message, transRef: undefined as string | undefined };
    if (v && !v.ok) return reply.code(400).send({ error: v.reason ?? 'ตรวจสลิปไม่ผ่าน' });
    if (v?.ok) {
      if (v.ref && isUsedRef(v.ref)) return reply.code(400).send({ error: 'สลิปนี้ถูกใช้โดเนทไปแล้ว' });
      const match = receiverMatches(v.receiver, o.settings.promptpay);
      if (match === false) return reply.code(400).send({ error: 'สลิปนี้ไม่ได้โอนเข้าบัญชีของวีเจคนนี้' });
      if (v.ref) markRef(v.ref);
      const real = v.amount || amount;
      if (match === true && real >= o.settings.min) {
        const d = addDonation(o.user.id, { ...base, amount: real, status: 'verified', auto: true, transRef: v.ref }, img);
        announce(o.user.id, o.user.tiktokUsername!, d);
        return { ok: true, status: 'verified', amount: real };
      }
      const d = addDonation(o.user.id, { ...base, amount: real, status: 'pending', auto: false, transRef: v.ref, note: 'ตรวจบัญชีปลายทางไม่ได้ — รอวีเจยืนยัน' }, img);
      return { ok: true, status: d.status };
    }
    // ยังไม่มีระบบตรวจอัตโนมัติ → รอวีเจกดยืนยัน
    addDonation(o.user.id, { ...base, amount, status: 'pending', auto: false, note: v === null && config.easyslipKey ? 'ระบบตรวจสลิปขัดข้อง — รอวีเจยืนยัน' : undefined }, img);
    return { ok: true, status: 'pending' };
  });

  // ---- ของวีเจ ----
  app.get('/api/donations', { preHandler: requireUser }, async (req) => {
    const claims = getUser(req)!;
    const list = listDonations(claims.userId);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const ok = list.filter((d) => d.status === 'verified');
    return {
      donations: list.slice(0, 200),
      autoVerify: !!config.easyslipKey,
      totals: { today: ok.filter((d) => new Date(d.createdAt) >= today).reduce((a, d) => a + d.amount, 0), all: ok.reduce((a, d) => a + d.amount, 0), pending: list.filter((d) => d.status === 'pending').length },
    };
  });

  app.post('/api/donations/:id/:act', { preHandler: requireUser }, async (req, reply) => {
    const claims = getUser(req)!;
    const { id, act } = req.params as { id: string; act: string };
    if (act !== 'approve' && act !== 'reject' && act !== 'replay') return reply.code(400).send({ error: 'คำสั่งไม่ถูกต้อง' });
    const cur = listDonations(claims.userId).find((d) => d.id === id);
    if (!cur) return reply.code(404).send({ error: 'ไม่พบรายการ' });
    const user = await prisma.user.findUnique({ where: { id: claims.userId }, select: { tiktokUsername: true } });
    if (act === 'reject') return { donation: updateDonation(claims.userId, id, { status: 'rejected' }) };
    const d = act === 'approve' ? updateDonation(claims.userId, id, { status: 'verified' })! : cur;
    if (user?.tiktokUsername) announce(claims.userId, user.tiktokUsername, d); // ยืนยัน/เล่นซ้ำ → ขึ้นจอ
    return { donation: d };
  });

  app.get('/api/donations/:id/slip', { preHandler: requireUser }, async (req, reply) => {
    const claims = getUser(req)!;
    const { id } = req.params as { id: string };
    if (!listDonations(claims.userId).some((d) => d.id === id)) return reply.code(404).send({ error: 'ไม่พบสลิป' });
    const p = slipPath(id);
    if (!p) return reply.code(404).send({ error: 'ไม่พบสลิป' });
    return reply.type('image/jpeg').header('Cache-Control', 'private, max-age=3600').send(fs.createReadStream(p));
  });
}
