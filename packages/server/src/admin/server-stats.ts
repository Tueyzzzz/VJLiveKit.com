import os from 'node:os';
import fs from 'node:fs';
import { prisma } from '../db/prisma.js';

/** ตัวนับจาก socket.ts (เชื่อมต่อ/ถูกปฏิเสธ/IP ที่โดนแบน) — อ่านไปโชว์หน้าแอดมิน */
export const socketStats = {
  open: 0,
  rejected: 0, // ถูกปฏิเสธเพราะเกินลิมิต (นับสะสมตั้งแต่เปิดเซิร์ฟเวอร์)
  banned: new Map<string, number>(), // ip → แบนถึงเวลา
};

// CPU %: เทียบเวลา idle/total ระหว่างสองครั้งที่อ่าน
let lastCpu = os.cpus().map((c) => c.times);
function cpuPercent(): number {
  const now = os.cpus().map((c) => c.times);
  let idle = 0, total = 0;
  now.forEach((t, i) => {
    const p = lastCpu[i] ?? t;
    const d = (k: keyof typeof t) => t[k] - p[k];
    const tot = d('user') + d('nice') + d('sys') + d('idle') + d('irq');
    idle += d('idle'); total += tot;
  });
  lastCpu = now;
  return total > 0 ? Math.round((1 - idle / total) * 100) : 0;
}

/** สุขภาพเครื่อง: CPU / RAM / ดิสก์ / แอป / ฐานข้อมูล / การเชื่อมต่อ */
export async function serverStats(extra: { rooms: number; liveRooms: number }) {
  const mem = process.memoryUsage();
  let disk: { total: number; free: number } | null = null;
  try { const s = fs.statfsSync('/'); disk = { total: s.blocks * s.bsize, free: s.bavail * s.bsize }; } catch { /* ไม่รองรับ */ }
  const t0 = Date.now();
  let dbMs: number | null = null;
  try { await prisma.$queryRaw`SELECT 1`; dbMs = Date.now() - t0; } catch { dbMs = null; }
  const now = Date.now();
  const banned = [...socketStats.banned.entries()].filter(([, until]) => until > now).map(([ip, until]) => ({ ip: ip.replace(/\.\d+$/, '.x'), minutesLeft: Math.ceil((until - now) / 60_000) }));
  return {
    host: { cpus: os.cpus().length, cpu: cpuPercent(), load: os.loadavg().map((n) => +n.toFixed(2)), memTotal: os.totalmem(), memFree: os.freemem(), uptime: os.uptime() },
    disk,
    app: { rss: mem.rss, heapUsed: mem.heapUsed, uptime: process.uptime(), node: process.version, commit: process.env.APP_COMMIT ?? 'dev' },
    db: { ok: dbMs !== null, ms: dbMs },
    sockets: { open: socketStats.open, rejected: socketStats.rejected, banned },
    rooms: extra,
  };
}
