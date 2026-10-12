import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireUser, getUser } from '../auth/middleware.js';
import { OVERLAY_DIR } from '../overlay-version.js';

/**
 * อวตารของวีเจ (รูปสี่เหลี่ยมจัตุรัส 3 ท่า) — โผล่ข้างแจ้งเตือนโดเนท (avatar=mine)
 * วีเจอัปโหลดเองที่หน้าโดเนท · เก็บที่ data/vjav/<userId>/<1..3>.<ext>
 * เสิร์ฟสาธารณะ GET /api/vjav/<ชื่อ TikTok>/<1..3> (overlay ใน OBS ไม่ต้องล็อกอิน) · ไม่มีไฟล์ → อวตารที่ทีมงานทำให้ (overlay/public/vjav/<ชื่อ>/n.webp)
 */
const ROOT = path.join(process.env.SNAPSHOT_DIR ? path.dirname(process.env.SNAPSHOT_DIR) : path.resolve(process.cwd(), '../../data'), 'vjav');
const OVERLAY_VJAV = path.join(OVERLAY_DIR, 'vjav');
const EXT: Record<string, string> = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' };
const MIME: Record<string, string> = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg' };
const dirOf = (userId: string) => path.join(ROOT, userId.replace(/[^\w-]/g, ''));
function fileOf(userId: string, n: number): string | null {
  for (const e of ['webp', 'png', 'jpg']) { const f = path.join(dirOf(userId), `${n}.${e}`); if (fs.existsSync(f)) return f; }
  return null;
}
const slot = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 3 ? n : 0; };
// ชื่อ TikTok → userId (แคชสั้น ๆ — overlay ขอรูปทุกครั้งที่มีโดเนท)
const handleCache = new Map<string, { id: string | null; at: number }>();
async function userIdByHandle(h: string): Promise<string | null> {
  const k = h.toLowerCase(), c = handleCache.get(k);
  if (c && Date.now() - c.at < 60_000) return c.id;
  const u = await prisma.user.findFirst({ where: { tiktokUsername: { equals: h, mode: 'insensitive' } }, select: { id: true } });
  handleCache.set(k, { id: u?.id ?? null, at: Date.now() });
  return u?.id ?? null;
}
const uploadSchema = z.object({ data: z.string().regex(/^data:image\/(webp|png|jpeg);base64,/).max(3_000_000) });

export async function vjavRoutes(app: FastifyInstance): Promise<void> {
  // ของฉัน: ช่องไหนมีรูปแล้วบ้าง
  app.get('/api/vjav/me', { preHandler: requireUser }, async (req) => {
    const { userId } = getUser(req)!;
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { tiktokUsername: true } });
    const h = (u?.tiktokUsername ?? '').toLowerCase();
    return { slots: [1, 2, 3].map((n) => { const f = fileOf(userId, n); return f ? { n, url: `/api/vjav/${h}/${n}?v=${Math.floor(fs.statSync(f).mtimeMs)}` } : { n, url: null }; }) };
  });

  app.post('/api/vjav/:n', { preHandler: requireUser, bodyLimit: 3_200_000, config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (req, reply) => {
    const { userId } = getUser(req)!;
    const n = slot((req.params as { n: string }).n);
    const p = uploadSchema.safeParse(req.body);
    if (!n || !p.success) return reply.code(400).send({ error: 'รูปไม่ถูกต้อง — รองรับ JPG / PNG / WEBP ไม่เกิน 2MB' });
    const d = p.data.data, ext = EXT[d.slice(5, d.indexOf(';'))];
    const buf = Buffer.from(d.slice(d.indexOf(',') + 1), 'base64');
    // ตรวจหัวไฟล์จริง (กันไฟล์อื่นปลอมเป็นรูป)
    const ok = (ext === 'png' && buf.subarray(0, 4).toString('hex') === '89504e47') || (ext === 'jpg' && buf[0] === 0xff && buf[1] === 0xd8) || (ext === 'webp' && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP');
    if (!ok || buf.length > 2_200_000) return reply.code(400).send({ error: 'รูปไม่ถูกต้อง — รองรับ JPG / PNG / WEBP ไม่เกิน 2MB' });
    fs.mkdirSync(dirOf(userId), { recursive: true });
    for (const e of ['webp', 'png', 'jpg']) fs.rmSync(path.join(dirOf(userId), `${n}.${e}`), { force: true });
    fs.writeFileSync(path.join(dirOf(userId), `${n}.${ext}`), buf);
    return { ok: true };
  });

  app.delete('/api/vjav/:n', { preHandler: requireUser }, async (req, reply) => {
    const { userId } = getUser(req)!;
    const n = slot((req.params as { n: string }).n);
    if (!n) return reply.code(400).send({ error: 'ช่องไม่ถูกต้อง' });
    for (const e of ['webp', 'png', 'jpg']) fs.rmSync(path.join(dirOf(userId), `${n}.${e}`), { force: true });
    return { ok: true };
  });

  // สาธารณะ: overlay โหลดรูปอวตารของวีเจ
  app.get('/api/vjav/:handle/:n', async (req, reply) => {
    const { handle } = req.params as { handle: string; n: string };
    const n = slot((req.params as { n: string }).n);
    if (!n || !/^[A-Za-z0-9._]{2,24}$/.test(handle)) return reply.code(404).send();
    const uid = await userIdByHandle(handle);
    let f = uid ? fileOf(uid, n) : null;
    if (!f) { const g = path.join(OVERLAY_VJAV, handle.toLowerCase(), `${n}.webp`); if (fs.existsSync(g)) f = g; }
    if (!f) return reply.code(404).send();
    reply.header('cache-control', 'public, max-age=300').type(MIME[f.split('.').pop() ?? 'webp'] ?? 'image/webp');
    return reply.send(fs.createReadStream(f));
  });
}
