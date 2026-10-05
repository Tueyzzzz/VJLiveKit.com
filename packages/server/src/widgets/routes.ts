import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { requireUser, getUser } from '../auth/middleware.js';
import { signOverlayToken } from './tokens.js';
import { config } from '../config/index.js';

const WIDGET_TYPES = ['coinjar', 'alerts', 'goal', 'chat', 'tts'] as const;

export async function widgetRoutes(app: FastifyInstance): Promise<void> {
  // สร้าง overlay token + คืน URL พร้อมใช้สำหรับ OBS
  app.post('/api/overlay-tokens', { preHandler: requireUser }, async (req, reply) => {
    const claims = getUser(req)!;
    const user = await prisma.user.findUnique({ where: { id: claims.userId }, include: { subscription: { include: { plan: true } } } });
    if (!user?.tiktokUsername) return reply.code(400).send({ error: 'ยังไม่ได้ตั้งชื่อ TikTok (tiktokUsername)' });

    const label = (req.body as { label?: string })?.label;
    const raw = randomBytes(12).toString('hex');
    const record = await prisma.overlayToken.create({ data: { userId: user.id, token: raw, label } });

    const plan = user.subscription?.plan.code ?? 'free';
    const jwtToken = signOverlayToken({ userId: user.id, username: user.tiktokUsername, plan });

    const urls = Object.fromEntries(
      WIDGET_TYPES.map((t) => [t, `${config.publicBaseUrl}/overlay/${t}.html?t=${jwtToken}`]),
    );
    return reply.code(201).send({ id: record.id, token: jwtToken, urls });
  });

  // อ่าน/บันทึกตั้งค่า widget
  app.get('/api/widgets/:type/config', { preHandler: requireUser }, async (req, reply) => {
    const claims = getUser(req)!;
    const type = (req.params as { type: string }).type;
    if (!WIDGET_TYPES.includes(type as (typeof WIDGET_TYPES)[number])) return reply.code(400).send({ error: 'ชนิด widget ไม่ถูกต้อง' });
    const cfg = await prisma.widgetConfig.findUnique({ where: { userId_type: { userId: claims.userId, type } } });
    return { config: cfg?.settings ?? {} };
  });

  app.put('/api/widgets/:type/config', { preHandler: requireUser }, async (req, reply) => {
    const claims = getUser(req)!;
    const type = (req.params as { type: string }).type;
    if (!WIDGET_TYPES.includes(type as (typeof WIDGET_TYPES)[number])) return reply.code(400).send({ error: 'ชนิด widget ไม่ถูกต้อง' });
    const settings = z.record(z.unknown()).parse(req.body) as Prisma.InputJsonValue;
    const cfg = await prisma.widgetConfig.upsert({
      where: { userId_type: { userId: claims.userId, type } },
      create: { userId: claims.userId, type, settings },
      update: { settings },
    });
    return { config: cfg.settings };
  });
}
