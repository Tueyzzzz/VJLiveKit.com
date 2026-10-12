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
type Provider = 'easyslip' | 'slipok';
interface Cfg { provider: Provider; key: string; branch: string }
let cache: Cfg | null = null;
function read(): Cfg {
  if (cache) return cache;
  try { const j = JSON.parse(fs.readFileSync(FILE, 'utf8')); cache = { provider: j.provider === 'slipok' ? 'slipok' : 'easyslip', key: String(j.key ?? ''), branch: String(j.branch ?? '') }; }
  catch { cache = { provider: 'easyslip', key: '', branch: '' }; }
  return cache;
}
/** มีระบบตรวจสลิปอัตโนมัติพร้อมใช้ไหม (คืนคีย์ที่ใช้ — ว่าง = ไม่มี) */
export const easyslipKey = (): string => { const c = read(); if (c.provider === 'slipok') return c.key && c.branch ? c.key : ''; return c.key || config.easyslipKey || ''; };

export interface SlipResult { ok: boolean; amount?: number; ref?: string; receivers?: string[]; duplicate?: boolean; pending?: boolean; reason?: string }

/** ตรวจสลิปตามผู้ให้บริการที่แอดมินเลือก (EasySlip / SlipOK) — null = ไม่มีคีย์หรือเรียกไม่ได้ (ให้วีเจกดยืนยันเอง) */
export async function verifySlipV2(img: Buffer): Promise<SlipResult | null> {
  return read().provider === 'slipok' ? verifySlipOk(img) : verifyEasySlip(img);
}

/** SlipOK — https://slipok.com/api-documentation/check-slip/ · กันสลิปซ้ำด้วยระบบเราเอง (isUsedRef) */
async function verifySlipOk(img: Buffer): Promise<SlipResult | null> {
  const c = read(); if (!c.key || !c.branch) return null;
  try {
    const form = new FormData();
    form.append('files', new Blob([img], { type: 'image/jpeg' }), 'slip.jpg');
    const r = await fetch(`https://api.slipok.com/api/line/apikey/${encodeURIComponent(c.branch)}`, { method: 'POST', headers: { 'x-authorization': c.key }, body: form, signal: AbortSignal.timeout(15_000) });
    const j = await r.json().catch(() => null) as { success?: boolean; code?: number; message?: string; data?: { success?: boolean; transRef?: string; amount?: number; receiver?: { proxy?: { value?: string }; account?: { value?: string } } } } | null;
    if (!j || !j.success || !j.data?.transRef) {
      const code = Number(j?.code ?? 0);
      if (r.status === 401 || r.status === 403 || code === 1001 || code === 1002 || code === 1004) { console.warn('[slipok] api', r.status, code, j?.message); return null; } // คีย์/สาขา/โควตา → ให้วีเจยืนยันเอง
      if (code === 1010) return { ok: false, pending: true, reason: 'สลิปเพิ่งโอน ธนาคารยังไม่ส่งข้อมูล — วีเจจะตรวจให้' };
      if (code === 1012) return { ok: false, duplicate: true, reason: 'สลิปนี้ถูกใช้ไปแล้ว' };
      if (code >= 1005 && code <= 1009) return { ok: false, reason: 'อ่าน QR ในสลิปไม่ได้ หรือไม่ใช่สลิปโอนเงิน — ลองแคปให้ชัดขึ้น' };
      if (r.status >= 500 || !code) return null;
      return { ok: false, reason: j?.message || 'ตรวจสลิปไม่ผ่าน' };
    }
    const d = j.data, rc = d.receiver;
    return { ok: true, amount: Number(d.amount) || 0, ref: d.transRef, receivers: [rc?.proxy?.value, rc?.account?.value].filter((x): x is string => !!x) };
  } catch (err) { console.warn('[slipok] failed', (err as Error).message); return null; }
}

/** EasySlip API v2 */
async function verifyEasySlip(img: Buffer): Promise<SlipResult | null> {
  const c = read(), key = c.key || config.easyslipKey || '';
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
const pub = () => ({ provider: read().provider, key: read().key ? MASK : '', branch: read().branch, fromEnv: read().provider === 'easyslip' && !read().key && !!config.easyslipKey, enabled: !!easyslipKey() });

export async function easyslipRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/admin/easyslip', { preHandler: requireAdmin }, async () => pub());
  app.put('/api/admin/easyslip', { preHandler: requireAdmin }, async (req, reply) => {
    const p = z.object({ provider: z.enum(['easyslip', 'slipok']).default('easyslip'), key: z.string().trim().max(500), branch: z.string().trim().max(40).regex(/^[\w-]*$/).default('') }).safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: 'ข้อมูลไม่ถูกต้อง' });
    const prev = read(), key = p.data.key === MASK ? (p.data.provider === prev.provider ? prev.key : '') : p.data.key;
    const next: Cfg = { provider: p.data.provider, key, branch: p.data.branch };
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(next), { mode: 0o600 });
    cache = next;
    return pub();
  });
  // ทดสอบคีย์: ดูโควตาที่เหลือ (GET /v2/info)
  app.post('/api/admin/easyslip/test', { preHandler: requireAdmin, config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async () => {
    const key = easyslipKey(), c = read();
    if (!key) return { ok: false, error: c.provider === 'slipok' ? 'ยังไม่ได้ใส่ API Key หรือ Branch ID ของ SlipOK' : 'ยังไม่ได้ใส่คีย์' };
    if (c.provider === 'slipok') { // เช็กโควตาที่เหลือ
      try {
        const r = await fetch(`https://api.slipok.com/api/line/apikey/${encodeURIComponent(c.branch)}/quota`, { headers: { 'x-authorization': key }, signal: AbortSignal.timeout(10_000) });
        const j = await r.json().catch(() => null) as { success?: boolean; data?: unknown; message?: string } | null;
        return r.ok && j?.success ? { ok: true, info: j.data } : { ok: false, error: j?.message || `SlipOK ตอบกลับ ${r.status} — เช็ก API Key / Branch ID` };
      } catch (err) { return { ok: false, error: 'ติดต่อ SlipOK ไม่ได้: ' + (err as Error).message }; }
    }
    try {
      const r = await fetch(`${API}/info`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000) });
      const j = await r.json().catch(() => null) as { success?: boolean; data?: unknown; error?: { code?: string; message?: string } } | null;
      if (!r.ok || !j?.success) return { ok: false, error: r.status === 401 ? 'คีย์ไม่ถูกต้อง หรือหมดอายุ' : r.status === 403 ? 'IP เซิร์ฟเวอร์ยังไม่ได้อยู่ใน whitelist ของ EasySlip' : (j?.error?.message || `EasySlip ตอบกลับ ${r.status}`) };
      return { ok: true, info: j.data };
    } catch (err) { return { ok: false, error: 'ติดต่อ EasySlip ไม่ได้: ' + (err as Error).message }; }
  });
}
