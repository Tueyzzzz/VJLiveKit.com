import Stripe from 'stripe';
import type { BillingProvider, CheckoutParams, CheckoutResult, SubscriptionState, WebhookResult } from './provider.js';
import { BillingError } from './provider.js';
import { config } from '../config/index.js';

const STATUS: Record<string, SubscriptionState> = {
  active: 'ACTIVE',
  trialing: 'TRIALING',
  past_due: 'PAST_DUE',
  unpaid: 'PAST_DUE',
  canceled: 'CANCELED',
  incomplete: 'INCOMPLETE',
  incomplete_expired: 'CANCELED',
  paused: 'CANCELED',
};

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === 'string' ? v : v?.id);

/**
 * Stripe provider — Checkout (subscription) + Customer Portal + webhooks
 * ตั้งค่า: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, (ออปชัน) STRIPE_PRICE_PRO_MONTHLY
 * ถ้าไม่ตั้ง price id จะสร้างราคาจากแพลนใน DB ให้อัตโนมัติ (price_data)
 * webhook events ที่ต้องเปิดใน Stripe Dashboard:
 *   checkout.session.completed, customer.subscription.created/updated/deleted, invoice.paid, invoice.payment_failed
 */
export class StripeBillingProvider implements BillingProvider {
  readonly name = 'stripe';
  readonly enabled: boolean;
  private stripe: Stripe | null;

  constructor() {
    const key = config.stripe.secretKey;
    this.enabled = !!key;
    this.stripe = key ? new Stripe(key) : null;
    if (!key) console.warn('[billing] STRIPE_SECRET_KEY ยังไม่ได้ตั้ง — Stripe ยังใช้งานจริงไม่ได้');
  }

  private client(): Stripe {
    if (!this.stripe) throw new BillingError('ยังไม่ได้ตั้งค่า STRIPE_SECRET_KEY', 501);
    return this.stripe;
  }

  async createCheckout(p: CheckoutParams): Promise<CheckoutResult> {
    const stripe = this.client();
    let customerId = p.customerId ?? undefined;
    let createdCustomer: string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: p.email, metadata: { userId: p.userId } });
      customerId = createdCustomer = customer.id;
    }

    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = config.stripe.priceProMonthly && p.planCode === 'pro'
      ? { price: config.stripe.priceProMonthly, quantity: 1 }
      : {
          quantity: 1,
          price_data: {
            currency: p.currency,
            unit_amount: p.priceCents,
            recurring: { interval: 'month' },
            product_data: { name: `VJLiveKit ${p.planName}` },
          },
        };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: p.userId,
      line_items: [lineItem],
      success_url: `${p.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: p.cancelUrl,
      allow_promotion_codes: true,
      // ยังเหลือช่วงทดลองฟรี (Stripe ต้องการล่วงหน้า ≥ 48 ชม.) → ตัดบัตรครั้งแรกตอนหมดช่วงฟรี
      subscription_data: { metadata: { userId: p.userId, planCode: p.planCode },
        ...(p.trialEnd && p.trialEnd.getTime() - Date.now() > 49 * 3600_000 ? { trial_end: Math.floor(p.trialEnd.getTime() / 1000) } : {}) },
      metadata: { userId: p.userId, planCode: p.planCode },
    });
    if (!session.url) throw new BillingError('Stripe ไม่คืน URL สำหรับชำระเงิน', 502);
    return { redirectUrl: session.url, providerRef: session.id, customerId: createdCustomer };
  }

  async createPortal(customerId: string, returnUrl: string): Promise<string> {
    const portal = await this.client().billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
    return portal.url;
  }

  async cancelSubscription(providerSubId: string): Promise<void> {
    await this.client().subscriptions.update(providerSubId, { cancel_at_period_end: true });
  }

  private subResult(sub: Stripe.Subscription, userIdHint?: string): WebhookResult {
    const items = sub.items?.data ?? [];
    const ends = items.map((i) => i.current_period_end).filter((n): n is number => typeof n === 'number');
    const periodEnd = ends.length ? new Date(Math.max(...ends) * 1000) : undefined;
    return {
      handled: true,
      kind: 'subscription.sync',
      userId: sub.metadata?.userId || userIdHint,
      customerId: idOf(sub.customer),
      providerSubId: sub.id,
      planCode: sub.metadata?.planCode || 'pro',
      status: STATUS[sub.status] ?? 'INCOMPLETE',
      periodEnd,
      cancelAtPeriodEnd: !!sub.cancel_at_period_end || !!sub.cancel_at,
    };
  }

  async handleWebhook(rawBody: Buffer, signature: string | undefined): Promise<WebhookResult[]> {
    const stripe = this.client();
    if (!config.stripe.webhookSecret) throw new BillingError('ยังไม่ได้ตั้งค่า STRIPE_WEBHOOK_SECRET', 501);
    if (!signature) throw new BillingError('ไม่มีลายเซ็น stripe-signature', 400);

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
    } catch (err) {
      throw new BillingError(`ลายเซ็น webhook ไม่ถูกต้อง: ${(err as Error).message}`, 400);
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object;
        const subId = idOf(s.subscription);
        if (s.mode !== 'subscription' || !subId) return [];
        const sub = await stripe.subscriptions.retrieve(subId);
        return [this.subResult(sub, s.client_reference_id ?? undefined)];
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        return [this.subResult(event.data.object)];
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const inv = event.data.object;
        if (!inv.id) return [];
        return [{
          handled: true,
          kind: event.type === 'invoice.paid' ? 'payment.paid' : 'payment.failed',
          customerId: idOf(inv.customer),
          providerRef: inv.id,
          amountCents: event.type === 'invoice.paid' ? inv.amount_paid : inv.amount_due,
          currency: inv.currency,
          raw: { id: inv.id, number: inv.number, hosted_invoice_url: inv.hosted_invoice_url, billing_reason: inv.billing_reason },
        }];
      }
      default:
        return [];
    }
  }
}
