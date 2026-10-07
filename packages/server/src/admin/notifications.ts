import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';
import { requireUser, getUser } from '../auth/middleware.js';
import { getEntitlements } from '../plans/index.js';
import { isAdmin } from './routes.js';
import { audit } from './store.js';

/**
 * การแจ้งเตือน (กระดิ่งบนแดชบอร์ด) — แอดมินเขียนจากหลังบ้าน เลือกส่งถึงทุกคน / ตามแพลน
 * เก็บใน data/notifications.json (ไม่ต้อง migrate) · สถานะอ่านแล้วเก็บในเบราว์เซอร์ของลูกค้า
 */
const FILE = path.join(process.env.SNAPSHOT_DIR ? path.dirname(process.env.SNAPSHOT_DIR) : path.resolve(process.cwd(), '../../data'), 'notifications.json');
type Audience = 'all' | 'trial' | 'pro' | 'free';
interface Note { id: string; title: string; body: string; link?: string; icon?: string; audience: Audience; createdAt: string; by: string }

let notes: Note[] = [];
try { notes = JSON.parse(fs.readFileSync(FILE, 'utf8')) as Note[]; } catch { /* ยังไม่มีไฟล์ */ }
const save = () => { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(notes.slice(-300))); };

const noteSchema = z.object({
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().max(500).default(''),
  link: z.string().trim().max(300).regex(/^(\/|https:\/\/)/).optional().or(z.literal('').transform(() => undefined)),
  icon: z.string().trim().max(8).optional(),
  audience: z.enum(['all', 'trial', 'pro', 'free']).default('all'),
});

async function requireAdmin(req: Parameters<typeof requireUser>[0], reply: Parameters<typeof requireUser>[1]) {
  await requireUser(req, reply);
  if (reply.sent) return;
  if (!isAdmin(req)) await reply.code(403).send({ error: 'สำหรับแอดมินเท่านั้น' });
}

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  // ลูกค้า: การแจ้งเตือนที่ส่งถึงตัวเอง (ล่าสุดก่อน)
  app.get('/api/notifications', { preHandler: requireUser }, async (req) => {
    const { userId } = getUser(req)!;
    const plan = (await getEntitlements(userId)).plan as Audience;
    return { notifications: notes.filter((n) => n.audience === 'all' || n.audience === plan).slice(-50).reverse().map(({ by: _by, ...n }) => n) };
  });

  // แอดมิน: ดู / ส่ง / ลบ
  app.get('/api/admin/notifications', { preHandler: requireAdmin }, async () => ({ notifications: notes.slice().reverse() }));
  app.post('/api/admin/notifications', { preHandler: requireAdmin }, async (req, reply) => {
    const parsed = noteSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'ข้อมูลไม่ครบ — ใส่หัวข้อ (ลิงก์ต้องขึ้นต้นด้วย / หรือ https://)' });
    const by = getUser(req)!.email;
    const n: Note = { id: crypto.randomBytes(6).toString('base64url'), ...parsed.data, createdAt: new Date().toISOString(), by };
    notes.push(n); save();
    audit(by, 'ส่งการแจ้งเตือน', undefined, `${n.title} → ${n.audience}`);
    return reply.code(201).send({ notification: n });
  });
  app.delete('/api/admin/notifications/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const n = notes.find((x) => x.id === id);
    if (!n) return reply.code(404).send({ error: 'ไม่พบ' });
    notes = notes.filter((x) => x.id !== id); save();
    audit(getUser(req)!.email, 'ลบการแจ้งเตือน', undefined, n.title);
    return { ok: true };
  });
}
