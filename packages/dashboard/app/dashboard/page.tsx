'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Badge, Card, PageHeader } from '@/components/ui';
import { ProfileForm } from '@/components/ProfileEdit';
import { ActiveRules } from '@/components/ActiveRules';
import { PromoVideos } from '@/components/PromoVideos';
import { planLabel } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { NAV } from '@/lib/nav';

/** รูปการ์ดเมนู — ยังไม่มีรูป (เมนูใหม่) ใช้ไอคอนในวงกลมแทน */
function MenuArt({ img, Icon, dim }: { img: string; Icon: React.ComponentType<{ className?: string }>; dim: boolean }) {
  const [bad, setBad] = useState(false);
  // พื้นไล่สีชมพูอ่อนหลังรูป → รูปวีเจเด่นออกจากการ์ดขาว
  return (
    <div className={`relative grid place-items-center rounded-2xl py-2 ${dim ? 'bg-gray-50' : 'bg-[radial-gradient(circle_at_50%_45%,#ffe0f0_0%,#f3eaff_55%,transparent_80%)]'}`}>
      {bad ? <div className="grid size-28 place-items-center rounded-full bg-pink-soft text-pink sm:size-36"><Icon className="size-12" /></div>
        : <img src={`/menu/${img}.webp`} alt="" width={144} height={144} loading="lazy" onError={() => setBad(true)}
          className={`size-32 object-contain drop-shadow-md transition-transform duration-300 group-hover:scale-110 sm:size-36 ${dim ? 'opacity-40 grayscale' : ''}`} />}
      {/* ไอคอนฟังก์ชันมุมขวาล่าง — รูปวีเจเด่น แต่ยังรู้ทันทีว่าเมนูนี้ทำอะไร */}
      <span className={`absolute bottom-1 right-[calc(50%-4.6rem)] grid size-10 place-items-center rounded-full text-white shadow-lg ring-[3px] ring-white sm:right-[calc(50%-5.2rem)] ${dim ? 'bg-muted' : 'brand-gradient'}`}><Icon className="size-5" /></span>
    </div>
  );
}

export default function OverviewPage() {
  const { user, entitlements } = useAuth();
  const t = useT();
  if (!user) return null;

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
              <div className="mt-2.5 text-center text-[15px] font-bold leading-tight text-ink sm:text-base">{t(n.label)}</div>
              <div className="mt-1 line-clamp-2 text-center text-xs text-muted">{soon ? t('กำลังพัฒนา') : t(n.desc)}</div>
            </>
          );
          return soon
            ? <div key={n.href} className="cursor-not-allowed rounded-3xl border border-line bg-white/60 p-3">{body}</div>
            : <Link key={n.href} href={n.href} className="group rounded-3xl border border-line bg-white p-3 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-pink/50 hover:shadow-[0_10px_30px_-10px_rgba(255,105,170,.45)]">{body}</Link>;
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

      {/* ยังไม่ตั้งชื่อ TikTok → ฟอร์มโปรไฟล์บนหน้าแรก · ตั้งแล้วแก้ได้จากไอคอนดินสอข้างการ์ดผู้ใช้ */}
      {!user.tiktokUsername && (
        <Card>
          <h2 className="mb-4 font-medium">{t('โปรไฟล์')}</h2>
          <ProfileForm />
        </Card>
      )}

      {/* โปรไฟล์อยู่บนสุด (ต้องตั้งชื่อ TikTok ก่อนใช้งาน) → กฎ Actions ตามมาด้านล่าง */}
      <div className="mt-5"><ActiveRules /></div>
    </div>
  );
}
