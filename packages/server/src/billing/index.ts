import { config } from '../config/index.js';
import { NoopBillingProvider, type BillingProvider } from './provider.js';
import { StripeBillingProvider } from './stripe.js';

/** เลือก billing provider ตาม config (สลับได้โดยไม่แก้โค้ดธุรกิจ) */
export function createBillingProvider(): BillingProvider {
  switch (config.billingProvider) {
    case 'stripe':
      return new StripeBillingProvider();
    // case 'omise': return new OmiseBillingProvider();  // เติมเมื่อเลือก Omise/Opn
    default:
      return new NoopBillingProvider();
  }
}

export const billing = createBillingProvider();
