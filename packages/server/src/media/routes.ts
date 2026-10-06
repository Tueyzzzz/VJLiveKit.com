import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';
import { requireUser, getUser } from '../auth/middleware.js';
import { config } from '../config/index.js';
import { settings } from '../settings/index.js';

/**
 * อัปโหลดเสียง/เพลงของวีเจ ใช้กับกฎ "เล่นเสียง" (แทนการหาลิงก์ไฟล์เอง)
 * เก็บใน data/sounds/<userId>/ (volume ถาวรเดียวกับ snapshot) · เสิร์ฟสาธารณะที่ /media/sounds/<userId>/<file>
 * ชื่อไฟล์สุ่ม เดาไม่ได้ — overlay ใน OBS โหลดได้โดยไม่ต้องล็อกอิน
 */
const ROOT = path.join(process.env.SNAPSHOT_DIR ? path.dirname(process.env.SNAPSHOT_DIR) : path.resolve(process.cwd(), '../../data'), 'sounds');
const lim = () => ({ bytes: settings().soundMaxMB * 1024 * 1024, files: settings().soundMaxFiles }); // ปรับได้ที่หน้าตั้งค่าระบบ
const TYPES: Record<string, string> = { 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/webm': 'webm' };
const MIME: Record<string, string> = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', webm: 'audio/webm' };

interface SoundFile { id: string; name: string; file: string; size: number; createdAt: string }
const dirOf = (userId: string) => path.join(ROOT, userId.replace(/[^\w-]/g, ''));
const indexOf = (userId: string) => path.join(dirOf(userId), 'index.json');
function list(userId: string): SoundFile[] {
  try { return JSON.parse(fs.readFileSync(indexOf(userId), 'utf8')) as SoundFile[]; } catch { return []; }
}
function saveList(userId: string, items: SoundFile[]): void {
  fs.mkdirSync(dirOf(userId), { recursive: true });
  fs.writeFileSync(indexOf(userId), JSON.stringify(items));
}
const urlOf = (userId: string, f: SoundFile) => `${config.publicBaseUrl}/media/sounds/${userId}/${f.file}`;

const uploadSchema = z.object({
  name: z.string().trim().min(1).max(60),
  data: z.string().regex(/^data:audio\/[\w.+-]+;base64,/).max(28_000_000),
});

export async function mediaRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/sounds', { preHandler: requireUser }, async (req) => {
    const { userId } = getUser(req)!;
    return { sounds: list(userId).map((f) => ({ id: f.id, name: f.name, size: f.size, url: urlOf(userId, f) })), max: lim().files, maxBytes: lim().bytes };
  });

  app.post('/api/sounds', { preHandler: requireUser, bodyLimit: 28_500_000, config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (req, reply) => {
    const { userId } = getUser(req)!;
    const parsed = uploadSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'ไฟล์ไม่ถูกต้อง — รองรับ mp3 / wav / ogg / m4a' });
    const { name, data } = parsed.data;
    const mime = data.slice(5, data.indexOf(';')).toLowerCase(), ext = TYPES[mime];
    if (!ext) return reply.code(400).send({ error: 'รองรับเฉพาะไฟล์เสียง mp3 / wav / ogg / m4a' });
    const buf = Buffer.from(data.slice(data.indexOf(',') + 1), 'base64');
    if (buf.length > lim().bytes) return reply.code(400).send({ error: `ไฟล์ใหญ่เกิน ${settings().soundMaxMB}MB — ตัดให้สั้นลง หรือแปลงเป็น mp3` });
    const items = list(userId);
    if (items.length >= lim().files) return reply.code(400).send({ error: `อัปโหลดได้สูงสุด ${lim().files} ไฟล์ — ลบไฟล์เก่าก่อน` });
    const id = crypto.randomBytes(9).toString('base64url');
    const f: SoundFile = { id, name, file: `${id}.${ext}`, size: buf.length, createdAt: new Date().toISOString() };
    fs.mkdirSync(dirOf(userId), { recursive: true });
    fs.writeFileSync(path.join(dirOf(userId), f.file), buf);
    saveList(userId, [f, ...items]);
    return reply.code(201).send({ sound: { id, name, size: f.size, url: urlOf(userId, f) } });
  });

  app.delete('/api/sounds/:id', { preHandler: requireUser }, async (req, reply) => {
    const { userId } = getUser(req)!;
    const id = (req.params as { id: string }).id;
    const items = list(userId), f = items.find((x) => x.id === id);
    if (!f) return reply.code(404).send({ error: 'ไม่พบไฟล์' });
    fs.rmSync(path.join(dirOf(userId), f.file), { force: true });
    saveList(userId, items.filter((x) => x.id !== id));
    return { ok: true };
  });

  // เสิร์ฟไฟล์เสียง (สาธารณะ ชื่อไฟล์สุ่ม) — รองรับ Range ให้เบราว์เซอร์/OBS เล่นได้ลื่น
  app.get('/media/sounds/:userId/:file', async (req, reply) => {
    const { userId, file } = req.params as { userId: string; file: string };
    if (!/^[\w-]+$/.test(userId) || !/^[\w-]+\.(mp3|wav|ogg|m4a|aac|webm)$/.test(file)) return reply.code(404).send({ error: 'ไม่พบ' });
    const p = path.join(dirOf(userId), file);
    let st: fs.Stats; try { st = fs.statSync(p); } catch { return reply.code(404).send({ error: 'ไม่พบ' }); }
    const ext = file.split('.').pop()!;
    reply.header('Content-Type', MIME[ext] ?? 'application/octet-stream').header('Accept-Ranges', 'bytes').header('Cache-Control', 'public, max-age=31536000, immutable').header('Access-Control-Allow-Origin', '*');
    const m = /bytes=(\d*)-(\d*)/.exec(String(req.headers.range ?? ''));
    if (m) {
      const start = m[1] ? Number(m[1]) : 0, end = m[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
      if (start > end || start >= st.size) return reply.code(416).header('Content-Range', `bytes */${st.size}`).send();
      return reply.code(206).header('Content-Range', `bytes ${start}-${end}/${st.size}`).header('Content-Length', end - start + 1).send(fs.createReadStream(p, { start, end }));
    }
    return reply.header('Content-Length', st.size).send(fs.createReadStream(p));
  });
}
