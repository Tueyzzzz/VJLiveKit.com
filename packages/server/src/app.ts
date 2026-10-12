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
import { referralRoutes } from './referrals/routes.js';
import { adminRoutes } from './admin/routes.js';
import { donateRoutes } from './donate/routes.js';
import { mediaRoutes } from './media/routes.js';
import { vjavRoutes } from './media/vjav.js';
import { avatarRoutes } from './tiktok/avatar.js';
import { notificationRoutes } from './admin/notifications.js';
import { supportRoutes } from './support/routes.js';
import { mailRoutes } from './mail/routes.js';
import { mascotRoutes } from './mascots/routes.js';
import { beatpadRoutes } from './media/beatpad.js';
import { errlogRoutes, installErrorHooks } from './errlog/routes.js';
import { statsRoutes } from './stats/routes.js';
import { installErrorCapture } from './errlog/store.js';
import { settings } from './settings/index.js';
import { config } from './config/index.js';
import { prisma } from './db/prisma.js';
import { OVERLAY_DIR, OVERLAY_VERSION } from './overlay-version.js';
import { runtime } from './runtime.js';
import { listGifts } from './tiktok/giftCatalog.js';

/** ที่อยู่ไฟล์ Dashboard (Next.js static export) */
const DASHBOARD_DIR = config.dashboardDir ?? path.resolve(process.cwd(), '../dashboard/out');

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true, trustProxy: true });

  installErrorCapture(); // crash / console.error → data/errors (เก็บ 3 วัน)
  installErrorHooks(app); // API 500+ → data/errors
  await app.register(cors, { origin: true });
  // เรทลิมิต: ทุก /api/* ต่อ IP 300 ครั้ง/นาที (route สำคัญเช่น login/register ตั้งเข้มกว่านี้เอง)
  // ไฟล์ overlay/หน้าเว็บไม่นับ — OBS โหลดรูป/สคริปต์หลายไฟล์พร้อมกัน
  await app.register(rateLimit, { global: true, max: 300, timeWindow: '1 minute', allowList: (req) => !req.url.startsWith('/api/') });

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

  // หน้า overlay (.html): ฝังเลขเวอร์ชันในหน้า + ต่อ ?v= ให้ไฟล์ js → แอปที่จำแคชเก่า (TikTok Live Studio) รู้ตัวว่าเก่าแล้วโหลดใหม่ได้
  app.get<{ Params: { page: string } }>('/overlay/:page', async (req, reply) => {
    const { page } = req.params;
    reply.header('cache-control', 'no-cache, no-store, must-revalidate');
    if (!/^[\w-]+\.html$/.test(page)) return reply.sendFile(page);
    // วิดเจ็ตที่ใช้ไฟล์เดียวกันแต่ค่าเริ่มต้นต่างกัน (ลิงก์/ตั้งค่า/ข้อมูลแยกกัน)
    const ALIAS: Record<string, { file: string; defaults: Record<string, string> }> = {
      'tree.html': { file: 'garden.html', defaults: { skin: 'tree' } },
      'belly.html': { file: 'giftjar.html', defaults: { shape: 'pig' } },
      'snowglobe.html': { file: 'giftjar.html', defaults: { shape: 'snow' } },
      'spacedome.html': { file: 'giftjar.html', defaults: { shape: 'smoon' } },
      'aquarium.html': { file: 'giftjar.html', defaults: { shape: 'tank' } },
      'vehicle.html': { file: 'dragcar.html', defaults: {} },
    };
    const alias = ALIAS[page];
    let html: string;
    try { html = await fs.promises.readFile(path.join(OVERLAY_DIR, alias ? alias.file : page), 'utf8'); }
    catch { return reply.code(404).send({ error: 'ไม่พบ' }); }
    html = html.replace(/src="(js\/[\w.-]+\.js)"/g, `src="$1?v=${OVERLAY_VERSION}"`)
      .replace(/href="(css\/[\w.-]+\.css)"/g, `href="$1?v=${OVERLAY_VERSION}"`) // css ใหม่ไม่ค้างแคช (ธีมป้ายไฟ)
      .replace('<script', `<script>window.VJL_VERSION=${JSON.stringify(OVERLAY_VERSION)}${alias ? `;window.VJL_DEFAULTS=${JSON.stringify(alias.defaults)}` : ''}</script>
  <script`);
    return reply.type('text/html; charset=utf-8').send(html);
  });

  // เสิร์ฟ Dashboard ที่ / (ถ้า build แล้ว)
  const hasDashboard = fs.existsSync(path.join(DASHBOARD_DIR, 'index.html'));
  if (hasDashboard) {
    await app.register(fastifyStatic, { root: DASHBOARD_DIR, prefix: '/', decorateReply: false, wildcard: true });
  } else {
    app.log.warn(`ไม่พบ Dashboard ที่ ${DASHBOARD_DIR} — เสิร์ฟเฉพาะ API/overlay`);
  }

  // คลังของขวัญ (ชื่อ/รูป/ราคา) สำหรับดรอปดาวน์เลือกกิฟต์
  app.get('/api/gifts', async () => ({ gifts: listGifts() }));

  // เวอร์ชันแดชบอร์ดที่เสิร์ฟอยู่ (ชื่อโฟลเดอร์ _next/static/<buildId>) — หน้าเว็บที่เปิดค้างไว้ใช้เช็กแล้วโหลดใหม่เอง
  let dashBuild = '';
  try { dashBuild = fs.readdirSync(path.join(DASHBOARD_DIR, '_next/static')).find((d) => !['chunks', 'media', 'css'].includes(d)) ?? ''; } catch { /* ยังไม่ได้ build */ }
  app.get('/api/version', async (_req, reply) => { reply.header('cache-control', 'no-store'); return { dashboard: dashBuild, commit: process.env.APP_COMMIT ?? 'dev' }; });

  // ค่าสาธารณะจากหน้าตั้งค่าระบบ (ประกาศบนแดชบอร์ด · วันทดลองฟรี)
  app.get('/api/settings/public', async () => ({ announcement: settings().announcement, trialDays: settings().trialDays }));

  // liveOthers = ไลฟ์ที่ไม่ใช่บัญชีแอดมิน (Deploy อัตโนมัติรอให้ค่านี้เป็น 0 — แอดมินไลฟ์ทดสอบอยู่ก็ Deploy ได้)
  let adminTiktok: { at: number; names: Set<string> } = { at: 0, names: new Set() };
  app.get('/healthz', async () => {
    if (Date.now() - adminTiktok.at > 60_000 && config.adminEmails.length) {
      const us = await prisma.user.findMany({ where: { email: { in: config.adminEmails } }, select: { tiktokUsername: true } }).catch(() => []);
      adminTiktok = { at: Date.now(), names: new Set(us.map((u) => (u.tiktokUsername ?? '').toLowerCase().replace(/^@/, '')).filter(Boolean)) };
    }
    const names = runtime.liveUsernames();
    return { ok: true, live: runtime.liveRooms(), liveOthers: names.filter((n) => !adminTiktok.names.has(n.toLowerCase().replace(/^@/, ''))).length };
  });

  await app.register(authRoutes);
  await app.register(widgetRoutes);
  await app.register(billingRoutes);
  await app.register(actionRoutes);
  await app.register(ttsRoutes);
  await app.register(referralRoutes);
  await app.register(adminRoutes);
  await app.register(mailRoutes);
  await app.register(donateRoutes);
  await app.register(mediaRoutes);
  await app.register(vjavRoutes);
  await app.register(avatarRoutes);
  await app.register(notificationRoutes);
  await app.register(supportRoutes);
  await app.register(mascotRoutes);
  await app.register(beatpadRoutes);
  await app.register(errlogRoutes);
  await app.register(statsRoutes);

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
