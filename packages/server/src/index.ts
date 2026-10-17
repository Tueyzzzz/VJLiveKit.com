import fs from 'node:fs';
import path from 'node:path';
import { flushCollect } from './tiktok/collectStore.js';
import { flushLiveStats } from './realtime/livestats.js';
import { buildApp } from './app.js';
import { setupRealtime } from './realtime/socket.js';
import { config } from './config/index.js';
import { disconnectDb, prisma } from './db/prisma.js';
import { ensurePlans, getPlans, savePlans, DEFAULT_PLANS } from './plans/index.js';
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
  // แยกลิงก์ PK ออกจาก FX: ลูกค้าที่มีกฎ PK อยู่ก่อนแล้ว → ลิงก์ FX ยังเล่น PK เหมือนเดิม (pkmain=1) ไม่ให้ PK หายกลางไลฟ์ · ทำครั้งเดียว
  try {
    const mark = path.join(process.env.SNAPSHOT_DIR ? path.dirname(process.env.SNAPSHOT_DIR) : path.resolve(process.cwd(), '../../data'), 'migrate-pkmain.done');
    if (!fs.existsSync(mark)) {
      const rows = await prisma.actionRule.findMany({ where: { trigger: { path: ['event'], equals: 'pk' } }, select: { userId: true }, distinct: ['userId'] });
      for (const { userId } of rows) {
        const cur = await prisma.widgetConfig.findUnique({ where: { userId_type: { userId, type: 'fx' } }, select: { settings: true } });
        const s = (cur?.settings ?? {}) as Record<string, unknown>;
        if (s.pkmain != null) continue;
        const next = { ...s, pkmain: '1' };
        await prisma.widgetConfig.upsert({ where: { userId_type: { userId, type: 'fx' } }, create: { userId, type: 'fx', settings: next }, update: { settings: next } });
      }
      fs.mkdirSync(path.dirname(mark), { recursive: true }); fs.writeFileSync(mark, new Date().toISOString());
      console.log(`[migrate] pkmain: ลิงก์ FX ยังเล่น PK ให้ลูกค้าเดิม ${rows.length} คน`);
    }
  } catch (err) { console.warn('[migrate] pkmain failed', (err as Error).message); }

  // วิดเจ็ตใหม่ (เกมชักเย่อ): แพลนที่แอดมินเคยบันทึกรายการวิดเจ็ตไว้ → เพิ่มให้ตามค่าเริ่มต้นของแพลนนั้น · ทำครั้งเดียว (ถอดออกเองภายหลังได้)
  try {
    const mark = path.join(process.env.SNAPSHOT_DIR ? path.dirname(process.env.SNAPSHOT_DIR) : path.resolve(process.cwd(), '../../data'), 'migrate-tugwar.done');
    if (!fs.existsSync(mark)) {
      const plans = getPlans(), add = plans.filter((p) => DEFAULT_PLANS.find((d) => d.code === p.code)?.features.widgets.includes('tugwar') && !p.features.widgets.includes('tugwar'));
      if (add.length) await savePlans(add.map((p) => ({ ...p, features: { ...p.features, widgets: [...p.features.widgets, 'tugwar'] } }))); // บันทึกเฉพาะแพลนที่ขาด (ไม่แช่แข็งแพลนอื่น)
      fs.mkdirSync(path.dirname(mark), { recursive: true }); fs.writeFileSync(mark, new Date().toISOString());
      console.log(`[migrate] tugwar: เพิ่มเกมชักเย่อให้ ${add.length} แพลน`);
    }
  } catch (err) { console.warn('[migrate] tugwar failed', (err as Error).message); }

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
