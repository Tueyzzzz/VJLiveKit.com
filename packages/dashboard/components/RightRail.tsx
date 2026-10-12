'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';

/** แถบขวา (จอกว้าง ≥1280px): ลิงก์แนะนำเพื่อน + แบนเนอร์โปรโมต (ภาพจาก GPT, ข้อความเป็น HTML ให้คม) */
export function RightRail() {
  const t = useT();
  const [link, setLink] = useState<string | null>(null);
  const [days, setDays] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  useEffect(() => { api<{ link: string; rewardDays: number }>('/api/referrals/me').then((r) => { setLink(r.link); setDays(r.rewardDays); }).catch(() => {}); }, []);
  const copy = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); } catch { window.prompt(t('คัดลอกลิงก์นี้'), link); return; }
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  return (
    <aside className="sticky top-6 hidden h-fit w-60 shrink-0 space-y-4 py-6 pr-6 xl:block 2xl:w-72">
      {link && (
        <div className="rounded-2xl border border-pink/30 bg-gradient-to-br from-pink-soft to-violet-soft p-4 shadow-sm">
          <div className="text-sm font-semibold text-ink">{t('🎁 ชวนเพื่อนมาใช้ ได้ใช้ฟรี')}</div>
          <p className="mt-1 text-xs text-muted">{days ? t('เพื่อนสมัครผ่านลิงก์นี้ คุณได้ใช้ฟรีเพิ่ม {n} วัน', { n: days }) : t('แชร์ลิงก์นี้ให้เพื่อน VJ')}</p>
          <code className="mt-2 block break-all select-all rounded-lg bg-white/80 px-2.5 py-1.5 text-[11px] text-muted">{link}</code>
          <button onClick={copy} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-medium text-pink shadow-sm transition hover:shadow-md">
            {copied ? <><Check className="size-4" /> {t('คัดลอกแล้ว')}</> : <><Copy className="size-4" /> {t('คัดลอกลิงก์แนะนำ')}</>}
          </button>
        </div>
      )}
      <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('vjl-open-support', { detail: { text: t('สนใจสั่งทำมาสคอตหน้าตัวเองค่ะ/ครับ 🎨 สไตล์ที่อยากได้: ') } }))}
        className="group relative block w-full overflow-hidden rounded-2xl text-left shadow-md transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-10px_rgba(255,105,170,.5)]">
        <img src="/promo/sidebar-ad.webp" alt="" width={793} height={1983} className="block h-auto w-full" />
        <div className="absolute inset-x-0 top-0 px-4 pt-5 text-center">
          <div className="text-[11px] font-semibold tracking-wide text-pink">{t('✨ ใหม่')}</div>
          <div className="mt-1 text-lg font-bold leading-snug text-ink">{t('มีมาสคอตเป็นหน้าตัวเอง')}</div>
          <div className="mt-1 text-xs leading-relaxed text-ink/70">{t('ทีมงานวาดตัวแทนวีเจจากรูปคุณ ครบทุกท่า เต้น · ส่งจุ๊บ · รับของขวัญ')}</div>
        </div>
        <div className="absolute inset-x-0 bottom-[6.2%] flex justify-center">
          <span className="rounded-full px-5 py-1.5 text-sm font-bold text-white drop-shadow-[0_1px_2px_rgba(160,40,90,.6)]">{t('สั่งทำเลย 💖')}</span>
        </div>
      </button>
    </aside>
  );
}
