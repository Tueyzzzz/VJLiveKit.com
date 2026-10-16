import type { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { getHub } from '../realtime/hub.js';

/** วิดเจ็ตสะสมของขวัญที่มีสวิตช์ "ล้าง Auto" (ตรงกับหน้าตั้งค่า dashboard/lib/widgetSettings.ts) */
export const COLLECT_TYPES = ['giftjar', 'aquarium', 'vehicle', 'snowglobe', 'spacedome', 'belly', 'garden', 'tree', 'coinjar', 'pile'];
const isOff = (v: unknown) => v === false || v === 'false' || v === '0' || v === 0;

/**
 * ล้าง Auto (ค่าเริ่มต้น = เปิด): เริ่มไลฟ์ใหม่ (รหัสห้อง TikTok ใหม่) → วิดเจ็ตสะสมของขวัญถูก "กดล้าง" ให้เอง
 * ใช้กลไกเดียวกับปุ่มล้างในแดชบอร์ด (resetAt = ตอนนี้) — ของขวัญยังบันทึกอยู่ในระบบ แค่วิดเจ็ตไม่ดึงของก่อน resetAt มาแสดง
 * ข้ามเฉพาะวิดเจ็ตที่วีเจปิดสวิตช์เอง (autoClear = ปิด)
 */
export async function autoClearOnNewLive(username: string): Promise<void> {
  const u = username.replace(/^@/, '').trim();
  if (!u) return;
  const users = await prisma.user.findMany({ where: { tiktokUsername: { equals: u, mode: 'insensitive' } }, select: { id: true } });
  const now = Date.now();
  for (const { id } of users) {
    const cfgs = await prisma.widgetConfig.findMany({ where: { userId: id, type: { in: COLLECT_TYPES } }, select: { type: true, settings: true } });
    const byType = new Map(cfgs.map((c) => [c.type, (c.settings ?? {}) as Record<string, unknown>]));
    for (const type of COLLECT_TYPES) {
      const s = byType.get(type) ?? {};
      if (isOff(s.autoClear)) continue;
      const next = { ...s, resetAt: now } as Prisma.InputJsonValue;
      await prisma.widgetConfig.upsert({ where: { userId_type: { userId: id, type } }, create: { userId: id, type, settings: next }, update: { settings: next } });
      getHub()?.pushConfig(id, type, next);
    }
    console.log(`[autoClear] ${u} ไลฟ์ใหม่ → ล้างวิดเจ็ตสะสมของขวัญ`);
  }
}
