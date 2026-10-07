'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PartyPopper } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';

/** กลับมาจาก Stripe Checkout — webhook อาจมาช้ากว่าเล็กน้อย จึง refresh สถานะซ้ำสักครู่ */
export default function BillingSuccess() {
  const { entitlements, refresh } = useAuth();
  const tr = useT();
  const [tries, setTries] = useState(0);
  const isPro = entitlements?.plan === 'pro';

  useEffect(() => {
    if (isPro || tries >= 10) return;
    const t = setTimeout(() => { void refresh().then(() => setTries((n) => n + 1)); }, 2000);
    return () => clearTimeout(t);
  }, [isPro, tries, refresh]);

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <Card className="max-w-md p-8 text-center">
        <PartyPopper className="mx-auto mb-4 size-10 text-pink" />
        <h1 className="font-display text-2xl">{tr('ขอบคุณที่สมัครสมาชิก!')}</h1>
        <p className="mt-2 text-sm text-muted">
          {isPro ? tr('บัญชีของคุณเป็น Pro แล้ว ใช้วิดเจ็ตได้ครบทุกตัว') : tries >= 10 ? tr('ได้รับการชำระเงินแล้ว ระบบกำลังอัปเดตสถานะ (อาจใช้เวลาสักครู่)') : tr('กำลังยืนยันการชำระเงิน…')}
        </p>
        <Link href="/dashboard/widgets/" className="mt-6 inline-block"><Button>{tr('ไปตั้งค่าวิดเจ็ต')}</Button></Link>
      </Card>
    </div>
  );
}
