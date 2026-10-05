import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** ที่อยู่โฟลเดอร์ overlay (เสิร์ฟไฟล์วิดเจ็ตให้ OBS) */
export const OVERLAY_DIR = process.env.OVERLAY_DIR ?? path.resolve(process.cwd(), '../overlay/public');

/**
 * เวอร์ชันของไฟล์ overlay = hash ของเนื้อหาไฟล์ทั้งหมด (เปลี่ยนเฉพาะตอนไฟล์เปลี่ยนจริง)
 * ส่งให้ overlay ตอนต่อ socket — ถ้าไม่ตรงกับที่หน้าเปิดอยู่ หน้า overlay จะโหลดตัวเองใหม่
 * (OBS / TikTok Live Studio ได้ไฟล์ใหม่หลัง deploy โดยไม่ต้องเปลี่ยนลิงก์)
 */
function computeVersion(dir: string): string {
  const hash = crypto.createHash('sha1');
  const walk = (d: string): void => {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)); }
    catch { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(html|js|css|svg|webp|png|jpe?g)$/.test(e.name)) { hash.update(e.name); hash.update(fs.readFileSync(p)); }
    }
  };
  walk(dir);
  return hash.digest('hex').slice(0, 10);
}

export const OVERLAY_VERSION = computeVersion(OVERLAY_DIR);
