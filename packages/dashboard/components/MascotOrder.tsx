'use client';

import { useCallback, useState } from 'react';
import { SlipPaySheet, useSlipPay } from './SlipPaySheet';
import { useLang, useT } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';

/**
 * สั่งทำมาสคอตหน้าตัวเอง: ราคา (หักส่วนลดตามแพลนแล้ว) + เปิดหน้าจ่ายเงิน (แนบรูปหน้า · QR/โอน · สลิป)
 * ยังไม่ตั้งบัญชีรับเงิน → เปิดแชททีมงานแทน (แบบเดิม)
 */
export function useMascotOrder() {
  const t = useT();
  const [lang] = useLang();
  const info = useSlipPay();
  const [open, setOpen] = useState(false);
  const { refresh } = useAuth();
  const cents = info?.mascotPriceCents ?? null;
  const price = cents != null ? `฿${(cents / 100).toLocaleString(lang === 'en' ? 'en-US' : 'th-TH')}` : '';
  const start = useCallback(() => {
    if (info?.enabled && cents) setOpen(true);
    else window.dispatchEvent(new CustomEvent('vjl-open-support', { detail: { text: t('สนใจสั่งทำมาสคอตหน้าตัวเองค่ะ/ครับ 🎨 สไตล์ที่อยากได้: ') } }));
  }, [info, cents, t]);
  const sheet = open && info && cents ? (
    <SlipPaySheet mascot plan={{ code: 'mascot', name: 'มาสคอตหน้าตัวเอง', priceCents: cents }} info={info} onClose={() => setOpen(false)} onPaid={() => void refresh()} />
  ) : null;
  return { price, start, sheet, full: info?.mascotFullCents ?? null, cents };
}
