import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { requireUser, getUser } from '../auth/middleware.js';
import { isAdmin } from '../admin/routes.js';
import { prisma } from '../db/prisma.js';
import { CUSTOM_MASCOTS } from './custom.js';

async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  await requireUser(req, reply);
  if (reply.sent) return;
  if (!isAdmin(req)) await reply.code(403).send({ error: 'สำหรับแอดมินเท่านั้น' });
}

export async function mascotRoutes(app: FastifyInstance): Promise<void> {
  // มาสคอตสั่งทำของบัญชีนี้ (แอดมินเห็นทุกตัว ไว้ทดสอบ)
  app.get('/api/mascots/custom', { preHandler: requireUser }, async (req) => {
    const { userId } = getUser(req)!;
    const mine = (CUSTOM_MASCOTS[userId] ?? []).map((m) => ({ ...m, mine: true }));
    const others = isAdmin(req) ? Object.entries(CUSTOM_MASCOTS).filter(([id]) => id !== userId).flatMap(([, l]) => l.map((m) => ({ ...m, mine: false }))) : [];
    return { mascots: [...mine, ...others] };
  });

  // หลังบ้าน: ใครซื้อมาสคอตสั่งทำแล้วบ้าง
  app.get('/api/admin/mascots', { preHandler: requireAdmin }, async () => {
    const ids = Object.keys(CUSTOM_MASCOTS);
    const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true, displayName: true, tiktokUsername: true } });
    const configs = await prisma.widgetConfig.findMany({ where: { userId: { in: ids }, type: 'mascot' }, select: { userId: true, settings: true } });
    return {
      orders: ids.flatMap((id) => (CUSTOM_MASCOTS[id] ?? []).map((m) => {
        const u = users.find((x) => x.id === id), cfg = configs.find((c) => c.userId === id)?.settings as Record<string, unknown> | undefined;
        return { ...m, userId: id, email: u?.email ?? '(ไม่พบบัญชี)', name: u?.displayName ?? '', tiktok: u?.tiktokUsername ?? null, inUse: cfg?.char === m.code };
      })),
    };
  });
}
