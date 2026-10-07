import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';
import { requireUser, getUser } from '../auth/middleware.js';
import { isAdmin } from '../admin/routes.js';
import { prisma } from '../db/prisma.js';
import { getHub } from '../realtime/hub.js';

/**
 * แชทแจ้งปัญหา ลูกค้า ↔ แอดมิน (1 ห้องต่อ 1 ลูกค้า)
 * เก็บใน data/support.json + รูปแนบใน data/support/<id>.jpg (ไม่ต้อง migrate)
 * แจ้งอีกฝั่งทันทีผ่าน socket (หน้าเว็บที่เปิดอยู่) — ไม่ได้เปิดก็เห็นตัวเลขยังไม่อ่านตอนเข้าเว็บ
 */
const DIR = process.env.SNAPSHOT_DIR ? path.dirname(process.env.SNAPSHOT_DIR) : path.resolve(process.cwd(), '../../data');
const FILE = path.join(DIR, 'support.json');
const IMG_DIR = path.join(DIR, 'support');

interface Msg { id: string; from: 'user' | 'admin'; text: string; img?: string; ts: string; by?: string }
interface Thread { userId: string; email: string; name: string; tiktok: string | null; msgs: Msg[]; unreadUser: number; unreadAdmin: number; status: 'open' | 'done'; updatedAt: string }

let threads: Record<string, Thread> = {};
try { threads = JSON.parse(fs.readFileSync(FILE, 'utf8')) as Record<string, Thread>; } catch { /* ยังไม่มีไฟล์ */ }
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const save = () => {
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(threads)); }, 300);
};

const MAX_MSGS = 300;
const sendSchema = z.object({
  text: z.string().trim().max(2000).default(''),
  /** รูปแนบ (data URL jpeg/png/webp ย่อแล้วจากหน้าเว็บ) ไม่เกิน ~1.5MB */
  img: z.string().max(2_000_000).regex(/^data:image\/(jpeg|png|webp);base64,/).optional(),
}).refine((b) => b.text || b.img, { message: 'ว่าง' });

function saveImg(dataUrl: string): string {
  const [, ext, b64] = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(dataUrl)!;
  const id = crypto.randomBytes(16).toString('hex') + '.' + (ext === 'jpeg' ? 'jpg' : ext);
  fs.mkdirSync(IMG_DIR, { recursive: true });
  fs.writeFileSync(path.join(IMG_DIR, id), Buffer.from(b64!, 'base64'));
  return id;
}

async function threadFor(userId: string): Promise<Thread> {
  let t = threads[userId];
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, displayName: true, tiktokUsername: true } });
  if (!t) t = threads[userId] = { userId, email: u?.email ?? '', name: u?.displayName ?? '', tiktok: u?.tiktokUsername ?? null, msgs: [], unreadUser: 0, unreadAdmin: 0, status: 'open', updatedAt: new Date().toISOString() };
  else if (u) { t.email = u.email; t.name = u.displayName ?? ''; t.tiktok = u.tiktokUsername; }
  return t;
}

function push(t: Thread, m: Omit<Msg, 'id' | 'ts'>): Msg {
  const msg: Msg = { id: crypto.randomBytes(6).toString('base64url'), ts: new Date().toISOString(), ...m };
  t.msgs.push(msg); if (t.msgs.length > MAX_MSGS) t.msgs.splice(0, t.msgs.length - MAX_MSGS);
  t.updatedAt = msg.ts;
  return msg;
}

const pub = (t: Thread) => ({ msgs: t.msgs.map(({ by: _by, ...m }) => m), status: t.status });

async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  await requireUser(req, reply);
  if (reply.sent) return;
  if (!isAdmin(req)) await reply.code(403).send({ error: 'สำหรับแอดมินเท่านั้น' });
}

export async function supportRoutes(app: FastifyInstance): Promise<void> {
  // ---- ลูกค้า ----
  app.get('/api/support', { preHandler: requireUser }, async (req) => {
    const t = threads[getUser(req)!.userId];
    if (!t) return { msgs: [], status: 'open' };
    if (t.unreadUser) { t.unreadUser = 0; save(); }
    return pub(t);
  });
  app.get('/api/support/unread', { preHandler: requireUser }, async (req) => {
    const { userId } = getUser(req)!;
    const admin = isAdmin(req);
    return { unread: threads[userId]?.unreadUser ?? 0, ...(admin ? { admin: Object.values(threads).reduce((s, t) => s + t.unreadAdmin, 0) } : {}) };
  });
  app.post('/api/support', { preHandler: requireUser, config: { rateLimit: { max: 20, timeWindow: '1 minute' } }, bodyLimit: 2_500_000 }, async (req, reply) => {
    const parsed = sendSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'พิมพ์ข้อความหรือแนบรูปก่อนส่ง' });
    const t = await threadFor(getUser(req)!.userId);
    const msg = push(t, { from: 'user', text: parsed.data.text, ...(parsed.data.img ? { img: saveImg(parsed.data.img) } : {}) });
    t.unreadAdmin++; t.status = 'open'; save();
    getHub()?.emitAdmins('support', { userId: t.userId });
    return reply.code(201).send({ msg });
  });

  // รูปแนบ — ชื่อไฟล์สุ่มยาว เดาไม่ได้ (แท็ก <img> ส่ง token ไม่ได้)
  app.get('/api/support/img/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!/^[a-f0-9]{32}\.(jpg|png|webp)$/.test(id)) return reply.code(404).send();
    const p = path.join(IMG_DIR, id);
    if (!fs.existsSync(p)) return reply.code(404).send();
    return reply.header('cache-control', 'private, max-age=86400').type(id.endsWith('png') ? 'image/png' : id.endsWith('webp') ? 'image/webp' : 'image/jpeg').send(fs.createReadStream(p));
  });

  // ---- แอดมิน ----
  app.get('/api/admin/support', { preHandler: requireAdmin }, async () => ({
    threads: Object.values(threads).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(({ msgs, ...t }) => ({ ...t, last: msgs.at(-1) ?? null })),
  }));
  app.get('/api/admin/support/:userId', { preHandler: requireAdmin }, async (req, reply) => {
    const t = threads[(req.params as { userId: string }).userId];
    if (!t) return reply.code(404).send({ error: 'ไม่พบ' });
    if (t.unreadAdmin) { t.unreadAdmin = 0; save(); }
    return { thread: t };
  });
  app.post('/api/admin/support/:userId', { preHandler: requireAdmin, bodyLimit: 2_500_000 }, async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const parsed = sendSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'พิมพ์ข้อความก่อนส่ง' });
    const t = await threadFor(userId);
    const msg = push(t, { from: 'admin', text: parsed.data.text, by: getUser(req)!.email, ...(parsed.data.img ? { img: saveImg(parsed.data.img) } : {}) });
    t.unreadUser++; t.unreadAdmin = 0; save();
    getHub()?.emitUser(userId, 'support', { from: 'admin' });
    return reply.code(201).send({ msg });
  });
  // แก้ปัญหาเสร็จ → ลบแชททิ้งทั้งห้อง (ข้อความ + รูปแนบ) ลูกค้าเริ่มเรื่องใหม่ได้ทุกเมื่อ
  app.post('/api/admin/support/:userId/status', { preHandler: requireAdmin }, async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const t = threads[userId];
    if (!t) return reply.code(404).send({ error: 'ไม่พบ' });
    if ((req.body as { status?: string })?.status === 'done') {
      for (const m of t.msgs) if (m.img) fs.rm(path.join(IMG_DIR, m.img), { force: true }, () => {});
      delete threads[userId]; save();
      getHub()?.emitUser(userId, 'support', { from: 'admin', done: true });
      return { ok: true, deleted: true };
    }
    t.status = 'open'; save();
    return { ok: true };
  });
}
