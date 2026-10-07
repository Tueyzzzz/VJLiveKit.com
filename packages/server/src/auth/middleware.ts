import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifySession, type SessionClaims } from './service.js';
import { isSuspended } from '../admin/store.js';

/** ดึง user จาก Authorization: Bearer <session jwt> */
export function getUser(req: FastifyRequest): SessionClaims | null {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return null;
  return verifySession(h.slice(7));
}

/** preHandler: บังคับว่าต้องล็อกอิน แนบ req.user ให้ด้วย */
export async function requireUser(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = getUser(req);
  if (!user) {
    await reply.code(401).send({ error: 'ต้องเข้าสู่ระบบก่อน' });
    return;
  }
  if (isSuspended(user.userId)) { // แอดมินระงับบัญชี
    await reply.code(403).send({ error: 'บัญชีนี้ถูกระงับการใช้งาน — ติดต่อทีมงาน VJLiveKit' });
    return;
  }
  (req as FastifyRequest & { user: SessionClaims }).user = user;
}
