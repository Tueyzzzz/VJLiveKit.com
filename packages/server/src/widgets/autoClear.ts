import type { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { getHub } from '../realtime/hub.js';
import { listLives, type LiveRecord } from '../realtime/lives.js';

/** วิดเจ็ตสะสมของขวัญที่มีสวิตช์ "ล้าง Auto" (ตรงกับหน้าตั้งค่า dashboard/lib/widgetSettings.ts) */
export const COLLECT_TYPES = ['giftjar', 'aquarium', 'vehicle', 'snowglobe', 'spacedome', 'belly', 'garden', 'tree', 'coinjar', 'pile'];
/** อันดับผู้ชม — ล้าง Auto พร้อมกัน */
const RANK_TYPES = ['topgifters', 'toplikers'];
const isOff = (v: unknown) => v === false || v === 'false' || v === '0' || v === 0;
/** ลงไลฟ์แล้วขึ้นใหม่ภายในเวลานี้ = ไลฟ์ต่อเนื่อง (หลุด/รีสตาร์ท/เปลี่ยนเครื่อง) → ห้ามล้างของขวัญ */
export const RELIVE_GAP_MS = 60 * 60_000;

const norm = (u: string) => u.replace(/^@/, '').trim().toLowerCase();
const livesOf = (u: string): LiveRecord[] => listLives().filter((x) => norm(x.username) === u).sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));

/** ไลฟ์ก่อนหน้าของชื่อนี้ (ไม่นับห้อง exceptRoom) จบไปไม่ถึง RELIVE_GAP_MS → ยังนับเป็นไลฟ์เดียวกัน */
export function recentlyLive(username: string, exceptRoom?: string | null): boolean {
  const now = Date.now();
  return livesOf(norm(username)).some((x) => x.roomId !== exceptRoom && now - Date.parse(x.lastSeenAt) < RELIVE_GAP_MS);
}

/**
 * ล้าง Auto (ค่าเริ่มต้น = เปิด): จบไลฟ์ไปแล้วเกิน 1 ชม. (ไม่กลับมาไลฟ์) หรือเริ่มไลฟ์ใหม่หลังพักเกิน 1 ชม. → วิดเจ็ตสะสมของขวัญถูก "กดล้าง" ให้เอง
 * ลงไลฟ์แล้วขึ้นใหม่ภายใน 1 ชม. = ไลฟ์ต่อเนื่อง ไม่ล้าง (ผู้เรียกเช็ก recentlyLive ก่อน)
 * ใช้กลไกเดียวกับปุ่มล้างในแดชบอร์ด (resetAt = ตอนนี้) — ของขวัญยังบันทึกอยู่ในระบบ แค่วิดเจ็ตไม่ดึงของก่อน resetAt มาแสดง · เก็บค่าเดิมไว้ใน prevResetAt (กู้คืนได้)
 * ข้ามเฉพาะวิดเจ็ตที่วีเจปิดสวิตช์เอง (autoClear = ปิด)
 */
export async function autoClearOnNewLive(username: string, liveEnded = false): Promise<void> {
  const u = username.replace(/^@/, '').trim();
  if (!u) return;
  if (liveEnded) getHub()?.clearRanking(u); // จบไลฟ์: ล้างอันดับในห้อง (เซิร์ฟเวอร์) ก่อน แล้ววิดเจ็ตรีโหลดมาเจออันดับว่าง · เริ่มไลฟ์ใหม่ไม่ต้อง (ห้องใหม่อันดับว่างอยู่แล้ว)
  const users = await prisma.user.findMany({ where: { tiktokUsername: { equals: u, mode: 'insensitive' } }, select: { id: true } });
  const now = Date.now();
  for (const { id } of users) {
    const cfgs = await prisma.widgetConfig.findMany({ where: { userId: id, type: { in: [...COLLECT_TYPES, ...RANK_TYPES] } }, select: { type: true, settings: true } });
    const byType = new Map(cfgs.map((c) => [c.type, (c.settings ?? {}) as Record<string, unknown>]));
    for (const type of [...COLLECT_TYPES, ...RANK_TYPES]) {
      const s = byType.get(type) ?? {};
      if (isOff(s.autoClear)) continue;
      const next = { ...s, resetAt: now, prevResetAt: s.resetAt ?? 0 } as Prisma.InputJsonValue;
      await prisma.widgetConfig.upsert({ where: { userId_type: { userId: id, type } }, create: { userId: id, type, settings: next }, update: { settings: next } });
      getHub()?.pushConfig(id, type, next);
    }
    console.log(`[autoClear] ${u} ${liveEnded ? 'จบไลฟ์' : 'ไลฟ์ใหม่'} → ล้างวิดเจ็ตสะสมของขวัญ`);
  }
}
