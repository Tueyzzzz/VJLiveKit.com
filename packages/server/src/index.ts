import { buildApp } from './app.js';
import { setupRealtime } from './realtime/socket.js';
import { config } from './config/index.js';
import { disconnectDb } from './db/prisma.js';

async function main(): Promise<void> {
  const app = await buildApp();
  await app.ready();

  // ผูก Socket.IO เข้ากับ HTTP server ตัวเดียวกับ Fastify
  const hub = setupRealtime(app.server);

  await app.listen({ port: config.port, host: '0.0.0.0' });

  app.log.info(`VJLiveKit server :${config.port} (demo=${config.demoMode})`);

  // ปิดอย่างนุ่มนวล
  const shutdown = async (sig: string) => {
    app.log.info(`received ${sig}, shutting down...`);
    await hub.stopAll();
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
