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

/**
 * คลิปตัวอย่างวิดเจ็ตบนจอไลฟ์มือถือ — มือถือเลื่อนซ้าย-ขวา · จอกลาง 3 คอลัมน์ · จอใหญ่ 5 คอลัมน์
 * คลิปยาวไม่เท่ากัน → เล่นพร้อมกันแล้วเริ่มใหม่พร้อมกันทุกรอบ (คลิปสั้นค้างที่โลโก้ตอนจบรอ) ไม่เหลื่อมกันจนดูเละ
 * เล่นเฉพาะคลิปที่เห็นบนจอ (ประหยัดเน็ตมือถือ)
 */
export function PromoVideos({ small = false }: { small?: boolean }) {
  const t = useT();
  const refs = useRef<(HTMLVideoElement | null)[]>([]);
  useEffect(() => {
    const vids = refs.current.filter((v): v is HTMLVideoElement => !!v);
    const seen = new Set<HTMLVideoElement>();
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      const v = e.target as HTMLVideoElement;
      if (e.isIntersecting) { seen.add(v); v.play().catch(() => {}); } else { seen.delete(v); v.pause(); }
    }), { threshold: 0.5 });
    vids.forEach((v) => io.observe(v));
    // เริ่มรอบใหม่พร้อมกันเมื่อคลิปที่ยาวสุด (ที่กำลังเห็น) จบ
    const restart = () => { if ([...seen].every((v) => v.ended || v.paused)) seen.forEach((v) => { v.currentTime = 0; v.play().catch(() => {}); }); };
    vids.forEach((v) => v.addEventListener('ended', restart));
    return () => { io.disconnect(); vids.forEach((v) => v.removeEventListener('ended', restart)); };
  }, []);
  return (
    <div className={`-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5 ${small ? 'sm:mx-auto sm:max-w-4xl' : ''}`}>
      {PROMOS.map((p, i) => (
        <figure key={p.src} className={`${small ? 'w-[52vw] max-w-[220px]' : 'w-[68vw] max-w-[300px]'} shrink-0 snap-center sm:w-auto sm:max-w-none`}>
          <video ref={(el) => { refs.current[i] = el; }} src={p.src} poster={p.poster} muted playsInline preload="none" className="aspect-[9/16] w-full rounded-3xl bg-[#17121f] object-cover shadow-lg" />
          <figcaption className="mt-2 text-center text-sm text-muted">{t(p.title)}</figcaption>
        </figure>
      ))}
    </div>
  );
}
