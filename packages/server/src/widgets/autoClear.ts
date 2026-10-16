import { prisma } from '../db/prisma.js';
import { getHub } from '../realtime/hub.js';

/**
 * ล้าง Auto: เริ่มไลฟ์ใหม่ (รหัสห้อง TikTok ใหม่) → วิดเจ็ตที่เปิดสวิตช์ autoClear ถูก "กดล้าง" ให้เอง
 * ใช้กลไกเดียวกับปุ่มล้างในแดชบอร์ด (resetAt = ตอนนี้) — ของขวัญยังบันทึกอยู่ในระบบ แค่วิดเจ็ตไม่ดึงของก่อน resetAt มาแสดง
 */
export async function autoClearOnNewLive(username: string): Promise<void> {
  const u = username.replace(/^@/, '').trim();
  if (!u) return;
  const users = await prisma.user.findMany({ where: { tiktokUsername: { equals: u, mode: 'insensitive' } }, select: { id: true } });
  for (const { id } of users) {
    const cfgs = await prisma.widgetConfig.findMany({ where: { userId: id }, select: { type: true, settings: true } });
    for (const c of cfgs) {
      const s = (c.settings ?? {}) as Record<string, unknown>;
      if (s.autoClear !== true && s.autoClear !== 'true' && s.autoClear !== '1') continue;
      const next = { ...s, resetAt: Date.now() };
      await prisma.widgetConfig.update({ where: { userId_type: { userId: id, type: c.type } }, data: { settings: next } });
      getHub()?.pushConfig(id, c.type, next);
      console.log(`[autoClear] ${u} ไลฟ์ใหม่ → ล้าง ${c.type}`);
    }
  }
}
