'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { Alert, Badge, Button, Card, Field, Input, PageHeader } from '@/components/ui';
import { ChangePassword } from '@/components/ChangePassword';
import { ActiveRules } from '@/components/ActiveRules';
import { TikTokAvatar } from '@/components/TikTokAvatar';
import { PromoVideos } from '@/components/PromoVideos';
import { api, planLabel, type Me } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { NAV } from '@/lib/nav';

/** รูปการ์ดเมนู — ยังไม่มีรูป (เมนูใหม่) ใช้ไอคอนในวงกลมแทน */
function MenuArt({ img, Icon, dim }: { img: string; Icon: React.ComponentType<{ className?: string }>; dim: boolean }) {
  const [bad, setBad] = useState(false);
  if (bad) return <div className="mx-auto grid size-20 place-items-center rounded-full bg-pink-soft text-pink sm:size-22"><Icon className="size-9" /></div>;
  return <img src={`/menu/${img}.webp`} alt="" width={88} height={88} loading="lazy" onError={() => setBad(true)}
    className={`mx-auto size-20 object-contain transition-transform group-hover:scale-110 sm:size-22 ${dim ? 'opacity-40 grayscale' : ''}`} />;
}

export default function OverviewPage() {
  const { user, entitlements, refresh } = useAuth();
  const t = useT();
  const [tk, setTk] = useState<string | null>(null); // ชื่อที่กำลังพิมพ์ → ดูรูปโปรไฟล์ก่อนบันทึก
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const tiktok = String(form.get('tiktokUsername') ?? '').trim();
    const displayName = String(form.get('displayName') ?? '').trim();
    setBusy(true);
    setMsg(null);
    try {
      await api<{ user: Me }>('/api/auth/me', {
        method: 'PATCH',
        body: { tiktokUsername: tiktok || null, ...(displayName ? { displayName } : {}) },
      });
      await refresh();
      setMsg({ tone: 'success', text: t('บันทึกแล้ว') });
    } catch (err) {
      setMsg({ tone: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* หัว: ทักทาย (ซ้าย) · แพลน (ขวา) */}
      <PageHeader title={t('สวัสดี {name} 👋', { name: user.displayName ?? '' })} description={t('ตั้งค่าครั้งเดียว วิดเจ็ตทุกตัวจะเชื่อมกับไลฟ์ของคุณอัตโนมัติ')}
        actions={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-line bg-white px-4 py-2.5 text-sm shadow-sm">
            <span className="text-muted">{t('แพลนของคุณ')}</span>
            <Badge tone={entitlements?.plan === 'free' ? 'gray' : 'pink'}>{planLabel(entitlements)}</Badge>
            {entitlements?.plan !== 'pro' && (
              <Link href="/dashboard/billing/" className="inline-flex items-center gap-1 font-medium text-pink hover:underline">
                {entitlements?.plan === 'trial' ? t('สมัคร Pro ไว้เลย (ยังไม่เก็บเงินจนหมดช่วงฟรี)') : t('อัปเกรดเป็น Pro')} <ArrowRight className="size-4" />
              </Link>
            )}
          </div>
        } />

      {/* เมนูเป็นการ์ดใหญ่ มีรูป VJ */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {NAV.filter((n) => n.img !== 'overview').map((n) => {
          const soon = 'soon' in n && n.soon;
          const body = (
            <>
              <MenuArt img={n.img} Icon={n.icon} dim={!!soon} />
              <div className="mt-2 text-center text-sm font-semibold text-ink">{t(n.label)}</div>
              <div className="mt-0.5 line-clamp-2 text-center text-xs text-muted">{soon ? t('กำลังพัฒนา') : t(n.desc)}</div>
            </>
          );
          return soon
            ? <div key={n.href} className="cursor-not-allowed rounded-2xl border border-line bg-white/60 p-3">{body}</div>
            : <Link key={n.href} href={n.href} className="group rounded-2xl border border-line bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-pink/40 hover:shadow-md">{body}</Link>;
        })}
      </div>

      {/* คลิปตัวอย่างบนไลฟ์จริง → เห็นภาพว่าวิดเจ็ตหน้าตาแบบไหนก่อนตั้งค่า */}
      <Card className="mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">{t('ตัวอย่างบนไลฟ์จริง')}</h2>
          <Link href="/dashboard/widgets/" className="inline-flex items-center gap-1 text-sm font-medium text-pink hover:underline">{t('เลือกวิดเจ็ต')} <ArrowRight className="size-4" /></Link>
        </div>
        <PromoVideos small />
      </Card>

      <Card>
        <h2 className="mb-4 font-medium">{t('โปรไฟล์')}</h2>
        <form onSubmit={onSave} className="grid gap-4 md:grid-cols-2">
          <Field label={t('ชื่อ TikTok (username)')} hint={t('ชื่อหลัง @ ในลิงก์โปรไฟล์ เช่น tiktok.com/@mimi_live → mimi_live')}>
            <div className="flex items-center gap-3">
              <TikTokAvatar username={tk ?? user.tiktokUsername} size={44} />
              <div className="flex min-w-0 flex-1">
                <span className="grid place-items-center rounded-l-xl border border-r-0 border-line bg-canvas px-3 text-sm text-muted">@</span>
                <Input name="tiktokUsername" defaultValue={user.tiktokUsername ?? ''} placeholder="your_tiktok" className="min-w-0 rounded-l-none" pattern="@?[A-Za-z0-9._]{2,24}"
                  onBlur={(e) => setTk(e.target.value)} />
              </div>
            </div>
          </Field>
          <Field label={t('ชื่อที่แสดง')}>
            <Input name="displayName" defaultValue={user.displayName ?? ''} maxLength={60} />
          </Field>
          {msg && <div className="md:col-span-2"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
          <div className="flex flex-wrap items-center gap-4 md:col-span-2">
            <Button type="submit" loading={busy}>{t('บันทึก')}</Button>
          </div>
        </form>
        <div className="mt-4 border-t border-line pt-4"><ChangePassword inline /></div>
      </Card>

      {/* โปรไฟล์อยู่บนสุด (ต้องตั้งชื่อ TikTok ก่อนใช้งาน) → กฎ Actions ตามมาด้านล่าง */}
      <div className="mt-5"><ActiveRules /></div>
    </div>
  );
}
