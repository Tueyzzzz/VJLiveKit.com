import type { BillingProvider, CheckoutParams, CheckoutResult, WebhookResult } from './provider.js';
import { config } from '../config/index.js';

/**
 * Stripe provider (STUB) — โครงไว้เติมเมื่อเลือก Stripe
 * ขั้นตอนจริงที่ต้องเติม:
 *   1) npm i stripe  แล้ว import Stripe
 *   2) createCheckout -> stripe.checkout.sessions.create({ mode:'subscription', ... }) รองรับ PromptPay+card
 *   3) handleWebhook -> stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)
 *      แล้ว map event (checkout.session.completed / invoice.paid / customer.subscription.deleted)
 */
export class StripeBillingProvider implements BillingProvider {
  readonly name = 'stripe';

  constructor() {
    if (!config.stripe.secretKey) {
      console.warn('[billing] STRIPE_SECRET_KEY ยังไม่ได้ตั้ง — Stripe provider จะยังใช้งานจริงไม่ได้');
    }
  }

  async createCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    // TODO: เรียก Stripe Checkout Session จริง
    throw new Error(`[stripe] createCheckout ยังไม่ได้ implement (plan=${params.planCode})`);
  }

  async cancelSubscription(providerSubId: string): Promise<void> {
    // TODO: stripe.subscriptions.update(providerSubId, { cancel_at_period_end: true })
    void providerSubId;
  }

  async handleWebhook(_rawBody: Buffer, _signature: string | undefined): Promise<WebhookResult> {
    // TODO: ตรวจลายเซ็น + map event
    return { handled: false };
  }
}
