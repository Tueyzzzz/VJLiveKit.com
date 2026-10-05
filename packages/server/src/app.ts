import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import { authRoutes } from './auth/routes.js';
import { widgetRoutes } from './widgets/routes.js';
import { billingRoutes } from './billing/routes.js';
import { actionRoutes } from './actions/routes.js';
import { ttsRoutes } from './tts/routes.js';
import { config } from './config/index.js';
import { OVERLAY_DIR } from './overlay-version.js';

/** ที่อยู่ไฟล์ Dashboard (Next.js static export) */
const DASHBOARD_DIR = config.dashboardDir ?? path.resolve(process.cwd(), '../dashboard/out');

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true, trustProxy: true });

  await app.register(cors, { origin: true });
  // จำกัดความถี่เฉพาะ route ที่ระบุ (เช่น login/register) — กัน brute force
  await app.register(rateLimit, { global: false });

  // เก็บ raw body ไว้ด้วย (ใช้ตรวจลายเซ็น webhook ของ payment gateway)
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    (req as unknown as { rawBody: Buffer }).rawBody = body as Buffer;
    try { done(null, JSON.parse((body as Buffer).toString() || '{}')); }
    catch (err) { (err as { statusCode?: number }).statusCode = 400; done(err as Error, undefined); }
  });

  // เสิร์ฟหน้า overlay (เช่น /overlay/coinjar.html)
  // ไม่ให้ OBS / TikTok Live Studio จำไฟล์เก่า (โหลดใหม่ = ได้เวอร์ชันล่าสุดเสมอ)
  await app.register(fastifyStatic, {
    root: OVERLAY_DIR, prefix: '/overlay/', cacheControl: false,
    setHeaders: (res) => { res.setHeader('cache-control', 'no-cache, no-store, must-revalidate'); },
  });

  // เสิร์ฟ Dashboard ที่ / (ถ้า build แล้ว)
  const hasDashboard = fs.existsSync(path.join(DASHBOARD_DIR, 'index.html'));
  if (hasDashboard) {
    await app.register(fastifyStatic, { root: DASHBOARD_DIR, prefix: '/', decorateReply: false, wildcard: true });
  } else {
    app.log.warn(`ไม่พบ Dashboard ที่ ${DASHBOARD_DIR} — เสิร์ฟเฉพาะ API/overlay`);
  }

  app.get('/healthz', async () => ({ ok: true }));

  await app.register(authRoutes);
  await app.register(widgetRoutes);
  await app.register(billingRoutes);
  await app.register(actionRoutes);
  await app.register(ttsRoutes);

  // 404: API ตอบ JSON, หน้าเว็บตอบหน้า 404 ของ Dashboard
  const notFoundPage = path.join(DASHBOARD_DIR, '404.html');
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/') || req.url.startsWith('/overlay/') || !hasDashboard || !fs.existsSync(notFoundPage)) {
      return reply.code(404).send({ error: 'ไม่พบ' });
    }
    return reply.code(404).type('text/html; charset=utf-8').send(fs.createReadStream(notFoundPage));
  });

  return app;
}
