import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireUser, getUser } from '../auth/middleware.js';
import { verifyOverlayToken } from '../widgets/tokens.js';
import { isAdmin } from '../admin/routes.js';
import { recordError, readErrors, errKey, type ErrEntry } from './store.js';

/** ชื่อผู้ใช้ของวิดเจ็ต (จาก ?t=) — จำไว้ 10 นาที ไม่ต้องถาม DB ทุกครั้ง */
const who = new Map<string, { v: string; at: number }>();
async function userOf(userId: string): Promise<string> {
  const c = who.get(userId); if (c && Date.now() - c.at < 600_000) return c.v;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { tiktokUsername: true, email: true } }).catch(() => null);
  const v = u ? (u.tiktokUsername ? '@' + u.tiktokUsername : u.email) : userId;
  if (who.size > 5000) who.clear();
  who.set(userId, { v, at: Date.now() }); return v;
}

const ClientErr = z.object({
  src: z.enum(['overlay', 'dashboard']),
  msg: z.string().max(2000),
  stack: z.string().max(4000).optional(),
  where: z.string().max(300).optional(),
  ver: z.string().max(60).optional(),
  t: z.string().max(2000).optional(), // overlay token (ระบุว่าเป็นวิดเจ็ตของใคร)
});

async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireUser(req, reply);
  if (reply.sent) return;
  if (!isAdmin(req)) await reply.code(403).send({ error: 'สำหรับแอดมินเท่านั้น' });
}

/** ต้องเรียกกับ app ตัวหลักโดยตรง (ไม่ผ่าน register) — hook ใน plugin จะเห็นแค่ route ของ plugin นั้น */
export function installErrorHooks(app: FastifyInstance): void {
  // API ล่ม (500+) → บันทึก
  app.addHook('onError', async (req, reply, err) => {
    const code = (err as { statusCode?: number }).statusCode ?? reply.statusCode;
    if (code && code < 500) return;
    const c = getUser(req);
    recordError({ src: 'server', msg: err.message, stack: err.stack, where: `${req.method} ${req.url.split('?')[0]}`, user: c?.email, ip: req.ip });
  });
}

export async function errlogRoutes(app: FastifyInstance): Promise<void> {
  // วิดเจ็ต/แดชบอร์ดส่ง error มาเอง — จำกัดต่อ IP กันยิงถล่ม (ฝั่ง client จำกัดซ้ำอีกชั้น)
  app.post('/api/log/client', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const p = ClientErr.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ ok: false });
    const b = p.data;
    let user: string | undefined;
    if (b.t) { const tok = verifyOverlayToken(b.t); if (tok) user = await userOf(tok.userId); }
    if (!user) { const c = getUser(req); if (c) user = c.email; }
    recordError({ src: b.src, msg: b.msg, stack: b.stack, where: b.where, ver: b.ver, user, ua: String(req.headers['user-agent'] ?? ''), ip: req.ip });
    return { ok: true };
  });

  // แอดมิน: error ล่าสุด + จัดกลุ่มเรื่องเดียวกัน (จำนวนครั้ง · กี่คน · ล่าสุดเมื่อไร)
  app.get('/api/admin/errors', { preHandler: requireAdmin }, async (req) => {
    const q = req.query as { days?: string; src?: string; q?: string };
    const needle = (q.q ?? '').trim().toLowerCase().replace(/^@/, '');
    let rows = readErrors(Number(q.days) || 3);
    if (q.src) rows = rows.filter((r) => r.src === q.src);
    if (needle) rows = rows.filter((r) => [r.user, r.msg, r.where].some((s) => s?.toLowerCase().replace(/@/g, '').includes(needle)));
    const groups = new Map<string, { key: string; src: string; msg: string; where?: string; count: number; first: number; last: number; users: Set<string>; sample: ErrEntry }>();
    for (const r of rows) {
      const k = errKey(r);
      const g = groups.get(k);
      if (g) { g.count++; g.first = Math.min(g.first, r.ts); g.last = Math.max(g.last, r.ts); if (r.user) g.users.add(r.user); }
      else groups.set(k, { key: k, src: r.src, msg: r.msg, where: r.where, count: 1, first: r.ts, last: r.ts, users: new Set(r.user ? [r.user] : []), sample: r });
    }
    const bySrc: Record<string, number> = {};
    for (const r of rows) bySrc[r.src] = (bySrc[r.src] ?? 0) + 1;
    return {
      total: rows.length, bySrc,
      groups: [...groups.values()].sort((a, b) => b.last - a.last).slice(0, 100)
        .map((g) => ({ ...g, users: [...g.users].slice(0, 20), userCount: g.users.size })),
      recent: rows.slice(0, 50),
    };
  });
}
