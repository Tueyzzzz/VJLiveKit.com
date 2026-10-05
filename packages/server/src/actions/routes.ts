import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { requireUser, getUser } from '../auth/middleware.js';

const triggerSchema = z.object({
  event: z.enum(['gift', 'follow', 'share', 'like', 'chat']),
  giftName: z.string().optional(),
  minDiamonds: z.number().int().nonnegative().optional(),
  keyword: z.string().optional(),
});
const actionSchema = z.object({
  type: z.enum(['sound', 'image', 'video', 'text']),
  url: z.string().url().optional(),
  text: z.string().optional(),
  durationMs: z.number().int().positive().optional(),
});
const ruleSchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean().optional().default(true),
  trigger: triggerSchema,
  action: actionSchema,
});

/**
 * CRUD กฎ Actions & Events
 * หมายเหตุ: การเปลี่ยนกฎจะมีผลกับไลฟ์ภายใน ~30 วินาที (ตาม cache TTL ใน RoomHub)
 */
export async function actionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/actions', { preHandler: requireUser }, async (req) => {
    const claims = getUser(req)!;
    const rules = await prisma.actionRule.findMany({ where: { userId: claims.userId }, orderBy: { createdAt: 'desc' } });
    return { rules };
  });

  app.post('/api/actions', { preHandler: requireUser }, async (req, reply) => {
    const claims = getUser(req)!;
    const parsed = ruleSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'กฎไม่ถูกต้อง', issues: parsed.error.issues });
    const { name, enabled, trigger, action } = parsed.data;
    const rule = await prisma.actionRule.create({
      data: { userId: claims.userId, name, enabled, trigger: trigger as Prisma.InputJsonValue, action: action as Prisma.InputJsonValue },
    });
    return reply.code(201).send({ rule });
  });

  app.put('/api/actions/:id', { preHandler: requireUser }, async (req, reply) => {
    const claims = getUser(req)!;
    const id = (req.params as { id: string }).id;
    const parsed = ruleSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'กฎไม่ถูกต้อง' });
    const existing = await prisma.actionRule.findFirst({ where: { id, userId: claims.userId } });
    if (!existing) return reply.code(404).send({ error: 'ไม่พบกฎนี้' });
    const d = parsed.data;
    const rule = await prisma.actionRule.update({
      where: { id },
      data: {
        ...(d.name != null ? { name: d.name } : {}),
        ...(d.enabled != null ? { enabled: d.enabled } : {}),
        ...(d.trigger ? { trigger: d.trigger as Prisma.InputJsonValue } : {}),
        ...(d.action ? { action: d.action as Prisma.InputJsonValue } : {}),
      },
    });
    return { rule };
  });

  app.delete('/api/actions/:id', { preHandler: requireUser }, async (req, reply) => {
    const claims = getUser(req)!;
    const id = (req.params as { id: string }).id;
    const existing = await prisma.actionRule.findFirst({ where: { id, userId: claims.userId } });
    if (!existing) return reply.code(404).send({ error: 'ไม่พบกฎนี้' });
    await prisma.actionRule.delete({ where: { id } });
    return { ok: true };
  });
}
