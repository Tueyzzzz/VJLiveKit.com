import type { FastifyInstance } from 'fastify';
import { prisma } from '../db/prisma.js';
import { requireUser, getUser } from '../auth/middleware.js';
import { billing } from './index.js';
import { config } from '../config/index.js';

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  // เริ่มจ่ายเงิน/สมัคร subscription -> คืน URL ให้ redirect
  app.post('/api/billing/checkout', { preHandler: requireUser }, async (req, reply) => {
    const claims = getUser(req)!;
    const planCode = (req.body as { planCode?: string })?.planCode ?? 'pro';
    try {
      const result = await billing.createCheckout({
        userId: claims.userId,
        email: claims.email,
        planCode,
        successUrl: `${config.publicBaseUrl}/billing/success`,
        cancelUrl: `${config.publicBaseUrl}/billing/cancel`,
      });
      return reply.send(result);
    } catch (err) {
      return reply.code(501).send({ error: String((err as Error).message) });
    }
  });

  // webhook จาก gateway (ต้องอ่าน raw body เพื่อตรวจลายเซ็น)
  app.post('/api/billing/webhook', { config: { rawBody: true } }, async (req, reply) => {
    const signature = req.headers['stripe-signature'] as string | undefined;
    const raw = (req as unknown as { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    const result = await billing.handleWebhook(raw, signature);
    if (!result.handled) return reply.code(200).send({ received: true });

    // sync ลง DB ตามผลลัพธ์
    if (result.kind === 'payment.paid' && result.userId && result.providerRef) {
      await prisma.payment.upsert({
        where: { provider_providerRef: { provider: billing.name, providerRef: result.providerRef } },
        create: { userId: result.userId, provider: billing.name, providerRef: result.providerRef, amountCents: result.amountCents ?? 0, currency: result.currency ?? 'thb', status: 'PAID' },
        update: { status: 'PAID' },
      });
    }
    if (result.kind === 'subscription.active' && result.userId) {
      const pro = await prisma.plan.findUnique({ where: { code: 'pro' } });
      if (pro) {
        await prisma.subscription.upsert({
          where: { userId: result.userId },
          create: { userId: result.userId, planId: pro.id, status: 'ACTIVE', provider: billing.name, currentPeriodEnd: result.periodEnd },
          update: { planId: pro.id, status: 'ACTIVE', currentPeriodEnd: result.periodEnd },
        });
      }
    }
    return reply.code(200).send({ received: true });
  });
}
