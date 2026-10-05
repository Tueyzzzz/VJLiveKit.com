'use client';

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { PlanCards, usePlans } from '@/components/Pricing';
import { Alert, Badge, Button, Card, PageHeader, Spinner } from '@/components/ui';
import { api, formatMoney, trialDaysLeft, type PaymentRow } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const STATUS_LABEL: Record<string, string> = { ACTIVE: 'ใช้งานอยู่', TRIALING: 'ทดลองใช้', PAST_DUE: 'ค้างชำระ', CANCELED: 'ยกเลิกแล้ว', INCOMPLETE: 'ชำระเงินไม่สำเร็จ' };

export default function BillingPage() {
  const { user, entitlements } = useAuth();
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

  if (!user) return null;
  const sub = user.subscription;
  const isPro = entitlements?.plan === 'pro';

  return (
    <div>
      <PageHeader title="แพลน & การชำระเงิน" description="ชำระผ่านบัตรอย่างปลอดภัยด้วย Stripe ยกเลิกได้ทุกเมื่อ" />

      {error && <div className="mb-5"><Alert>{error}</Alert></div>}
      {entitlements?.plan === 'trial' && (
        <div className="mb-5"><Alert tone="info">🎁 คุณอยู่ในช่วงทดลองฟรี เหลือ {trialDaysLeft(entitlements)} วัน (ถึง {new Date(entitlements.trialEndsAt!).toLocaleDateString('th-TH', { dateStyle: 'long' })}) — สมัคร Pro ตอนนี้ได้เลย ระบบจะเริ่มเก็บ 199 บาท/เดือน หลังหมดช่วงฟรี</Alert></div>
      )}
      {entitlements?.plan === 'free' && (
        <div className="mb-5"><Alert>ช่วงทดลองฟรีหมดแล้ว — ตอนนี้ใช้ได้เฉพาะวิดเจ็ตพื้นฐาน สมัคร Pro 199 บาท/เดือน เพื่อใช้ทุกวิดเจ็ตต่อ</Alert></div>
      )}
      {!billingEnabled && plans && (
        <div className="mb-5"><Alert tone="info">ระบบชำระเงินยังไม่เปิดใช้งาน — กรุณาติดต่อผู้ดูแล</Alert></div>
      )}

      {sub && (
        <Card className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-medium">
                สมาชิก {sub.plan.name}
                <Badge tone={sub.status === 'ACTIVE' || sub.status === 'TRIALING' ? 'mint' : 'pink'}>{STATUS_LABEL[sub.status] ?? sub.status}</Badge>
              </div>
              {sub.currentPeriodEnd && (
                <p className="mt-1 text-sm text-muted">
                  {sub.cancelAtPeriodEnd || sub.status === 'CANCELED' ? 'สิ้นสุด' : 'ต่ออายุอัตโนมัติ'} {new Date(sub.currentPeriodEnd).toLocaleDateString('th-TH', { dateStyle: 'long' })}
                </p>
              )}
              {sub.status === 'PAST_DUE' && <p className="mt-1 text-sm text-pink">การตัดบัตรล่าสุดไม่สำเร็จ — อัปเดตบัตรเพื่อใช้งานต่อ</p>}
            </div>
            {billingEnabled && (
              <Button variant="secondary" loading={busy === 'portal'} onClick={() => go('/api/billing/portal', 'portal')}>
                จัดการสมาชิก / เปลี่ยนบัตร / ยกเลิก
              </Button>
            )}
          </div>
        </Card>
      )}

      {!plans ? <Spinner /> : (
        <PlanCards
          plans={plans}
          currentPlan={entitlements?.plan}
          renderAction={(p) => p.priceCents === 0 ? (
            <Button variant="secondary" className="w-full" disabled>{isPro ? 'ยกเลิกได้ที่ “จัดการสมาชิก”' : 'แพลนปัจจุบัน'}</Button>
          ) : isPro ? (
            <Button variant="secondary" className="w-full" disabled>คุณเป็นสมาชิก Pro แล้ว 🎉</Button>
          ) : (
            <Button className="w-full" disabled={!billingEnabled} loading={busy === p.code} onClick={() => go('/api/billing/checkout', p.code, { planCode: p.code })}>
              {entitlements?.plan === 'trial' ? `สมัคร ${p.name} (เก็บเงินหลังหมดช่วงฟรี)` : `อัปเกรดเป็น ${p.name}`}
            </Button>
          )}
        />
      )}

      <h2 className="mb-3 mt-10 font-medium">ประวัติการชำระเงิน</h2>
      {!payments ? <Spinner /> : payments.length === 0 ? (
        <p className="text-sm text-muted">ยังไม่มีรายการ</p>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs text-muted">
              <tr><th className="px-5 py-3 font-normal">วันที่</th><th className="px-5 py-3 font-normal">ยอด</th><th className="px-5 py-3 font-normal">สถานะ</th><th className="px-5 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-3">{new Date(p.createdAt).toLocaleDateString('th-TH')}</td>
                  <td className="px-5 py-3">{formatMoney(p.amountCents, p.currency)}</td>
                  <td className="px-5 py-3"><Badge tone={p.status === 'PAID' ? 'mint' : 'pink'}>{p.status === 'PAID' ? 'ชำระแล้ว' : p.status === 'FAILED' ? 'ไม่สำเร็จ' : p.status}</Badge></td>
                  <td className="px-5 py-3 text-right">
                    {p.rawPayload?.hosted_invoice_url && (
                      <a href={p.rawPayload.hosted_invoice_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-pink hover:underline">
                        ใบเสร็จ <ExternalLink className="size-3" />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
