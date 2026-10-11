import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../db/prisma.js';
import { requireUser, getUser } from '../auth/middleware.js';
import { isAdmin } from '../admin/routes.js';
import { listLives, type LiveRecord } from '../realtime/lives.js';
import { readLiveStats } from '../realtime/livestats.js';

/** ชื่อ TikTok ที่ดูสถิติได้: ของตัวเอง · แอดมินส่ง ?username= ดูของคนอื่นได้ */
async function targetUsername(req: FastifyRequest): Promise<string> {
  const q = (req.query as { username?: string }).username;
  if (q && isAdmin(req)) return q.replace(/^@/, '').trim().toLowerCase();
  const u = await prisma.user.findUnique({ where: { id: getUser(req)!.userId }, select: { tiktokUsername: true } });
  return (u?.tiktokUsername ?? '').replace(/^@/, '').trim().toLowerCase();
}

function summarize(l: LiveRecord) {
  const st = readLiveStats(l.roomId);
  const samples = st?.samples ?? [];
  const live = samples.filter((s) => s.viewers > 0);
  const durationMin = Math.max(0, Math.round((new Date(l.lastSeenAt).getTime() - new Date(l.startedAt).getTime()) / 60_000));
  return {
    roomId: l.roomId, startedAt: l.startedAt, endedAt: l.lastSeenAt, ended: l.ended, durationMin,
    peakViewers: l.peakViewers, diamonds: l.diamonds, gifts: l.gifts, likes: l.likes,
    avgViewers: live.length ? Math.round(live.reduce((a, s) => a + s.viewers, 0) / live.length) : null,
    hasTimeline: samples.length > 0,
    joins: st ? st.totals.uniqueJoiners : null, follows: st ? st.totals.follows : null,
    shares: st ? st.totals.shares : null, chats: st ? st.totals.chats : null,
    pkCount: st?.pks?.length ?? 0, pkWins: st?.pks?.filter((p) => p.result === 'win').length ?? 0,
  };
}

export async function statsRoutes(app: FastifyInstance): Promise<void> {
  // รายการไลฟ์ล่าสุด: อย่างน้อย 30 ไลฟ์ + ทุกไลฟ์ใน 14 วัน (ไว้เทียบ 7 วันนี้กับ 7 วันก่อน) สูงสุด 120
  app.get('/api/stats/lives', { preHandler: requireUser }, async (req) => {
    const tk = await targetUsername(req);
    if (!tk) return { username: null, lives: [] };
    const mine = listLives().filter((l) => l.username.toLowerCase() === tk);
    const cut = Date.now() - 14 * 86_400_000;
    const recent = mine.filter((l) => new Date(l.startedAt).getTime() >= cut).length;
    const take = Math.min(120, Math.max(30, recent));
    return { username: tk, lives: mine.slice(-take).reverse().map(summarize) };
  });

  app.get('/api/stats/lives/:roomId', { preHandler: requireUser }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { roomId } = req.params as { roomId: string };
    const tk = await targetUsername(req);
    const l = listLives().find((x) => x.roomId === roomId);
    if (!l) return reply.code(404).send({ error: 'ไม่พบไลฟ์นี้' });
    if (!tk || l.username.toLowerCase() !== tk) return reply.code(403).send({ error: 'ไม่ใช่ไลฟ์ของคุณ' });
    const st = readLiveStats(roomId);
    return { live: summarize(l), samples: st?.samples ?? [], totals: st?.totals ?? null, pks: st?.pks ?? [] };
  });
}
