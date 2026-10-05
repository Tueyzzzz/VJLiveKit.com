import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { hashPassword, verifyPassword, signSession } from './service.js';
import { requireUser, getUser } from './middleware.js';
import { getEntitlements } from '../plans/index.js';
import { recordReferral, checkReferralReward } from '../referrals/routes.js';
import { isAdmin } from '../admin/routes.js';
import { getHub } from '../realtime/hub.js';

/** ชื่อ TikTok: ตัวอักษร/ตัวเลข/จุด/ขีดล่าง (ตัด @ นำหน้าให้) */
const tiktokUsernameSchema = z.string().trim().transform((s) => s.replace(/^@/, ''))
  .pipe(z.string().regex(/^[A-Za-z0-9._]{2,24}$/, 'ชื่อ TikTok ไม่ถูกต้อง'));

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  tiktokUsername: tiktokUsernameSchema.nullable().optional(),
});

const publicUser = {
  id: true, email: true, displayName: true, tiktokUsername: true, role: true, createdAt: true,
  subscription: { select: { status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true, provider: true, plan: { select: { code: true, name: true } } } },
} as const;

const credsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).optional(),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // สมัครสมาชิก
  app.post('/api/auth/register', { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } }, async (req, reply) => {
    const parsed = credsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'ข้อมูลไม่ถูกต้อง', issues: parsed.error.issues });
    const { email, password, displayName } = parsed.data;

    const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (exists) return reply.code(409).send({ error: 'อีเมลนี้ถูกใช้แล้ว' });

    const user = await prisma.user.create({
      data: { email: email.toLowerCase(), passwordHash: await hashPassword(password), displayName },
    });
    await recordReferral(user.id, (req.body as { ref?: unknown } | undefined)?.ref); // สมัครผ่านลิงก์แนะนำ
    const token = signSession({ userId: user.id, email: user.email, role: user.role });
    return reply.code(201).send({ token, user: { id: user.id, email: user.email, displayName: user.displayName } });
  });

  // เข้าสู่ระบบ
  app.post('/api/auth/login', { config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const parsed = credsSchema.pick({ email: true, password: true }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'ข้อมูลไม่ถูกต้อง' });
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      return reply.code(401).send({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }
    const remember = (req.body as { remember?: boolean } | undefined)?.remember !== false; // ค่าเริ่มต้น = จำไว้
    const token = signSession({ userId: user.id, email: user.email, role: user.role }, remember ? '90d' : '1d');
    return reply.send({ token, user: { id: user.id, email: user.email, displayName: user.displayName } });
  });

  // ข้อมูลผู้ใช้ปัจจุบัน + สิทธิ์ตามแพลน
  app.get('/api/auth/me', { preHandler: requireUser }, async (req, reply) => {
    const claims = getUser(req)!;
    const user = await prisma.user.findUnique({ where: { id: claims.userId }, select: publicUser });
    if (!user) return reply.code(401).send({ error: 'ไม่พบผู้ใช้' });
    return { user, entitlements: await getEntitlements(user.id), isAdmin: isAdmin(req) };
  });

  // แก้โปรไฟล์ (ชื่อที่แสดง, ชื่อ TikTok ที่จะเชื่อมไลฟ์)
  // เปลี่ยนรหัสผ่าน (ต้องยืนยันรหัสเดิม)
  app.post('/api/auth/password', { preHandler: requireUser, config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const claims = getUser(req)!;
    const b = (req.body ?? {}) as { current?: string; next?: string };
    if (typeof b.next !== 'string' || b.next.length < 8) return reply.code(400).send({ error: 'รหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร' });
    const user = await prisma.user.findUnique({ where: { id: claims.userId }, select: { passwordHash: true } });
    if (!user) return reply.code(401).send({ error: 'ไม่พบผู้ใช้' });
    if (user.passwordHash && !(await verifyPassword(String(b.current ?? ''), user.passwordHash))) {
      return reply.code(400).send({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
    }
    await prisma.user.update({ where: { id: claims.userId }, data: { passwordHash: await hashPassword(b.next) } });
    return { ok: true };
  });

  app.patch('/api/auth/me', { preHandler: requireUser }, async (req, reply) => {
    const claims = getUser(req)!;
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' });
    const d = parsed.data;
    const before = await prisma.user.findUnique({ where: { id: claims.userId }, select: { tiktokUsername: true } });
    const user = await prisma.user.update({
      where: { id: claims.userId },
      data: {
        ...(d.displayName !== undefined ? { displayName: d.displayName } : {}),
        ...(d.tiktokUsername !== undefined ? { tiktokUsername: d.tiktokUsername } : {}),
      },
      select: publicUser,
    });
    // เปลี่ยนชื่อ TikTok -> ล้างแคชกฎของทั้งชื่อเก่าและใหม่
    if (before?.tiktokUsername) getHub()?.invalidateRules(before.tiktokUsername);
    if (user.tiktokUsername) getHub()?.invalidateRules(user.tiktokUsername);
    if (user.tiktokUsername && !before?.tiktokUsername) void checkReferralReward(claims.userId); // ตั้งชื่อ TikTok ครั้งแรก → นับเป็นเพื่อนที่แนะนำสำเร็จ
    return { user };
  });
}
