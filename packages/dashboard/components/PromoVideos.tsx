'use client';

import { useT } from '@/lib/i18n';

const PROMOS = [
  { src: '/promo/promo-1.mp4', poster: '/promo/promo-1.jpg', title: '🎡 ชิงช้าสวรรค์สะสมของขวัญ' },
  { src: '/promo/promo-2.mp4', poster: '/promo/promo-2.jpg', title: '💌 กล่องจดหมายหัวใจ' },
  { src: '/promo/promo-3.mp4', poster: '/promo/promo-3.jpg', title: '🎮 โหลสายเกมมิ่ง' },
];

/** คลิปตัวอย่างวิดเจ็ตบนจอไลฟ์มือถือ — มือถือเลื่อนซ้าย-ขวา · จอใหญ่ 3 คอลัมน์ */
export function PromoVideos({ small = false }: { small?: boolean }) {
  const t = useT();
  return (
    <div className={`-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 ${small ? 'sm:mx-auto sm:max-w-3xl' : ''}`}>
      {PROMOS.map((p) => (
        <figure key={p.src} className={`${small ? 'w-[52vw] max-w-[220px]' : 'w-[68vw] max-w-[300px]'} shrink-0 snap-center sm:w-auto sm:max-w-none`}>
          <video src={p.src} poster={p.poster} autoPlay muted loop playsInline preload="none" className="aspect-[9/16] w-full rounded-3xl bg-[#17121f] object-cover shadow-lg" />
          <figcaption className="mt-2 text-center text-sm text-muted">{t(p.title)}</figcaption>
        </figure>
      ))}
    </div>
  );
}
