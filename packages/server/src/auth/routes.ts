import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { hashPassword, verifyPassword, signSession } from './service.js';
import { requireUser, getUser } from './middleware.js';

const credsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).optional(),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // สมัครสมาชิก
  app.post('/api/auth/register', async (req, reply) => {
    const parsed = credsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'ข้อมูลไม่ถูกต้อง', issues: parsed.error.issues });
    const { email, password, displayName } = parsed.data;

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return reply.code(409).send({ error: 'อีเมลนี้ถูกใช้แล้ว' });

    const user = await prisma.user.create({
      data: { email, passwordHash: await hashPassword(password), displayName },
    });
    const token = signSession({ userId: user.id, email: user.email, role: user.role });
    return reply.code(201).send({ token, user: { id: user.id, email: user.email, displayName: user.displayName } });
  });

  // เข้าสู่ระบบ
  app.post('/api/auth/login', async (req, reply) => {
    const parsed = credsSchema.pick({ email: true, password: true }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'ข้อมูลไม่ถูกต้อง' });
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      return reply.code(401).send({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }
    const token = signSession({ userId: user.id, email: user.email, role: user.role });
    return reply.send({ token, user: { id: user.id, email: user.email, displayName: user.displayName } });
  });

  // ข้อมูลผู้ใช้ปัจจุบัน
  app.get('/api/auth/me', { preHandler: requireUser }, async (req) => {
    const claims = getUser(req)!;
    const user = await prisma.user.findUnique({
      where: { id: claims.userId },
      include: { subscription: { include: { plan: true } } },
    });
    return { user };
  });
}
