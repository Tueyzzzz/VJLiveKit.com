import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { requireUser, getUser } from '../auth/middleware.js';
import { signOverlayToken } from './tokens.js';
import { config } from '../config/index.js';
import { WIDGET_TYPES, isWidgetType, getEntitlements } from '../plans/index.js';
import { getHub } from '../realtime/hub.js';

/** URL overlay ทุกตัวสำหรับ token หนึ่ง พร้อมบอกว่าแพลนปัจจุบันใช้ได้ไหม */
function widgetUrls(jwtToken: string, allowed: readonly string[]) {
  return WIDGET_TYPES.map((type) => ({
    type,
    url: `${config.publicBaseUrl}/overlay/${type}.html?t=${jwtToken}`,
    locked: !allowed.includes(type),
  }));
}

export async function widgetRoutes(app: FastifyInstance): Promise<void> {
  // รายการ token ที่ยังใช้ได้ (คืน URL ให้คัดลอกใหม่ได้)
  app.get('/api/overlay-tokens', { preHandler: requireUser }, async (req) => {
    const claims = getUser(req)!;
    const ent = await getEntitlements(claims.userId);
    let rows = await prisma.overlayToken.findMany({ where: { userId: claims.userId, revoked: false }, orderBy: { createdAt: 'desc' } });
    // ยังไม่มีลิงก์เลย → สร้างชุดแรกให้อัตโนมัติ ทุกหน้ามีปุ่มคัดลอกทันที (ไม่ต้องไปกดสร้างเอง)
    if (rows.length === 0 && ent.maxTokens > 0) {
      const user = await prisma.user.findUnique({ where: { id: claims.userId }, select: { tiktokUsername: true } });
      if (user?.tiktokUsername) rows = [await prisma.overlayToken.create({ data: { userId: claims.userId, token: randomBytes(12).toString('hex'), label: 'ลิงก์หลัก' } })];
    }
    const tokens = rows.map((r) => {
      const jwtToken = signOverlayToken({ tid: r.id, userId: claims.userId }, r.createdAt);
      return { id: r.id, label: r.label, createdAt: r.createdAt, urls: widgetUrls(jwtToken, ent.widgets) };
    });
    return { tokens, maxTokens: ent.maxTokens };
  });

  // สร้าง overlay token + คืน URL พร้อมใช้สำหรับ OBS
  app.post('/api/overlay-tokens', { preHandler: requireUser }, async (req, reply) => {
    const claims = getUser(req)!;
    const user = await prisma.user.findUnique({ where: { id: claims.userId } });
    if (!user?.tiktokUsername) return reply.code(400).send({ error: 'ยังไม่ได้ตั้งชื่อ TikTok — ไปตั้งที่หน้าโปรไฟล์ก่อน' });

    const ent = await getEntitlements(user.id);
    const count = await prisma.overlayToken.count({ where: { userId: user.id, revoked: false } });
    if (count >= ent.maxTokens) return reply.code(403).send({ error: `แพลน ${ent.plan} สร้างลิงก์ได้สูงสุด ${ent.maxTokens} ชุด — ลบอันเก่าหรืออัปเกรด`, upgrade: true });

    const label = z.string().trim().max(60).optional().catch(undefined).parse((req.body as { label?: unknown })?.label);
    const record = await prisma.overlayToken.create({ data: { userId: user.id, token: randomBytes(12).toString('hex'), label } });
    const jwtToken = signOverlayToken({ tid: record.id, userId: user.id }, record.createdAt);
    return reply.code(201).send({ id: record.id, label: record.label, createdAt: record.createdAt, urls: widgetUrls(jwtToken, ent.widgets) });
  });

  // เพิกถอน token (overlay ที่ใช้ลิงก์นี้จะต่อไม่ได้อีก)
  app.delete('/api/overlay-tokens/:id', { preHandler: requireUser }, async (req, reply) => {
    const claims = getUser(req)!;
    const id = (req.params as { id: string }).id;
    const res = await prisma.overlayToken.updateMany({ where: { id, userId: claims.userId, revoked: false }, data: { revoked: true } });
    if (!res.count) return reply.code(404).send({ error: 'ไม่พบลิงก์นี้' });
    return { ok: true };
  });

  // ตั้งค่าทุก widget ของผู้ใช้ในครั้งเดียว (การ์ดตัวอย่างในหน้าวิดเจ็ตแสดงตามที่บันทึกไว้)
  app.get('/api/widgets/configs', { preHandler: requireUser }, async (req) => {
    const rows = await prisma.widgetConfig.findMany({ where: { userId: getUser(req)!.userId, NOT: { type: { startsWith: '_' } } }, select: { type: true, settings: true } });
    return { configs: Object.fromEntries(rows.map((r) => [r.type, r.settings ?? {}])) };
  });

  // อ่าน/บันทึกตั้งค่า widget
  app.get('/api/widgets/:type/config', { preHandler: requireUser }, async (req, reply) => {
    const claims = getUser(req)!;
    const type = (req.params as { type: string }).type;
    if (!isWidgetType(type)) return reply.code(400).send({ error: 'ชนิด widget ไม่ถูกต้อง' });
    const cfg = await prisma.widgetConfig.findUnique({ where: { userId_type: { userId: claims.userId, type } } });
    return { config: cfg?.settings ?? {} };
  });

  app.put('/api/widgets/:type/config', { preHandler: requireUser }, async (req, reply) => {
    const claims = getUser(req)!;
    const type = (req.params as { type: string }).type;
    if (!isWidgetType(type)) return reply.code(400).send({ error: 'ชนิด widget ไม่ถูกต้อง' });
    const parsed = z.record(z.unknown()).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'ตั้งค่าไม่ถูกต้อง' });
    const settings = parsed.data as Prisma.InputJsonValue;
    const cfg = await prisma.widgetConfig.upsert({
      where: { userId_type: { userId: claims.userId, type } },
      create: { userId: claims.userId, type, settings },
      update: { settings },
    });
    getHub()?.pushConfig(claims.userId, type, cfg.settings);
    return { config: cfg.settings };
  });
}
