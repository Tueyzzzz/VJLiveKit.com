import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';

/** วิดเจ็ตทั้งหมดที่ระบบมี (ชื่อตรงกับไฟล์ /overlay/<type>.html) */
export const WIDGET_TYPES = ['coinjar', 'giftjar', 'alerts', 'goal', 'chat', 'follower', 'topgifters', 'toplikers', 'timer', 'tts', 'fx'] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];

export function isWidgetType(t: string): t is WidgetType {
  return (WIDGET_TYPES as readonly string[]).includes(t);
}

/** สิทธิ์การใช้งานของแพลน (เก็บใน Plan.features) */
export interface PlanFeatures {
  widgets: WidgetType[];
  maxActionRules: number;
  maxTokens: number;
  noWatermark: boolean;
}

export interface Entitlements extends PlanFeatures {
  plan: string; // "free" | "pro"
}

interface PlanDef { code: string; name: string; priceCents: number; currency: string; features: PlanFeatures }

/**
 * นิยามแพลน — โค้ดคือแหล่งความจริง: sync ลง DB ทุกครั้งที่เซิร์ฟเวอร์สตาร์ท (ensurePlans)
 * แก้ราคา/ฟีเจอร์ที่นี่แล้ว deploy ได้เลย ไม่ต้องรัน seed เอง
 */
// ช่วงเปิดทดสอบ: Free ได้ทุกฟีเจอร์เท่า Pro — ตั้งเป็น false เพื่อกลับไปใช้ลิมิต Free ปกติ
const FREE_UNLOCKED_FOR_TESTING = true;

export const PLAN_DEFS: PlanDef[] = [
  {
    code: 'free', name: 'Free', priceCents: 0, currency: 'thb',
    features: FREE_UNLOCKED_FOR_TESTING
      ? { widgets: [...WIDGET_TYPES], maxActionRules: 100, maxTokens: 20, noWatermark: true }
      : { widgets: ['coinjar', 'alerts', 'goal', 'chat', 'follower'], maxActionRules: 3, maxTokens: 2, noWatermark: false },
  },
  {
    code: 'pro', name: 'Pro', priceCents: 14900, currency: 'thb', // 149 บาท/เดือน
    features: {
      widgets: [...WIDGET_TYPES],
      maxActionRules: 100, maxTokens: 20, noWatermark: true,
    },
  },
];

const FREE = PLAN_DEFS[0]!;

export async function ensurePlans(): Promise<void> {
  for (const p of PLAN_DEFS) {
    const data = { name: p.name, priceCents: p.priceCents, currency: p.currency, features: p.features as unknown as Prisma.InputJsonValue };
    await prisma.plan.upsert({ where: { code: p.code }, create: { code: p.code, ...data }, update: data });
  }
}

/** สถานะที่ยังถือว่าได้สิทธิ์แพลนเสียเงิน */
const PAID_STATUSES = new Set(['ACTIVE', 'TRIALING', 'PAST_DUE']);

/** คำนวณสิทธิ์ปัจจุบันของผู้ใช้ (หมดอายุ/ยกเลิก -> กลับเป็น free) */
export async function getEntitlements(userId: string): Promise<Entitlements> {
  const sub = await prisma.subscription.findUnique({ where: { userId }, include: { plan: true } });
  const active = sub && PAID_STATUSES.has(sub.status)
    && (!sub.currentPeriodEnd || sub.currentPeriodEnd.getTime() > Date.now());
  if (!active) return { plan: FREE.code, ...FREE.features };
  const def = PLAN_DEFS.find((p) => p.code === sub.plan.code);
  const features = (def?.features ?? (sub.plan.features as unknown as PlanFeatures)) ?? FREE.features;
  return { plan: sub.plan.code, ...features };
}
