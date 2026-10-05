/**
 * Billing abstraction — ออกแบบให้สลับ gateway ได้ (Stripe / Omise / อื่น ๆ)
 * โดยไม่ต้องแก้โค้ดส่วนธุรกิจ
 */

export interface CheckoutParams {
  userId: string;
  email: string;
  /** ลูกค้าเดิมฝั่ง gateway (ถ้ามี) */
  customerId?: string | null;
  planCode: string;      // "pro"
  planName: string;
  priceCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResult {
  /** URL ให้ redirect ผู้ใช้ไปจ่ายเงิน */
  redirectUrl: string;
  providerRef?: string;
  /** ลูกค้าฝั่ง gateway ที่สร้างใหม่ — ให้ชั้นธุรกิจบันทึกไว้ */
  customerId?: string;
}

export type SubscriptionState = 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE';

/** ผลจาก webhook ที่แปลงแล้ว — ชั้นธุรกิจเอาไป sync ลง DB */
export type WebhookResult =
  | { handled: false }
  | {
      handled: true;
      kind: 'subscription.sync';
      userId?: string;
      customerId?: string;
      providerSubId: string;
      planCode: string;
      status: SubscriptionState;
      periodEnd?: Date;
      cancelAtPeriodEnd: boolean;
    }
  | {
      handled: true;
      kind: 'payment.paid' | 'payment.failed';
      userId?: string;
      customerId?: string;
      providerRef: string;
      amountCents: number;
      currency: string;
      raw?: unknown;
    };

export interface BillingProvider {
  readonly name: string;
  readonly enabled: boolean;
  /** สร้าง session จ่ายเงิน/สมัคร subscription */
  createCheckout(params: CheckoutParams): Promise<CheckoutResult>;
  /** หน้าจัดการสมาชิก (เปลี่ยนบัตร/ยกเลิก/ใบเสร็จ) — คืน URL */
  createPortal(customerId: string, returnUrl: string): Promise<string>;
  /** ยกเลิก subscription ตอนสิ้นรอบบิล */
  cancelSubscription(providerSubId: string): Promise<void>;
  /** รับ-ตรวจสอบ webhook จาก gateway แล้วแปลงเป็น WebhookResult (หลายรายการได้) */
  handleWebhook(rawBody: Buffer, signature: string | undefined): Promise<WebhookResult[]>;
}

export class BillingError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

/** provider เปล่า — ใช้ตอนยังไม่เลือก gateway (BILLING_PROVIDER=none) */
export class NoopBillingProvider implements BillingProvider {
  readonly name = 'none';
  readonly enabled = false;
  async createCheckout(): Promise<CheckoutResult> {
    throw new BillingError('ระบบชำระเงินยังไม่เปิดใช้งาน (ตั้ง BILLING_PROVIDER=stripe)', 501);
  }
  async createPortal(): Promise<string> {
    throw new BillingError('ระบบชำระเงินยังไม่เปิดใช้งาน', 501);
  }
  async cancelSubscription(): Promise<void> { /* no-op */ }
  async handleWebhook(): Promise<WebhookResult[]> { return []; }
}
