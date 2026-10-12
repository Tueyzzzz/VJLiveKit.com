import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { hashPassword, verifyPassword, signSession, signPasswordReset, verifyPasswordReset, resetFingerprint } from './service.js';
import { sendMail } from '../mail/send.js';
import { config } from '../config/index.js';
import { requireUser, getUser } from './middleware.js';
import { getEntitlements, trialEndOf } from '../plans/index.js';
import { recordReferral, checkReferralReward } from '../referrals/routes.js';
import { isAdmin } from '../admin/routes.js';
import { getHub } from '../realtime/hub.js';
import { supportNotice } from '../support/routes.js';

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

  // ลืมรหัสผ่าน: ส่งลิงก์ตั้งรหัสใหม่ทางอีเมล (อายุ 30 นาที ใช้ได้ครั้งเดียว) · ยังไม่ตั้งค่าอีเมล → ส่งคำขอเข้าแชทแอดมินแทน
  // ตอบเหมือนกันเสมอ ไม่บอกว่าอีเมลนี้มีบัญชีหรือไม่
  app.post('/api/auth/forgot', { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } }, async (req, reply) => {
    const parsed = z.object({ email: z.string().trim().email().max(200) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'กรอกอีเมลให้ถูกต้อง' });
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() }, select: { id: true, email: true, passwordHash: true, displayName: true } });
    if (!user) { req.log.info({ email: parsed.data.email }, 'forgot-password: no such user'); return reply.send({ ok: true }); }
    const link = `${config.publicBaseUrl}/reset-password/?token=${encodeURIComponent(signPasswordReset(user.id, user.passwordHash))}`;
    const sent = await sendMail(user.email, 'ตั้งรหัสผ่านใหม่ — VJLiveKit', `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;color:#3d2f45">
        <h2 style="color:#ff4f9a">ตั้งรหัสผ่านใหม่</h2>
        <p>สวัสดีค่ะ${user.displayName ? ' ' + escapeHtml(user.displayName) : ''} — มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชี ${escapeHtml(user.email)}</p>
        <p style="margin:28px 0"><a href="${link}" style="background:#ff4f9a;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">ตั้งรหัสผ่านใหม่</a></p>
        <p style="font-size:13px;color:#8a7a95">ลิงก์ใช้ได้ 30 นาที และใช้ได้ครั้งเดียว · ถ้าไม่ได้ขอ ไม่ต้องทำอะไร รหัสเดิมยังใช้ได้ตามปกติ</p>
      </div>`);
    if (!sent) await supportNotice(user.id, '🔑 ขอรีเซ็ตรหัสผ่าน (จากหน้าเข้าสู่ระบบ — ระบบอีเมลยังไม่พร้อม)\n→ แอดมิน: เปิดข้อมูลลูกค้า กด "รีเซ็ตรหัส" แล้วส่งรหัสชั่วคราวให้ทางอีเมล ' + user.email);
    return reply.send({ ok: true });
  });

  // ตั้งรหัสผ่านใหม่จากลิงก์ในอีเมล → เข้าสู่ระบบให้เลย
  app.post('/api/auth/reset', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const parsed = z.object({ token: z.string().min(10).max(2000), password: z.string().min(8).max(200) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' });
    const claims = verifyPasswordReset(parsed.data.token);
    const user = claims && await prisma.user.findUnique({ where: { id: claims.uid } });
    if (!user || claims.ph !== resetFingerprint(user.passwordHash)) return reply.code(400).send({ error: 'ลิงก์หมดอายุหรือถูกใช้ไปแล้ว — กดลืมรหัสผ่านเพื่อขอลิงก์ใหม่' });
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.password) } });
    return reply.send({ token: signSession({ userId: user.id, email: user.email, role: user.role }) });
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
    if (user.tiktokUsername) trialEndOf(user.createdAt, user.tiktokUsername); // บันทึกประวัติทดลองต่อ TikTok (TikTok เดิมบนบัญชีใหม่ = ได้แค่วันที่เหลือ)
    if (user.tiktokUsername && !before?.tiktokUsername) void checkReferralReward(claims.userId); // ตั้งชื่อ TikTok ครั้งแรก → นับเป็นเพื่อนที่แนะนำสำเร็จ
    return { user };
  });
}

const escapeHtml = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
