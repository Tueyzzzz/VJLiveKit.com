import { flushCollect } from './tiktok/collectStore.js';
import { flushLiveStats } from './realtime/livestats.js';
import { buildApp } from './app.js';
import { setupRealtime } from './realtime/socket.js';
import { config } from './config/index.js';
import { disconnectDb, prisma } from './db/prisma.js';
import { ensurePlans } from './plans/index.js';
import { runtime } from './runtime.js';

async function main(): Promise<void> {
  if (config.isProd && (config.jwtSecret === 'dev-insecure-secret' || config.jwtSecret.length < 32)) {
    throw new Error('JWT_SECRET ต้องตั้งค่าและยาวอย่างน้อย 32 ตัวอักษรใน production');
  }
  // sync แพลน Free/Pro ลง DB (ไม่ต้องรัน seed เอง)
  await ensurePlans();
  // ลูกค้าเก่าที่ไม่ได้กรอกชื่อที่แสดง → ใช้ชื่อ TikTok แทน (ทำครั้งเดียว ไม่แตะคนที่มีชื่อแล้ว)
  try {
    const noName = await prisma.user.findMany({ where: { OR: [{ displayName: null }, { displayName: '' }], tiktokUsername: { not: null } }, select: { id: true, tiktokUsername: true } });
    for (const u of noName) await prisma.user.update({ where: { id: u.id }, data: { displayName: u.tiktokUsername } });
    if (noName.length) console.log(`[users] ตั้งชื่อที่แสดงจากชื่อ TikTok ให้ ${noName.length} บัญชี`);
  } catch (err) { console.warn('[users] backfill displayName failed', (err as Error).message); }

  const app = await buildApp();
  await app.ready();

  // ผูก Socket.IO เข้ากับ HTTP server ตัวเดียวกับ Fastify
  const hub = setupRealtime(app.server);
  runtime.liveRooms = () => hub.liveCount();
  runtime.liveUsernames = () => hub.liveUsernames();

  await app.listen({ port: config.port, host: '0.0.0.0' });

  app.log.info(`VJLiveKit server :${config.port} (demo=${config.demoMode})`);
  if (!config.demoMode) hub.warmUp(); // deploy: ต่อห้องที่ไลฟ์อยู่ล่วงหน้า กันของขวัญหายช่วงสลับเซิร์ฟเวอร์

  // ปิดอย่างนุ่มนวล
  const shutdown = async (sig: string) => {
    app.log.info(`received ${sig}, shutting down...`);
    await hub.stopAll();
    flushCollect(); // กองของขวัญสะสมที่ยังไม่ลงดิสก์
    try { flushLiveStats(); } catch { /* ignore */ } // สถิติไลฟ์รายนาที
    await app.close();
    await disconnectDb();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
