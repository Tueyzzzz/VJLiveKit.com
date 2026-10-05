/**
 * Billing abstraction — ออกแบบให้สลับ gateway ได้ (Stripe / Omise / อื่น ๆ)
 * โดยไม่ต้องแก้โค้ดส่วนธุรกิจ ตัดสินใจเลือก provider ภายหลังได้
 */

export interface CheckoutParams {
  userId: string;
  email: string;
  planCode: string;      // "pro"
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResult {
  /** URL ให้ redirect ผู้ใช้ไปจ่ายเงิน (หรือ QR PromptPay แล้วแต่ provider) */
  redirectUrl: string;
  providerRef?: string;
}

export interface WebhookResult {
  handled: boolean;
  /** เหตุการณ์ที่ต้อง sync ลง DB เช่น subscription active / payment paid */
  kind?: 'subscription.active' | 'subscription.canceled' | 'payment.paid' | 'payment.failed';
  userId?: string;
  providerRef?: string;
  amountCents?: number;
  currency?: string;
  periodEnd?: Date;
}

export interface BillingProvider {
  readonly name: string;
  /** สร้าง session จ่ายเงิน/สมัคร subscription */
  createCheckout(params: CheckoutParams): Promise<CheckoutResult>;
  /** ยกเลิก subscription */
  cancelSubscription(providerSubId: string): Promise<void>;
  /** รับ-ตรวจสอบ webhook จาก gateway แล้วแปลงเป็น WebhookResult ให้ชั้นธุรกิจ sync DB ต่อ */
  handleWebhook(rawBody: Buffer, signature: string | undefined): Promise<WebhookResult>;
}

/** provider เปล่า — ใช้ตอนยังไม่เลือก gateway (BILLING_PROVIDER=none) */
export class NoopBillingProvider implements BillingProvider {
  readonly name = 'none';
  async createCheckout(): Promise<CheckoutResult> {
    throw new Error('ยังไม่ได้ตั้งค่า payment provider (ตั้ง BILLING_PROVIDER=stripe|omise)');
  }
  async cancelSubscription(): Promise<void> { /* no-op */ }
  async handleWebhook(): Promise<WebhookResult> { return { handled: false }; }
}
