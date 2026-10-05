import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';

/** วิดเจ็ตทั้งหมดที่ระบบมี (ชื่อตรงกับไฟล์ /overlay/<type>.html) */
export const WIDGET_TYPES = ['coinjar', 'giftjar', 'aquarium', 'belly', 'snowglobe', 'vehicle', 'garden', 'tree', 'alerts', 'goal', 'chat', 'follower', 'topgifters', 'toplikers', 'timer', 'league', 'tts', 'fx'] as const;
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
  plan: string; // "free" | "trial" | "pro"
  /** ช่วงทดลองฟรีสิ้นสุด (ISO) — มีเฉพาะตอนอยู่ในช่วงทดลอง */
  trialEndsAt?: string;
}

/** สมัครใหม่ = ใช้ฟรีทุกฟีเจอร์ (เท่า Pro) 30 วันนับจากวันสมัคร แล้วต้องสมัคร Pro */
export const TRIAL_DAYS = 30;
export const trialEndOf = (createdAt: Date): Date => new Date(createdAt.getTime() + TRIAL_DAYS * 86_400_000);

interface PlanDef { code: string; name: string; priceCents: number; currency: string; features: PlanFeatures }

/**
 * นิยามแพลน — โค้ดคือแหล่งความจริง: sync ลง DB ทุกครั้งที่เซิร์ฟเวอร์สตาร์ท (ensurePlans)
 * แก้ราคา/ฟีเจอร์ที่นี่แล้ว deploy ได้เลย ไม่ต้องรัน seed เอง
 */
// ช่วงเปิดทดสอบ: Free ได้ทุกฟีเจอร์เท่า Pro — ตั้งเป็น false เพื่อกลับไปใช้ลิมิต Free ปกติ
const FREE_UNLOCKED_FOR_TESTING = false;

export const PLAN_DEFS: PlanDef[] = [
  {
    code: 'free', name: 'Free', priceCents: 0, currency: 'thb',
    features: FREE_UNLOCKED_FOR_TESTING
      ? { widgets: [...WIDGET_TYPES], maxActionRules: 100, maxTokens: 20, noWatermark: true }
      : { widgets: ['coinjar', 'alerts', 'goal', 'chat', 'follower'], maxActionRules: 3, maxTokens: 2, noWatermark: false },
  },
  {
    code: 'pro', name: 'Pro', priceCents: 19900, currency: 'thb', // 199 บาท/เดือน (เดือนแรกฟรี — ดู TRIAL_DAYS)
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
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true, subscription: { include: { plan: true } } } });
  const sub = user?.subscription;
  const active = sub && PAID_STATUSES.has(sub.status)
    && (!sub.currentPeriodEnd || sub.currentPeriodEnd.getTime() > Date.now());
  if (!active) {
    // ยังไม่จ่าย: อยู่ในช่วงทดลอง 30 วันแรก → ใช้ได้ทุกอย่างเท่า Pro
    const trialEnd = user ? trialEndOf(user.createdAt) : null;
    if (trialEnd && trialEnd.getTime() > Date.now()) {
      return { plan: 'trial', ...PLAN_DEFS.find((p) => p.code === 'pro')!.features, trialEndsAt: trialEnd.toISOString() };
    }
    return { plan: FREE.code, ...FREE.features };
  }
  const def = PLAN_DEFS.find((p) => p.code === sub.plan.code);
  const features = (def?.features ?? (sub.plan.features as unknown as PlanFeatures)) ?? FREE.features;
  return { plan: sub.plan.code, ...features };
}
