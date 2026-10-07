import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { requireUser, getUser } from '../auth/middleware.js';
import { getEntitlements } from '../plans/index.js';
import { getHub } from '../realtime/hub.js';
import { isAdmin } from '../admin/routes.js';

const triggerSchema = z.object({
  event: z.enum(['gift', 'follow', 'share', 'like', 'chat']),
  giftName: z.string().optional(),
  minDiamonds: z.number().int().nonnegative().optional(),
  keyword: z.string().optional(),
});
const actionSchema = z.object({
  type: z.enum(['sound', 'image', 'video', 'text', 'tarot', 'effect', 'sign', 'glove']),
  // ป้ายไฟ (type=sign)
  signStyle: z.enum(['led', 'neon', 'bulb', 'cute', 'pixel', 'y2k', 'glass', 'surreal', 'boho', 'victorian', 'graffiti', 'future', 'mwhite', 'mblack', 'mline', 'mpill']).optional(),
  signMode: z.enum(['scroll', 'static', 'blink', 'pulse']).optional(),
  signPos: z.enum(['top', 'center', 'bottom']).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional(),
  effect: z.enum(['butterflies']).optional(),
  count: z.number().int().min(1).max(30).optional(),
  repeat: z.number().int().min(1).max(20).optional(),
  // เสียงแจ้งเตือน: ความดัง (0–1.5) + ปุ่มลัดคีย์บอร์ดในแดชบอร์ด
  volume: z.number().min(0).max(1.5).optional(),
  key: z.string().max(20).optional(),
  url: z.string().url().optional(),
  sound: z.string().regex(/^[a-z]{2,20}$/).optional(), // เสียงสำเร็จรูป (overlay/js/sfx.js) — ไม่ต้องมีลิงก์
  text: z.string().max(200).optional(),
  durationMs: z.number().int().positive().max(60_000).optional(),
  cards: z.union([z.literal(1), z.literal(3), z.literal(7)]).optional(),
  deck: z.enum(['full', 'major', 'wands', 'cups', 'swords', 'pentacles']).optional(),
  topic: z.enum(['general', 'love', 'self', 'money']).optional(),
});
const ruleSchema = z.object({
  name: z.string().trim().min(1).max(80),
  enabled: z.boolean().optional().default(true),
  trigger: triggerSchema,
  action: actionSchema,
});

/**
 * CRUD กฎ Actions & Events
 * แก้ไขแล้วล้างแคชกฎใน RoomHub ให้มีผลกับไลฟ์ทันที
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
    if (action.type === 'tarot' && !isAdmin(req)) return reply.code(403).send({ error: 'Action เปิดไพ่ทาโร่ ใช้ได้เฉพาะแอดมิน' });
    const ent = await getEntitlements(claims.userId);
    const count = await prisma.actionRule.count({ where: { userId: claims.userId } });
    if (count >= ent.maxActionRules) {
      return reply.code(403).send({ error: `แพลน ${ent.plan} สร้างกฎได้สูงสุด ${ent.maxActionRules} ข้อ — อัปเกรดเป็น Pro เพื่อเพิ่ม`, upgrade: true });
    }
    const rule = await prisma.actionRule.create({
      data: { userId: claims.userId, name, enabled, trigger: trigger as Prisma.InputJsonValue, action: action as Prisma.InputJsonValue },
    });
    getHub()?.invalidateRules(claims.userId);
    return reply.code(201).send({ rule });
  });

  app.put('/api/actions/:id', { preHandler: requireUser }, async (req, reply) => {
    const claims = getUser(req)!;
    const id = (req.params as { id: string }).id;
    const parsed = ruleSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'กฎไม่ถูกต้อง', issues: parsed.error.issues });
    const existing = await prisma.actionRule.findFirst({ where: { id, userId: claims.userId } });
    if (!existing) return reply.code(404).send({ error: 'ไม่พบกฎนี้' });
    const d = parsed.data;
    if (d.action?.type === 'tarot' && !isAdmin(req)) return reply.code(403).send({ error: 'Action เปิดไพ่ทาโร่ ใช้ได้เฉพาะแอดมิน' });
    const rule = await prisma.actionRule.update({
      where: { id },
      data: {
        ...(d.name != null ? { name: d.name } : {}),
        ...(d.enabled != null ? { enabled: d.enabled } : {}),
        ...(d.trigger ? { trigger: d.trigger as Prisma.InputJsonValue } : {}),
        ...(d.action ? { action: d.action as Prisma.InputJsonValue } : {}),
      },
    });
    getHub()?.invalidateRules(claims.userId);
    return { rule };
  });

  // ทดลองเล่นกฎนี้บนจอ fx ทันที (ไม่ต้องรอของขวัญจริง) — คืนจำนวนจอ fx ที่เปิดอยู่ ไว้บอกวีเจว่าใส่ลิงก์หรือยัง
  app.post('/api/actions/:id/test', { preHandler: requireUser, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const claims = getUser(req)!;
    const id = (req.params as { id: string }).id;
    const rule = await prisma.actionRule.findFirst({ where: { id, userId: claims.userId } });
    if (!rule) return reply.code(404).send({ error: 'ไม่พบกฎนี้' });
    const user = await prisma.user.findUnique({ where: { id: claims.userId }, select: { tiktokUsername: true, displayName: true } });
    if (!user?.tiktokUsername) return reply.code(400).send({ error: 'ยังไม่ได้ผูกชื่อ TikTok' });
    const nick = user.displayName || user.tiktokUsername;
    const event = { type: 'gift', user: { uniqueId: user.tiktokUsername, nickname: nick }, giftName: 'ทดสอบ', comment: 'ทดสอบ' };
    const screens = (await getHub()?.emitOwnerCount(claims.userId, user.tiktokUsername, 'action', { ruleId: rule.id, name: rule.name, action: rule.action, event, ts: Date.now() })) ?? 0;
    return { ok: true, screens };
  });

  // รายการเมนูของขวัญจากกฎจริง (ใช้ในตัวอย่างวิดเจ็ต "เมนูของขวัญ" บนแดชบอร์ด)
  app.get('/api/actions/menu', { preHandler: requireUser }, async (req) => {
    const claims = getUser(req)!;
    return { items: (await getHub()?.menuFor(claims.userId)) ?? [] };
  });

  app.delete('/api/actions/:id', { preHandler: requireUser }, async (req, reply) => {
    const claims = getUser(req)!;
    const id = (req.params as { id: string }).id;
    const existing = await prisma.actionRule.findFirst({ where: { id, userId: claims.userId } });
    if (!existing) return reply.code(404).send({ error: 'ไม่พบกฎนี้' });
    await prisma.actionRule.delete({ where: { id } });
    getHub()?.invalidateRules(claims.userId);
    return { ok: true };
  });
}
