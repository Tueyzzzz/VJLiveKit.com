/** ชนิดของอีเวนต์ที่ระบบส่งต่อให้ overlay/dashboard (normalized) */
export type TikTokEventType =
  | 'chat' | 'gift' | 'like' | 'follow' | 'share' | 'member' | 'roomUser' | 'pk';

/** อีเวนต์ PK: เริ่ม/จบ · คะแนน · การ์ด (นวม สายฟ้า หมอก ต่อเวลา ฯลฯ) */
export interface PkInfo {
  kind: 'start' | 'end' | 'score' | 'card';
  card?: string; // รหัสการ์ด เช่น glove / critical / smoke
  label?: string; // ชื่อไทย + อีโมจิ
  by?: string; // คนที่ใช้การ์ด (ถ้ารู้)
  side?: 'us' | 'them' | null; // การ์ดนี้ใช้กับฝั่งเรา/ฝั่งคู่แข่ง
  text?: string;
  us?: number; them?: number; // คะแนน PK
  result?: 'win' | 'lose' | 'draw';
}

export interface NormalizedUser {
  userId: string;
  uniqueId: string;
  nickname: string;
  avatar: string;
}

export interface TikTokEvent {
  type: TikTokEventType;
  ts: number;
  user?: NormalizedUser;
  // chat
  comment?: string;
  // gift
  giftName?: string;
  giftId?: number;
  giftImage?: string;
  repeatCount?: number;
  diamondCount?: number;
  totalValue?: number;
  streaking?: boolean;
  // like
  likeCount?: number;
  total?: number;
  // roomUser
  viewerCount?: number;
  // pk
  pk?: PkInfo;
}

export interface TopGifter {
  uniqueId: string;
  nickname: string;
  avatar: string;
  value: number; // เพชรรวม
}

export interface LiveStats {
  viewerCount: number;
  likeCount: number;
  diamondCount: number;
  followCount: number;
  shareCount: number;
  chatCount: number;
  giftCount: number;
}

export function emptyStats(): LiveStats {
  return { viewerCount: 0, likeCount: 0, diamondCount: 0, followCount: 0, shareCount: 0, chatCount: 0, giftCount: 0 };
}
