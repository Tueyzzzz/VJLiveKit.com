import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import type { TikTokRoom } from '../tiktok/manager.js';
import type { TopGifter } from '../tiktok/types.js';

/**
 * บันทึก/โหลดสถิติไลฟ์ลงฐานข้อมูล (ตาราง LiveSession — หนึ่งแถวต่อหนึ่งไลฟ์ของ TikTok)
 * - ต่อไลฟ์ได้ → โหลดของเดิมของ roomId เดียวกัน (กรณีเซิร์ฟเวอร์รีสตาร์ทกลางไลฟ์)
 * - ระหว่างไลฟ์ → บันทึกเป็นระยะ, ไลฟ์จบ → บันทึกพร้อมเวลาจบ
 */

/** โหลดสถิติที่บันทึกไว้ของไลฟ์นี้ (ถ้ามี) เข้าไปใน room */
export async function loadSession(room: TikTokRoom): Promise<void> {
  const roomId = room.liveRoomId;
  if (!roomId) return;
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
