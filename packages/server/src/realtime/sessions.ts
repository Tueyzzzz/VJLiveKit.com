import { Prisma } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../db/prisma.js';
import { config } from '../config/index.js';
import type { TikTokRoom } from '../tiktok/manager.js';
import type { TopGifter } from '../tiktok/types.js';

/**
 * บันทึก/โหลดสถิติไลฟ์ลงฐานข้อมูล (ตาราง LiveSession — หนึ่งแถวต่อหนึ่งไลฟ์ของ TikTok)
 * - ต่อไลฟ์ได้ → โหลดของเดิมของ roomId เดียวกัน (กรณีเซิร์ฟเวอร์รีสตาร์ทกลางไลฟ์)
 * - ระหว่างไลฟ์ → บันทึกเป็นระยะ, ไลฟ์จบ → บันทึกพร้อมเวลาจบ
 */

// ---- เก็บเป็นไฟล์ (ใช้เมื่อยังไม่ได้เปิด LIVE_SESSIONS / ยังไม่มีตารางในฐานข้อมูล) ----
const SNAP_DIR = process.env.SNAPSHOT_DIR || path.resolve(process.cwd(), '../../data/live');
const fileOf = (roomId: string) => path.join(SNAP_DIR, roomId.replace(/[^0-9A-Za-z_-]/g, '') + '.json');
try {
  fs.mkdirSync(SNAP_DIR, { recursive: true });
  const old = Date.now() - 3 * 86_400_000; // ลบไฟล์ไลฟ์ที่เก่ากว่า 3 วัน
  for (const f of fs.readdirSync(SNAP_DIR)) { const p = path.join(SNAP_DIR, f); if (fs.statSync(p).mtimeMs < old) fs.rmSync(p, { force: true }); }
} catch (err) { console.error('[sessions] snapshot dir', err); }

async function loadFile(room: TikTokRoom, roomId: string): Promise<void> {
  let raw: string;
  try { raw = await fs.promises.readFile(fileOf(roomId), 'utf8'); } catch { return; }
  const snap = JSON.parse(raw) as ReturnType<TikTokRoom['snapshot']>;
  room.restore(snap);
}
async function saveFile(room: TikTokRoom, roomId: string): Promise<void> {
  const tmp = fileOf(roomId) + '.tmp';
  await fs.promises.writeFile(tmp, JSON.stringify(room.snapshot()));
  await fs.promises.rename(tmp, fileOf(roomId)); // เขียนทั้งไฟล์ทีเดียว ไม่ค้างครึ่ง ๆ
}

/** โหลดสถิติที่บันทึกไว้ของไลฟ์นี้ (ถ้ามี) เข้าไปใน room */
export async function loadSession(room: TikTokRoom): Promise<void> {
  const roomId = room.liveRoomId;
  if (!roomId) return;
  if (!config.liveSessions) return loadFile(room, roomId);
  const row = await prisma.liveSession.findUnique({ where: { roomId } });
  if (!row) return;
  room.restore({
    stats: { diamondCount: row.diamonds, giftCount: row.gifts, likeCount: row.likes, followCount: row.follows, shareCount: row.shares, chatCount: row.chats },
    peakViewers: row.peakViewers,
    topGifters: row.topGifters as unknown as TopGifter[],
    topLikers: row.topLikers as unknown as TopGifter[],
  });
}

/** บันทึกสถิติปัจจุบันของ room (ended = ไลฟ์จบแล้ว) */
export async function saveSession(room: TikTokRoom, ended = false): Promise<void> {
  const roomId = room.liveRoomId;
  if (!roomId) return;
  if (!config.liveSessions) return saveFile(room, roomId);
  const snap = room.snapshot();
  const data = {
    tiktokUsername: room.username.toLowerCase(),
    diamonds: snap.stats.diamondCount,
    gifts: snap.stats.giftCount,
    likes: snap.stats.likeCount,
    follows: snap.stats.followCount,
    shares: snap.stats.shareCount,
    chats: snap.stats.chatCount,
    peakViewers: snap.peakViewers,
    topGifters: snap.topGifters as unknown as Prisma.InputJsonValue,
    topLikers: snap.topLikers as unknown as Prisma.InputJsonValue,
    ...(ended ? { endedAt: new Date() } : {}),
  };
  await prisma.liveSession.upsert({ where: { roomId }, create: { roomId, ...data }, update: data });
}
