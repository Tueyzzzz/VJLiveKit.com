'use client';

import { useEffect, useState } from 'react';
import { Pager, usePaged } from '@/components/Pager';
import { ExternalLink } from 'lucide-react';
import { PlanCards, askForPlan, usePlans } from '@/components/Pricing';
import { PlanCompare } from '@/components/PlanCompare';
import { Alert, Badge, Button, Card, PageHeader, Spinner } from '@/components/ui';
import { api, formatMoney, isPaidPlan, trialDaysLeft, type PaymentRow } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLang, useT } from '@/lib/i18n';

const STATUS_LABEL: Record<string, string> = { ACTIVE: 'ใช้งานอยู่', TRIALING: 'ทดลองใช้', PAST_DUE: 'ค้างชำระ', CANCELED: 'ยกเลิกแล้ว', INCOMPLETE: 'ชำระเงินไม่สำเร็จ' };

export default function BillingPage() {
  const { user, entitlements } = useAuth();
  const t = useT();
  const [lang] = useLang();
  const loc = lang === 'en' ? 'en-US' : 'th-TH';
  const { plans, billingEnabled } = usePlans();
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ payments: PaymentRow[] }>('/api/billing/payments').then((r) => setPayments(r.payments)).catch(() => setPayments([]));
  }, []);

  async function go(path: string, key: string, body?: unknown) {
    setBusy(key);
    setError(null);
    try {
      const res = await api<{ redirectUrl: string }>(path, { method: 'POST', body: body ?? {} });
      window.location.href = res.redirectUrl;
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  const payPg = usePaged(payments, 10);
  if (!user) return null;
  const sub = user.subscription;
  const isPaid = isPaidPlan(entitlements?.plan);
  /** ตัดบัตรอัตโนมัติอยู่แล้ว → เปลี่ยนแพลนผ่านแชท (กันจ่ายซ้อน) */
  const hasCardSub = sub?.provider === 'stripe' && ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(sub.status);

  return (
    <div>
      <PageHeader title={t('แพลน & การชำระเงิน')} description={t('ชำระผ่านบัตรอย่างปลอดภัยด้วย Stripe ยกเลิกได้ทุกเมื่อ')} />

      {error && <div className="mb-5"><Alert>{error}</Alert></div>}
      {entitlements?.plan === 'trial' && (
        <div className="mb-5"><Alert tone="info">
          {t('🎁 คุณอยู่ในช่วงทดลองฟรี เหลือ {n} วัน (ถึง {date}) — ใช้ได้ทุกฟีเจอร์ เลือกแพลนไว้ล่วงหน้าได้เลย', { n: trialDaysLeft(entitlements) ?? 0, date: new Date(entitlements.trialEndsAt!).toLocaleDateString(loc, { dateStyle: 'long' }) })}
          {entitlements.trialTiktok && <div className="mt-1 text-xs opacity-80">{t('ทดลองฟรีนับต่อ TikTok: @{tiktok} ใช้ทดลองไปแล้ว {used}/{total} วัน', { tiktok: entitlements.trialTiktok, used: entitlements.trialUsedDays ?? 0, total: entitlements.trialTotalDays ?? 0 })}</div>}
        </Alert></div>
      )}
      {entitlements?.plan === 'free' && (
        <div className="mb-5"><Alert>
          {t('ช่วงทดลองฟรีหมดแล้ว — ตอนนี้ใช้ได้เฉพาะวิดเจ็ตพื้นฐาน เลือกแพลนด้านล่างเพื่อปลดล็อกเพิ่ม')}
          {entitlements.trialTiktok && <div className="mt-1 text-xs opacity-80">{t('TikTok @{tiktok} ใช้ทดลองฟรีครบ {total} วันแล้ว (นับต่อ TikTok ไม่ใช่ต่อบัญชี)', { tiktok: entitlements.trialTiktok, total: entitlements.trialTotalDays ?? 0 })}</div>}
        </Alert></div>
      )}
      {!billingEnabled && plans && (
        <div className="mb-5"><Alert tone="info">{t('ตอนนี้สมัครแพลนผ่านแชทกับทีมงาน — กด “เลือกแพลนนี้” แล้วทีมงานจะส่งช่องทางชำระเงินให้')}</Alert></div>
      )}

      {sub && (
        <Card className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-medium">
                {t('สมาชิก {plan}', { plan: sub.plan.name })}
                <Badge tone={sub.status === 'ACTIVE' || sub.status === 'TRIALING' ? 'mint' : 'pink'}>{STATUS_LABEL[sub.status] ? t(STATUS_LABEL[sub.status]) : sub.status}</Badge>
              </div>
              {sub.currentPeriodEnd && (
                <p className="mt-1 text-sm text-muted">
                  {sub.cancelAtPeriodEnd || sub.status === 'CANCELED' ? t('สิ้นสุด') : t('ต่ออายุอัตโนมัติ')} {new Date(sub.currentPeriodEnd).toLocaleDateString(loc, { dateStyle: 'long' })}
                </p>
              )}
              {sub.status === 'PAST_DUE' && <p className="mt-1 text-sm text-pink">{t('การตัดบัตรล่าสุดไม่สำเร็จ — อัปเดตบัตรเพื่อใช้งานต่อ')}</p>}
            </div>
            {billingEnabled && (
              <Button variant="secondary" loading={busy === 'portal'} onClick={() => go('/api/billing/portal', 'portal')}>
                {t('จัดการสมาชิก / เปลี่ยนบัตร / ยกเลิก')}
              </Button>
            )}
          </div>
        </Card>
      )}

      {!plans ? <Spinner /> : (
        <PlanCards
          plans={plans}
          currentPlan={entitlements?.plan}
          renderAction={(p) => {
            if (p.code === entitlements?.plan) return <Button variant="secondary" className="w-full" disabled>{t('แพลนปัจจุบัน')}</Button>;
            if (p.priceCents === 0) return <Button variant="secondary" className="w-full" disabled>{isPaid ? t('ยกเลิกได้ที่ “จัดการสมาชิก”') : t('ฟรีตลอด')}</Button>;
            // จ่ายผ่านบัตรได้ และยังไม่มีรอบบิลบัตร → checkout · นอกนั้น (ยังไม่เปิดระบบตัดบัตร / เปลี่ยนแพลน) → แชทซัพพอร์ต
            const viaCheckout = billingEnabled && !hasCardSub;
            return (
              <Button className="w-full" variant={p.badge ? 'primary' : 'secondary'} loading={busy === p.code}
                onClick={() => viaCheckout ? go('/api/billing/checkout', p.code, { planCode: p.code })
                  : askForPlan(t(p.name), isPaid ? t('อยากเปลี่ยนเป็นแพลน {plan} ค่ะ/ครับ') : t('อยากสมัครแพลน {plan} ค่ะ/ครับ'))}>
                {isPaid ? t('เปลี่ยนเป็นแพลนนี้') : t('เลือกแพลนนี้')}
              </Button>
            );
          }}
        />
      )}
      <p className="mt-3 text-center text-xs text-muted">{t('ราคาต่อเดือน (บาท) · ยกเลิกได้ทุกเมื่อ · มีคำถามกดแชทมุมขวาล่างได้เลย')}</p>
      {plans && <PlanCompare plans={plans} />}

      <h2 className="mb-3 mt-10 font-medium">{t('ประวัติการชำระเงิน')}</h2>
      {!payments ? <Spinner /> : payments.length === 0 ? (
        <p className="text-sm text-muted">{t('ยังไม่มีรายการ')}</p>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs text-muted">
              <tr><th className="px-5 py-3 font-normal">{t('วันที่')}</th><th className="px-5 py-3 font-normal">{t('ยอด')}</th><th className="px-5 py-3 font-normal">{t('สถานะ')}</th><th className="px-5 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {payPg.items.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-3">{new Date(p.createdAt).toLocaleDateString(loc)}</td>
                  <td className="px-5 py-3">{formatMoney(p.amountCents, p.currency)}</td>
                  <td className="px-5 py-3"><Badge tone={p.status === 'PAID' ? 'mint' : 'pink'}>{p.status === 'PAID' ? t('ชำระแล้ว') : p.status === 'FAILED' ? t('ไม่สำเร็จ') : p.status}</Badge></td>
                  <td className="px-5 py-3 text-right">
                    {p.rawPayload?.hosted_invoice_url && (
                      <a href={p.rawPayload.hosted_invoice_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-pink hover:underline">
                        {t('ใบเสร็จ')} <ExternalLink className="size-3" />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager {...payPg} />
        </Card>
      )}
    </div>
  );
}
