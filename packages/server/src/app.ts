import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { authRoutes } from './auth/routes.js';
import { widgetRoutes } from './widgets/routes.js';
import { billingRoutes } from './billing/routes.js';
import { actionRoutes } from './actions/routes.js';

/** ที่อยู่โฟลเดอร์ overlay (เสิร์ฟไฟล์วิดเจ็ตให้ OBS) */
const OVERLAY_DIR = process.env.OVERLAY_DIR ?? path.resolve(process.cwd(), '../overlay/public');

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  // เก็บ raw body ไว้ด้วย (ใช้ตรวจลายเซ็น webhook ของ payment gateway)
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    (req as unknown as { rawBody: Buffer }).rawBody = body as Buffer;
    try { done(null, JSON.parse((body as Buffer).toString() || '{}')); }
    catch (err) { done(err as Error, undefined); }
  });

  // เสิร์ฟหน้า overlay (เช่น /overlay/coinjar.html)
  await app.register(fastifyStatic, { root: OVERLAY_DIR, prefix: '/overlay/' });

  app.get('/healthz', async () => ({ ok: true }));

  await app.register(authRoutes);
  await app.register(widgetRoutes);
  await app.register(billingRoutes);
  await app.register(actionRoutes);

  return app;
}
