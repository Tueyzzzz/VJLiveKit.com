import fs from 'node:fs';
import path from 'node:path';

/**
 * บันทึกจำนวนไลฟ์ (สำหรับหน้าแอดมิน) — 1 รหัสห้องไลฟ์ของ TikTok = 1 ไลฟ์
 * เก็บเป็นไฟล์ JSON ใน data/ (ไม่ต้อง migrate ฐานข้อมูล) · เก็บย้อนหลังสูงสุด 5,000 ไลฟ์
 */
const FILE = path.join(process.env.SNAPSHOT_DIR ? path.dirname(process.env.SNAPSHOT_DIR) : path.resolve(process.cwd(), '../../data'), 'lives.json');
export interface LiveRecord { roomId: string; username: string; startedAt: string; lastSeenAt: string; diamonds: number; gifts: number; likes: number; peakViewers: number; ended: boolean }

let lives: LiveRecord[] = [];
try { lives = JSON.parse(fs.readFileSync(FILE, 'utf8')) as LiveRecord[]; } catch { /* ยังไม่มีไฟล์ */ }
let dirty = false;
setInterval(() => {
  if (!dirty) return; dirty = false;
  fs.promises.mkdir(path.dirname(FILE), { recursive: true })
    .then(() => fs.promises.writeFile(FILE, JSON.stringify(lives.slice(-5000))))
    .catch((err) => console.error('[lives] save failed', err));
}, 30_000).unref();

/** เจอไลฟ์ (ต่อสำเร็จ) / อัปเดตสถิติระหว่างไลฟ์ */
export function trackLive(roomId: string, username: string, s: { diamonds?: number; gifts?: number; likes?: number; peakViewers?: number }, ended = false): void {
  const now = new Date().toISOString();
  let r = lives.find((x) => x.roomId === roomId);
  if (!r) { r = { roomId, username, startedAt: now, lastSeenAt: now, diamonds: 0, gifts: 0, likes: 0, peakViewers: 0, ended: false }; lives.push(r); }
  r.lastSeenAt = now; r.username = username;
  r.diamonds = Math.max(r.diamonds, s.diamonds ?? 0); r.gifts = Math.max(r.gifts, s.gifts ?? 0);
  r.likes = Math.max(r.likes, s.likes ?? 0); r.peakViewers = Math.max(r.peakViewers, s.peakViewers ?? 0);
  if (ended) r.ended = true;
  dirty = true;
}

export function listLives(): LiveRecord[] { return lives; }
