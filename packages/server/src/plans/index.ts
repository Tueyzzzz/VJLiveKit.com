import fs from 'node:fs';
import path from 'node:path';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { settings } from '../settings/index.js';
import { trialEndOf, trialInfo, seedTrialHistory } from './trials.js';

/** วิดเจ็ตทั้งหมดที่ระบบมี (ชื่อตรงกับไฟล์ /overlay/<type>.html) */
export const WIDGET_TYPES = ['coinjar', 'giftjar', 'aquarium', 'spacedome', 'belly', 'snowglobe', 'vehicle', 'garden', 'tree', 'alerts', 'goal', 'chat', 'follower', 'topgifters', 'toplikers', 'pkmvp', 'timer', 'league', 'tts', 'fx', 'fxmenu', 'donate', 'collect', 'sign', 'pile', 'mascot'] as const;
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
  /** ใช้ Action "ไพ่ทาโร่" ได้ */
  tarot: boolean;
  /** หน้าสถิติไลฟ์ละเอียด */
  liveStats: boolean;
  /** อัปโหลดเสียง: MB ต่อไฟล์ (0 = ตามค่าระบบ) */
  soundMaxMB: number;
  /** อัปโหลดเสียง: จำนวนไฟล์ (0 = ตามค่าระบบ) */
  soundMaxFiles: number;
  /** ซัพพอร์ตด่วน (ตอบก่อน) */
  prioritySupport: boolean;
  /** ส่วนลดสั่งทำมาสคอตหน้าตัวเอง (%) */
  mascotDiscountPct: number;
}

export interface Entitlements extends PlanFeatures {
  plan: string; // "free" | "trial" | "starter" | "pro" | "promax" | "expert"
  /** ชื่อแพลนสำหรับแสดงผล */
  planName: string;
  /** ช่วงทดลองฟรีสิ้นสุด (ISO) — มีเฉพาะตอนอยู่ในช่วงทดลอง */
  trialEndsAt?: string;
  /** ทดลองฟรีนับต่อ TikTok: TikTok นี้ใช้ไปแล้วกี่วัน / ทั้งหมดกี่วัน */
  trialUsedDays?: number;
  trialTotalDays?: number;
  trialTiktok?: string | null;
}

/** สมัครใหม่ = ใช้ฟรีทุกฟีเจอร์ N วัน (แอดมินปรับได้ที่หน้าตั้งค่าระบบ) — นับต่อ TikTok ID ดู ./trials.ts */
export const TRIAL_DAYS = 30;
export { trialEndOf, trialInfo, normTiktok, seedTrialHistory } from './trials.js';

export interface PlanDef {
  code: string;
  name: string;
  priceCents: number;
  currency: string;
  /** ป้ายเด่น เช่น "ยอดนิยม" (ว่าง = ไม่แสดง) */
  badge: string;
  /** คำโปรยสั้น ๆ ใต้ชื่อแพลน */
  tagline: string;
  /** จุดเด่น (ข้อความ) แสดงบนการ์ดราคา */
  bullets: string[];
  features: PlanFeatures;
}

/** ลำดับแพลน (ถูก → แพง) — โค้ดเหล่านี้ตายตัว แอดมินแก้ได้แค่เนื้อหา */
export const PLAN_CODES = ['free', 'starter', 'pro', 'promax', 'expert'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];
export const isPlanCode = (c: string): c is PlanCode => (PLAN_CODES as readonly string[]).includes(c);

// ---- ชุดวิดเจ็ตแต่ละขั้น ----
const W_FREE: WidgetType[] = ['coinjar', 'collect', 'alerts', 'goal', 'chat', 'follower'];
const W_STARTER: WidgetType[] = [...W_FREE, 'topgifters', 'toplikers', 'timer', 'fx', 'fxmenu', 'sign', 'donate'];
const W_PRO: WidgetType[] = [...W_STARTER, 'giftjar', 'aquarium', 'spacedome', 'belly', 'snowglobe', 'vehicle', 'garden', 'tree', 'pile', 'tts'];
const W_PROMAX: WidgetType[] = [...W_PRO, 'pkmvp', 'league', 'mascot'];
const W_ALL: WidgetType[] = [...WIDGET_TYPES];

/**
 * ค่าเริ่มต้นของแพลน (โค้ด) — แอดมินแก้ทับได้ที่หน้า Admin › แพลน (เก็บใน data/plans.json)
 * ทุกครั้งที่เซิร์ฟเวอร์สตาร์ท/แอดมินบันทึก จะ sync ลงตาราง Plan ใน DB (ensurePlans)
 */
export const DEFAULT_PLANS: PlanDef[] = [
  {
    code: 'free', name: 'Free', priceCents: 0, currency: 'thb', badge: '',
    tagline: 'ลองของก่อน ไม่ต้องใช้บัตร',
    bullets: ['วิดเจ็ตพื้นฐาน 6 แบบ', 'มีป้าย vjlivekit.com บนจอ'],
    features: { widgets: W_FREE, maxActionRules: 3, maxTokens: 2, noWatermark: false, tarot: false, liveStats: false, soundMaxMB: 0, soundMaxFiles: 0, prioritySupport: false, mascotDiscountPct: 0 },
  },
  {
    code: 'starter', name: 'มือใหม่', priceCents: 9900, currency: 'thb', badge: '',
    tagline: 'เริ่มไลฟ์จริงจัง จอสะอาดไม่มีโลโก้',
    bullets: ['ไม่มีป้าย vjlivekit.com บนจอ', 'Top Gifters · ป้ายไฟ · เมนูของขวัญ · โดเนท', 'Actions & Events (FX)'],
    features: { widgets: W_STARTER, maxActionRules: 10, maxTokens: 3, noWatermark: true, tarot: false, liveStats: false, soundMaxMB: 5, soundMaxFiles: 20, prioritySupport: false, mascotDiscountPct: 0 },
  },
  {
    code: 'pro', name: 'Pro', priceCents: 19900, currency: 'thb', badge: 'ยอดนิยม',
    tagline: 'ของขวัญตกลงจอแบบเกม ครบทุกสไตล์',
    bullets: ['วิดเจ็ตสะสมของขวัญทุกแบบ (โหล ตู้ปลา ต้นไม้ รถลาก…)', 'อ่านแชทออกเสียง (TTS)', 'ไพ่ทาโร่ขึ้นจอ'],
    features: { widgets: W_PRO, maxActionRules: 30, maxTokens: 5, noWatermark: true, tarot: true, liveStats: false, soundMaxMB: 8, soundMaxFiles: 40, prioritySupport: false, mascotDiscountPct: 0 },
  },
  {
    code: 'promax', name: 'Pro Max', priceCents: 29900, currency: 'thb', badge: '',
    tagline: 'สายแข่ง PK และลีก',
    bullets: ['MVP ของ PK · ลีก TikTok', 'มาสคอตตัวแทนวีเจ', 'สถิติไลฟ์ละเอียด'],
    features: { widgets: W_PROMAX, maxActionRules: 100, maxTokens: 10, noWatermark: true, tarot: true, liveStats: true, soundMaxMB: 10, soundMaxFiles: 60, prioritySupport: false, mascotDiscountPct: 0 },
  },
  {
    code: 'expert', name: 'มืออาชีพ', priceCents: 34900, currency: 'thb', badge: '',
    tagline: 'ทุกอย่างไม่จำกัด + ดูแลพิเศษ',
    bullets: ['ทุกวิดเจ็ต ทุกฟีเจอร์', 'ซัพพอร์ตด่วน ตอบก่อน', 'ส่วนลดสั่งทำมาสคอตหน้าตัวเอง 20%'],
    features: { widgets: W_ALL, maxActionRules: 200, maxTokens: 20, noWatermark: true, tarot: true, liveStats: true, soundMaxMB: 15, soundMaxFiles: 100, prioritySupport: true, mascotDiscountPct: 20 },
  },
];

// ---- ค่าที่แอดมินแก้ทับ (data/plans.json) ----
const FILE = path.join(process.env.SNAPSHOT_DIR ? path.dirname(process.env.SNAPSHOT_DIR) : path.resolve(process.cwd(), '../../data'), 'plans.json');
type PlanOverride = Partial<Omit<PlanDef, 'code' | 'features'>> & { features?: Partial<PlanFeatures> };
let overrides: Record<string, PlanOverride> = {};
try { overrides = JSON.parse(fs.readFileSync(FILE, 'utf8')) as Record<string, PlanOverride>; } catch { /* ยังไม่มีไฟล์ */ }

const clampInt = (v: unknown, min: number, max: number, dflt: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt; };
const str = (v: unknown, max: number, dflt: string) => (typeof v === 'string' ? v.trim().slice(0, max) : dflt);

/** รวมค่า override (ที่ผ่านการตรวจแล้ว) ทับค่าเริ่มต้น */
function merge(def: PlanDef, o: PlanOverride | undefined): PlanDef {
  if (!o) return def;
  const f = o.features ?? {}, d = def.features;
  return {
    code: def.code,
    currency: def.currency,
    name: str(o.name, 40, def.name) || def.name,
    priceCents: def.code === 'free' ? 0 : clampInt(o.priceCents, 0, 10_000_000, def.priceCents),
    badge: str(o.badge, 30, def.badge),
    tagline: str(o.tagline, 120, def.tagline),
    bullets: Array.isArray(o.bullets) ? o.bullets.map((b) => str(b, 120, '')).filter(Boolean).slice(0, 12) : def.bullets,
    features: {
      widgets: Array.isArray(f.widgets) ? WIDGET_TYPES.filter((w) => (f.widgets as string[]).includes(w)) : d.widgets,
      maxActionRules: clampInt(f.maxActionRules ?? d.maxActionRules, 0, 1000, d.maxActionRules),
      maxTokens: clampInt(f.maxTokens ?? d.maxTokens, 1, 100, d.maxTokens),
      noWatermark: typeof f.noWatermark === 'boolean' ? f.noWatermark : d.noWatermark,
      tarot: typeof f.tarot === 'boolean' ? f.tarot : d.tarot,
      liveStats: typeof f.liveStats === 'boolean' ? f.liveStats : d.liveStats,
      soundMaxMB: clampInt(f.soundMaxMB ?? d.soundMaxMB, 0, 20, d.soundMaxMB),
      soundMaxFiles: clampInt(f.soundMaxFiles ?? d.soundMaxFiles, 0, 500, d.soundMaxFiles),
      prioritySupport: typeof f.prioritySupport === 'boolean' ? f.prioritySupport : d.prioritySupport,
      mascotDiscountPct: clampInt(f.mascotDiscountPct ?? d.mascotDiscountPct, 0, 100, d.mascotDiscountPct),
    },
  };
}

/** ตารางแพลนปัจจุบัน (ค่าเริ่มต้น + ที่แอดมินแก้) — ใช้ตัวนี้ทุกที่ */
export function getPlans(): PlanDef[] {
  return DEFAULT_PLANS.map((p) => {
    const m = merge(p, overrides[p.code]);
    // Free ที่แอดมินยังไม่เคยตั้งในหน้าแพลน → ใช้ลิมิตจากหน้าตั้งค่าระบบ (ของเดิม)
    if (p.code === 'free') {
      const fo = overrides.free?.features ?? {};
      if (fo.maxActionRules == null) m.features.maxActionRules = settings().freeMaxRules;
      if (fo.maxTokens == null) m.features.maxTokens = settings().freeMaxTokens;
    }
    return m;
  });
}
export const getPlan = (code: string): PlanDef | undefined => getPlans().find((p) => p.code === code);

/** แอดมินบันทึกตารางแพลน → เขียน data/plans.json + sync DB · คืนตารางใหม่ */
export async function savePlans(input: unknown): Promise<PlanDef[]> {
  const next: Record<string, PlanOverride> = {};
  const list = Array.isArray(input) ? input : [];
  for (const raw of list as (PlanOverride & { code?: string })[]) {
    if (!raw || typeof raw.code !== 'string' || !isPlanCode(raw.code)) continue;
    const def = DEFAULT_PLANS.find((p) => p.code === raw.code)!;
    const m = merge(def, raw); // ตรวจ/ตัดค่าแปลก ๆ ทิ้ง
    next[raw.code] = { name: m.name, priceCents: m.priceCents, badge: m.badge, tagline: m.tagline, bullets: m.bullets, features: m.features };
  }
  overrides = { ...overrides, ...next };
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(overrides, null, 1));
  await ensurePlans();
  return getPlans();
}
/** คืนค่าเริ่มต้นของแพลนเดียว (ลบที่แอดมินแก้) */
export async function resetPlan(code: string): Promise<PlanDef[]> {
  delete overrides[code];
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(overrides, null, 1));
  await ensurePlans();
  return getPlans();
}

let seeded = false;
export async function ensurePlans(): Promise<void> {
  if (!seeded) { seeded = true; await seedTrialHistory().catch((e) => console.warn('[plans] seed trial history failed', e)); }
  for (const p of getPlans()) {
    const data = { name: p.name, priceCents: p.priceCents, currency: p.currency, features: p.features as unknown as Prisma.InputJsonValue };
    await prisma.plan.upsert({ where: { code: p.code }, create: { code: p.code, ...data }, update: data });
  }
}

/** สถานะที่ยังถือว่าได้สิทธิ์แพลนเสียเงิน */
const PAID_STATUSES = new Set(['ACTIVE', 'TRIALING', 'PAST_DUE']);

/** คำนวณสิทธิ์ปัจจุบันของผู้ใช้ (หมดอายุ/ยกเลิก -> กลับเป็น free) */
export async function getEntitlements(userId: string): Promise<Entitlements> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true, tiktokUsername: true, subscription: { include: { plan: true } } } });
  const sub = user?.subscription;
  const active = sub && PAID_STATUSES.has(sub.status)
    && (!sub.currentPeriodEnd || sub.currentPeriodEnd.getTime() > Date.now());
  const plans = getPlans();
  const free = plans[0]!;
  if (!active) {
    // ยังไม่จ่าย: อยู่ในช่วงทดลอง → ใช้ได้ทุกอย่างเท่าแพลนสูงสุด แต่ยังมีป้าย VJLiveKit บนจอ
    const trialEnd = user ? trialEndOf(user.createdAt, user.tiktokUsername) : null;
    const ti = user ? trialInfo(user.createdAt, user.tiktokUsername) : null;
    const trial = ti ? { trialUsedDays: ti.usedDays, trialTotalDays: ti.totalDays, trialTiktok: ti.tiktok } : {};
    if (trialEnd && trialEnd.getTime() > Date.now()) {
      return { plan: 'trial', planName: 'ทดลองฟรี', ...plans[plans.length - 1]!.features, noWatermark: false, prioritySupport: false, mascotDiscountPct: 0, trialEndsAt: trialEnd.toISOString(), ...trial };
    }
    return { plan: free.code, planName: free.name, ...free.features, ...trial };
  }
  const def = plans.find((p) => p.code === sub.plan.code);
  if (def) return { plan: def.code, planName: def.name, ...def.features };
  // แพลนเก่าที่ไม่มีในตารางแล้ว → ใช้ features ที่บันทึกใน DB (เติมค่าที่ขาดจาก Free)
  return { plan: sub.plan.code, planName: sub.plan.name, ...free.features, ...(sub.plan.features as unknown as Partial<PlanFeatures>) };
}

/** ข้อมูลแพลนสำหรับหน้า pricing สาธารณะ */
export const publicPlans = () => getPlans().map((p) => ({ code: p.code, name: p.name, priceCents: p.priceCents, currency: p.currency, badge: p.badge, tagline: p.tagline, bullets: p.bullets, features: p.features }));
