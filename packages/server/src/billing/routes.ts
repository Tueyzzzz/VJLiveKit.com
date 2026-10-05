import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { requireUser, getUser } from '../auth/middleware.js';
import { billing } from './index.js';
import { BillingError, type WebhookResult } from './provider.js';
import { config } from '../config/index.js';
import { PLAN_DEFS } from '../plans/index.js';

function sendBillingError(reply: import('fastify').FastifyReply, err: unknown) {
  if (err instanceof BillingError) return reply.code(err.status).send({ error: err.message });
  reply.log.error(err);
  return reply.code(502).send({ error: 'ติดต่อระบบชำระเงินไม่สำเร็จ ลองใหม่อีกครั้ง' });
}

/** หา userId จากผล webhook (metadata หรือ customer id ที่บันทึกไว้) */
async function resolveUserId(r: { userId?: string; customerId?: string }): Promise<string | null> {
  if (r.userId) {
    const u = await prisma.user.findUnique({ where: { id: r.userId }, select: { id: true } });
    if (u) return u.id;
  }
  if (r.customerId) {
    const u = await prisma.user.findUnique({ where: { stripeCustomerId: r.customerId }, select: { id: true } });
    if (u) return u.id;
  }
  return null;
}

/** sync ผล webhook ลง DB (idempotent — Stripe ส่งซ้ำได้) */
async function applyWebhook(r: WebhookResult, log: FastifyInstance['log']): Promise<void> {
  if (!r.handled) return;
  const userId = await resolveUserId(r);
  if (!userId) { log.warn({ r }, '[billing] webhook: หา user ไม่เจอ'); return; }

  if (r.kind === 'subscription.sync') {
    const plan = await prisma.plan.findUnique({ where: { code: r.planCode } }) ?? await prisma.plan.findUnique({ where: { code: 'pro' } });
    if (!plan) return;
    const existing = await prisma.subscription.findUnique({ where: { userId } });
    // อีเวนต์ของ subscription เก่าที่ถูกยกเลิก ห้ามทับ subscription ใหม่ที่ยัง active
    if (existing?.providerSubId && existing.providerSubId !== r.providerSubId && r.status === 'CANCELED') return;
    const data = {
      planId: plan.id, status: r.status, provider: billing.name, providerSubId: r.providerSubId,
      currentPeriodEnd: r.periodEnd ?? null, cancelAtPeriodEnd: r.cancelAtPeriodEnd,
    };
    await prisma.subscription.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    if (r.customerId) {
      await prisma.user.updateMany({ where: { id: userId, stripeCustomerId: null }, data: { stripeCustomerId: r.customerId } });
    }
    return;
  }

  const status = r.kind === 'payment.paid' ? 'PAID' : 'FAILED';
  await prisma.payment.upsert({
    where: { provider_providerRef: { provider: billing.name, providerRef: r.providerRef } },
    create: {
      userId, provider: billing.name, providerRef: r.providerRef, amountCents: r.amountCents, currency: r.currency, status,
      rawPayload: (r.raw ?? undefined) as Prisma.InputJsonValue | undefined,
    },
    update: { status },
  });
}

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  // แพลนทั้งหมด (สาธารณะ — ใช้แสดงหน้า pricing)
  app.get('/api/billing/plans', async () => ({
    provider: billing.name,
    enabled: billing.enabled,
    plans: PLAN_DEFS.map((p) => ({ code: p.code, name: p.name, priceCents: p.priceCents, currency: p.currency, features: p.features })),
  }));

  // เริ่มจ่ายเงิน/สมัคร subscription -> คืน URL ให้ redirect
  app.post('/api/billing/checkout', { preHandler: requireUser }, async (req, reply) => {
    const claims = getUser(req)!;
    const planCode = (req.body as { planCode?: string })?.planCode ?? 'pro';
    const plan = PLAN_DEFS.find((p) => p.code === planCode && p.priceCents > 0);
    if (!plan) return reply.code(400).send({ error: 'ไม่พบแพลนนี้' });

    const user = await prisma.user.findUnique({ where: { id: claims.userId }, include: { subscription: true } });
    if (!user) return reply.code(401).send({ error: 'ไม่พบผู้ใช้' });
    const sub = user.subscription;
    if (sub && ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(sub.status) && sub.providerSubId) {
      return reply.code(409).send({ error: 'คุณเป็นสมาชิกอยู่แล้ว — จัดการได้ที่ปุ่ม "จัดการสมาชิก"' });
    }

    try {
      const result = await billing.createCheckout({
        userId: user.id,
        email: user.email,
        customerId: user.stripeCustomerId,
        planCode: plan.code,
        planName: plan.name,
        priceCents: plan.priceCents,
        currency: plan.currency,
        successUrl: `${config.publicBaseUrl}/billing/success/`,
        cancelUrl: `${config.publicBaseUrl}/billing/cancel/`,
      });
      if (result.customerId) await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: result.customerId } });
      return reply.send({ redirectUrl: result.redirectUrl });
    } catch (err) {
      return sendBillingError(reply, err);
    }
  });

  // หน้าจัดการสมาชิกของ gateway (เปลี่ยนบัตร / ยกเลิก / ใบเสร็จ)
  app.post('/api/billing/portal', { preHandler: requireUser }, async (req, reply) => {
    const claims = getUser(req)!;
    const user = await prisma.user.findUnique({ where: { id: claims.userId }, select: { stripeCustomerId: true } });
    if (!user?.stripeCustomerId) return reply.code(400).send({ error: 'ยังไม่มีประวัติการสมัครสมาชิก' });
    try {
      const url = await billing.createPortal(user.stripeCustomerId, `${config.publicBaseUrl}/dashboard/billing/`);
      return reply.send({ redirectUrl: url });
    } catch (err) {
      return sendBillingError(reply, err);
    }
  });

  // ประวัติการชำระเงิน
  app.get('/api/billing/payments', { preHandler: requireUser }, async (req) => {
    const claims = getUser(req)!;
    const payments = await prisma.payment.findMany({
      where: { userId: claims.userId }, orderBy: { createdAt: 'desc' }, take: 50,
      select: { id: true, amountCents: true, currency: true, status: true, createdAt: true, rawPayload: true },
    });
    return { payments };
  });

  // webhook จาก gateway (อ่าน raw body เพื่อตรวจลายเซ็น — ดู content-type parser ใน app.ts)
  app.post('/api/billing/webhook', async (req, reply) => {
    const signature = req.headers['stripe-signature'] as string | undefined;
    const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
    if (!raw) return reply.code(400).send({ error: 'ไม่มี body' });
    let results: WebhookResult[];
    try {
      results = await billing.handleWebhook(raw, signature);
    } catch (err) {
      return sendBillingError(reply, err);
    }
    // ถ้า sync ล้มเหลว ตอบ 500 ให้ Stripe ส่งซ้ำ
    for (const r of results) await applyWebhook(r, req.log);
    return reply.code(200).send({ received: true });
  });
}
