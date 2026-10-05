import type { FastifyInstance } from 'fastify';
import { prisma } from '../db/prisma.js';
import { requireUser, getUser } from '../auth/middleware.js';
import { config } from '../config/index.js';
import { trialEndOf } from '../plans/index.js';

/**
 * ระบบแนะนำเพื่อน: แนะนำครบทุก 10 คน (ที่ตั้งชื่อ TikTok แล้ว ชื่อไม่ซ้ำ) → ได้ Pro ฟรี 30 วัน
 * เก็บข้อมูลในตาราง WidgetConfig ที่มีอยู่ (ไม่ต้องแก้ schema):
 *   type '_referral'        ของผู้ถูกแนะนำ → settings { by: userId ผู้แนะนำ, at }
 *   type '_referral_reward' ของผู้แนะนำ   → settings { given: จำนวนเดือนฟรีที่ให้ไปแล้ว }
 */
export const REFERRALS_PER_REWARD = 10;
const REWARD_DAYS = 30;
const DAY = 86_400_000;
const T_REF = '_referral', T_REWARD = '_referral_reward';

/** บันทึกว่าใครแนะนำผู้ใช้ใหม่ (เรียกตอนสมัคร) — ไม่ให้ error ทำการสมัครพัง */
export async function recordReferral(newUserId: string, refId: unknown): Promise<void> {
  if (typeof refId !== 'string' || !/^[a-z0-9]{10,40}$/i.test(refId) || refId === newUserId) return;
  try {
    const ref = await prisma.user.findUnique({ where: { id: refId }, select: { id: true } });
    if (!ref) return;
    await prisma.widgetConfig.create({ data: { userId: newUserId, type: T_REF, settings: { by: refId, at: new Date().toISOString() } } });
  } catch (err) { console.error('[referral] record failed', err); }
}

/** นับเพื่อนที่นับสิทธิ์ได้ = ตั้งชื่อ TikTok แล้ว และชื่อไม่ซ้ำกัน */
async function stats(referrerId: string) {
  const rows = await prisma.widgetConfig.findMany({
    where: { type: T_REF, settings: { path: ['by'], equals: referrerId } },
    select: { user: { select: { tiktokUsername: true } } },
  });
  const tiktoks = new Set(rows.map((r) => r.user.tiktokUsername?.toLowerCase()).filter((x): x is string => !!x));
  const reward = await prisma.widgetConfig.findUnique({ where: { userId_type: { userId: referrerId, type: T_REWARD } } });
  const given = Number((reward?.settings as { given?: number } | null)?.given ?? 0);
  return { signedUp: rows.length, qualified: tiktoks.size, given };
}

/** ต่ออายุ Pro ให้ผู้แนะนำ (นับต่อจากวันหมดเดิม/วันหมดช่วงทดลอง ไม่เสียวันที่เหลือ) */
async function grantDays(userId: string, days: number): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true, subscription: true } });
  const plan = await prisma.plan.findUnique({ where: { code: 'pro' } });
  if (!user || !plan) return;
  const sub = user.subscription;
  // มี subscription ที่ตัดบัตรอัตโนมัติอยู่ → ไม่ยุ่งกับรอบบิลของ gateway (เก็บเป็นวันสะสมไว้ก่อน)
  if (sub && sub.provider === 'stripe' && sub.status === 'ACTIVE') {
    const prev = await prisma.widgetConfig.findUnique({ where: { userId_type: { userId, type: '_referral_credit' } } });
    const total = Number((prev?.settings as { days?: number } | null)?.days ?? 0) + days;
    await prisma.widgetConfig.upsert({
      where: { userId_type: { userId, type: '_referral_credit' } },
      create: { userId, type: '_referral_credit', settings: { days: total } },
      update: { settings: { days: total } },
    });
    return;
  }
  const cur = sub?.status === 'ACTIVE' ? sub.currentPeriodEnd?.getTime() ?? 0 : 0;
  const end = new Date(Math.max(Date.now(), trialEndOf(user.createdAt).getTime(), cur) + days * DAY);
  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, planId: plan.id, status: 'ACTIVE', provider: 'referral', currentPeriodEnd: end, cancelAtPeriodEnd: true },
    update: { planId: plan.id, status: 'ACTIVE', provider: sub?.provider ?? 'referral', currentPeriodEnd: end, cancelAtPeriodEnd: true },
  });
}

/** ตรวจว่าผู้แนะนำได้รางวัลเพิ่มไหม (เรียกหลังผู้ถูกแนะนำตั้งชื่อ TikTok) */
export async function checkReferralReward(referredUserId: string): Promise<void> {
  try {
    const row = await prisma.widgetConfig.findUnique({ where: { userId_type: { userId: referredUserId, type: T_REF } } });
    const by = (row?.settings as { by?: string } | null)?.by;
    if (!by) return;
    const s = await stats(by);
    const earned = Math.floor(s.qualified / REFERRALS_PER_REWARD);
    if (earned <= s.given) return;
    await grantDays(by, (earned - s.given) * REWARD_DAYS);
    await prisma.widgetConfig.upsert({
      where: { userId_type: { userId: by, type: T_REWARD } },
      create: { userId: by, type: T_REWARD, settings: { given: earned } },
      update: { settings: { given: earned } },
    });
  } catch (err) { console.error('[referral] reward failed', err); }
}

export async function referralRoutes(app: FastifyInstance): Promise<void> {
  // ลิงก์แนะนำ + ความคืบหน้าของฉัน
  app.get('/api/referrals/me', { preHandler: requireUser }, async (req) => {
    const id = getUser(req)!.userId;
    const s = await stats(id);
    return {
      link: `${config.publicBaseUrl}/register/?ref=${id}`,
      perReward: REFERRALS_PER_REWARD, rewardDays: REWARD_DAYS,
      signedUp: s.signedUp, qualified: s.qualified, monthsEarned: s.given,
      toNext: REFERRALS_PER_REWARD - (s.qualified % REFERRALS_PER_REWARD),
    };
  });
}
