import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requireUser, getUser } from '../auth/middleware.js';
import { isAdmin } from '../admin/routes.js';
import { getMailConfig, saveMailConfig, sendMailDetailed, mailEnabled } from './send.js';

async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  await requireUser(req, reply);
  if (reply.sent) return;
  if (!isAdmin(req)) await reply.code(403).send({ error: 'สำหรับแอดมินเท่านั้น' });
}

const MASK = '••••••••';
/** ไม่ส่งรหัสผ่าน/คีย์จริงกลับไปหน้าเว็บ — ส่งแค่ว่าตั้งไว้แล้ว */
const pub = () => { const c = getMailConfig(); return { ...c, smtpPass: c.smtpPass ? MASK : '', resendKey: c.resendKey ? MASK : '', enabled: mailEnabled() }; };

const schema = z.object({
  provider: z.enum(['off', 'smtp', 'resend']),
  from: z.string().trim().max(200).default(''),
  smtpHost: z.string().trim().max(200).default(''),
  smtpPort: z.coerce.number().int().min(1).max(65535).default(587),
  smtpSecure: z.boolean().default(false),
  smtpUser: z.string().trim().max(200).default(''),
  smtpPass: z.string().max(500).default(''),
  resendKey: z.string().trim().max(500).default(''),
});

export async function mailRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/admin/mail', { preHandler: requireAdmin }, async () => ({ mail: pub() }));
  app.put('/api/admin/mail', { preHandler: requireAdmin }, async (req, reply) => {
    const p = schema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: 'ข้อมูลไม่ถูกต้อง' });
    const old = getMailConfig(), d = p.data;
    saveMailConfig({ ...d, smtpPass: d.smtpPass === MASK ? old.smtpPass : d.smtpPass, resendKey: d.resendKey === MASK ? old.resendKey : d.resendKey });
    return { mail: pub() };
  });
  // ส่งอีเมลทดสอบไปที่อีเมลแอดมินเอง (หรือที่ระบุ)
  app.post('/api/admin/mail/test', { preHandler: requireAdmin, config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (req) => {
    const to = String((req.body as { to?: string } | undefined)?.to || getUser(req)!.email);
    return sendMailDetailed(to, 'ทดสอบอีเมล — VJLiveKit', '<div style="font-family:sans-serif;padding:20px"><h2 style="color:#ff4f9a">ส่งอีเมลได้แล้ว ✓</h2><p>เมลเซิร์ฟเวอร์ของ VJLiveKit พร้อมใช้งาน (ลืมรหัสผ่านจะส่งลิงก์ทางอีเมลนี้)</p></div>');
  });
}
