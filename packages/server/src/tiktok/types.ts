/** ชนิดของอีเวนต์ที่ระบบส่งต่อให้ overlay/dashboard (normalized) */
export type TikTokEventType =
  | 'chat' | 'gift' | 'like' | 'follow' | 'share' | 'member' | 'roomUser';

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
  repeatCount?: number;
  diamondCount?: number;
  totalValue?: number;
  streaking?: boolean;
  // like
  likeCount?: number;
  total?: number;
  // roomUser
  viewerCount?: number;
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
