import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { requireUser } from '../auth/middleware.js';
import { isAdmin } from '../admin/routes.js';
import { config } from '../config/index.js';

/**
 * EasySlip API v2 (ตรวจสลิปโดเนทอัตโนมัติ) — https://document.easyslip.com/th/v2/
 * คีย์ตั้งได้จากหลังบ้าน (data/easyslip.json) หรือ env EASYSLIP_API_KEY · ไม่มีคีย์ = วีเจกดยืนยันเอง
 */
const FILE = path.join(process.env.SNAPSHOT_DIR ? path.dirname(process.env.SNAPSHOT_DIR) : path.resolve(process.cwd(), '../../data'), 'easyslip.json');
const API = 'https://api.easyslip.com/v2';
let cache: { key: string } | null = null;
function read(): { key: string } {
  if (cache) return cache;
  try { cache = { key: String(JSON.parse(fs.readFileSync(FILE, 'utf8')).key ?? '') }; } catch { cache = { key: '' }; }
  return cache;
}
export const easyslipKey = (): string => read().key || config.easyslipKey || '';

export interface SlipResult { ok: boolean; amount?: number; ref?: string; receivers?: string[]; duplicate?: boolean; pending?: boolean; reason?: string }

/** ตรวจสลิป (รูป) — คืน null ถ้าไม่มีคีย์/เรียก API ไม่ได้ (ให้วีเจกดยืนยันเอง) */
export async function verifySlipV2(img: Buffer): Promise<SlipResult | null> {
  const key = easyslipKey();
  if (!key) return null;
  try {
    const r = await fetch(`${API}/verify/bank`, {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64: img.toString('base64'), checkDuplicate: true }), signal: AbortSignal.timeout(15_000),
    });
    const j = await r.json().catch(() => null) as {
      success?: boolean; error?: { code?: string; message?: string }; message?: string;
      data?: { isDuplicate?: boolean; rawSlip?: { transRef?: string; amount?: { amount?: number }; receiver?: { account?: { proxy?: { account?: string }; bank?: { account?: string } } } } };
    } | null;
    const code = String(j?.error?.code ?? (j?.success === false ? j?.message : '') ?? '').toLowerCase();
    if (!j || !j.success || !j.data?.rawSlip) {
      if (r.status === 401 || r.status === 403 || code.includes('unauthorized') || code.includes('quota') || code.includes('rate_limit')) { console.warn('[easyslip] api', r.status, code); return null; } // คีย์/โควตามีปัญหา → ให้วีเจกดยืนยันเอง
      if (code.includes('pending')) return { ok: false, pending: true, reason: 'สลิปกรุงเทพเพิ่งโอน รอระบบธนาคารสักครู่ — วีเจจะตรวจให้' };
      if (code.includes('duplicate')) return { ok: false, duplicate: true, reason: 'สลิปนี้ถูกใช้ไปแล้ว' };
      if (code.includes('qrcode') || code.includes('invalid_image') || code.includes('validation')) return { ok: false, reason: 'อ่าน QR ในสลิปไม่ได้ — ลองถ่าย/แคปให้ชัดขึ้น' };
      if (code.includes('not_found')) return { ok: false, reason: 'ไม่พบสลิปนี้ในระบบธนาคาร' };
      return null;
    }
    const s = j.data.rawSlip, acc = s.receiver?.account;
    if (j.data.isDuplicate) return { ok: false, duplicate: true, reason: 'สลิปนี้ถูกใช้ไปแล้ว' };
    return { ok: true, amount: Number(s.amount?.amount) || 0, ref: s.transRef, receivers: [acc?.proxy?.account, acc?.bank?.account].filter((x): x is string => !!x) };
  } catch (err) {
    console.warn('[easyslip] failed', (err as Error).message);
    return null;
  }
}

async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  await requireUser(req, reply);
  if (reply.sent) return;
  if (!isAdmin(req)) await reply.code(403).send({ error: 'สำหรับแอดมินเท่านั้น' });
}
const MASK = '••••••••';
const pub = () => ({ key: read().key ? MASK : '', fromEnv: !read().key && !!config.easyslipKey, enabled: !!easyslipKey() });

export async function easyslipRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/admin/easyslip', { preHandler: requireAdmin }, async () => pub());
  app.put('/api/admin/easyslip', { preHandler: requireAdmin }, async (req, reply) => {
    const p = z.object({ key: z.string().trim().max(500) }).safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: 'ข้อมูลไม่ถูกต้อง' });
    const key = p.data.key === MASK ? read().key : p.data.key;
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify({ key }), { mode: 0o600 });
    cache = { key };
    return pub();
  });
  // ทดสอบคีย์: ดูโควตาที่เหลือ (GET /v2/info)
  app.post('/api/admin/easyslip/test', { preHandler: requireAdmin, config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async () => {
    const key = easyslipKey();
    if (!key) return { ok: false, error: 'ยังไม่ได้ใส่คีย์' };
    try {
      const r = await fetch(`${API}/info`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000) });
      const j = await r.json().catch(() => null) as { success?: boolean; data?: unknown; error?: { code?: string; message?: string } } | null;
      if (!r.ok || !j?.success) return { ok: false, error: r.status === 401 ? 'คีย์ไม่ถูกต้อง หรือหมดอายุ' : r.status === 403 ? 'IP เซิร์ฟเวอร์ยังไม่ได้อยู่ใน whitelist ของ EasySlip' : (j?.error?.message || `EasySlip ตอบกลับ ${r.status}`) };
      return { ok: true, info: j.data };
    } catch (err) { return { ok: false, error: 'ติดต่อ EasySlip ไม่ได้: ' + (err as Error).message }; }
  });
}
