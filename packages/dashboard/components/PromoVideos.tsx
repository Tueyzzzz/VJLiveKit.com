'use client';

import { useEffect, useRef } from 'react';
import { useT } from '@/lib/i18n';

const PROMOS = [
  { src: '/promo/promo-4.mp4', poster: '/promo/promo-4.jpg', title: '✨ ครบ 4 ฟังก์ชันในจอเดียว' },
  { src: '/promo/promo-5.mp4', poster: '/promo/promo-5.jpg', title: '🌸 โหล · มาสคอต · อันดับ · เป้าหมาย' },
  { src: '/promo/promo-1.mp4', poster: '/promo/promo-1.jpg', title: '🎡 ชิงช้าสวรรค์สะสมของขวัญ' },
  { src: '/promo/promo-2.mp4', poster: '/promo/promo-2.jpg', title: '💌 กล่องจดหมายหัวใจ' },
  { src: '/promo/promo-3.mp4', poster: '/promo/promo-3.jpg', title: '🎮 โหลสายเกมมิ่ง' },
];

/** เล่นเฉพาะตอนเห็นบนจอ (ประหยัดเน็ตมือถือ — ไม่โหลดทุกคลิปพร้อมกัน) */
function LazyVideo({ src, poster }: { src: string; poster: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); }, { threshold: 0.5 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return <video ref={ref} src={src} poster={poster} muted loop playsInline preload="none" className="aspect-[9/16] w-full rounded-3xl bg-[#17121f] object-cover shadow-lg" />;
}

/** คลิปตัวอย่างวิดเจ็ตบนจอไลฟ์มือถือ — มือถือเลื่อนซ้าย-ขวา · จอกลาง 3 คอลัมน์ · จอใหญ่ 5 คอลัมน์ */
export function PromoVideos({ small = false }: { small?: boolean }) {
  const t = useT();
  return (
    <div className={`-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5 ${small ? 'sm:mx-auto sm:max-w-4xl' : ''}`}>
      {PROMOS.map((p) => (
        <figure key={p.src} className={`${small ? 'w-[52vw] max-w-[220px]' : 'w-[68vw] max-w-[300px]'} shrink-0 snap-center sm:w-auto sm:max-w-none`}>
          <LazyVideo src={p.src} poster={p.poster} />
          <figcaption className="mt-2 text-center text-sm text-muted">{t(p.title)}</figcaption>
        </figure>
      ))}
    </div>
  );
}
