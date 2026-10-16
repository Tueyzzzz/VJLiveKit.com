'use client';

import { useEffect, useRef, useState } from 'react';
import type { Template } from '@/lib/actionTemplates';
import { useT } from '@/lib/i18n';

/** ป้าย "🔥 ยอดนิยม" / "ใหม่" บนการ์ดเทมเพลต — แก้รายการได้ที่นี่ */
const HOT = new Set(['fx-butterflies', 'fx-hearts', 'fx-coins', 'tarot-rose', 'thanks-led', 'fun-glove-chat']);
const NEW = new Set(['tarot-lakshmi', 'tarot-swords', 'fx-fireflies']);

/** ชิปบอกว่าเทมเพลตนี้ทำงานเมื่อไร (🎁 Rose / 💬 พิมพ์ … / ➕ ติดตาม) */
export function triggerChip(tp: Template, t: (s: string) => string): string {
  const tr = tp.rule.trigger;
  switch (tr.event) {
    case 'gift': return tr.giftName ? `🎁 ${tr.giftName}` : tr.minDiamonds ? `💎 ${tr.minDiamonds.toLocaleString('en-US')}+` : `🎁 ${t('ของขวัญ')}`;
    case 'chat': return tr.keyword ? `💬 ${t('พิมพ์')} “${tr.keyword}”` : `💬 ${t('แชท')}`;
    case 'follow': return `➕ ${t('ติดตาม')}`;
    case 'share': return `🔁 ${t('แชร์')}`;
    case 'like': return `❤️ ${t('กดหัวใจ')}`;
    case 'chest': return `🎁 ${t('กล่องสมบัติ')}`;
    case 'superfanbox': return `💜 ${t('ถุงม่วง')}`;
    case 'join': return `👋 ${t('เข้าห้อง')}`;
    default: return `⚡ ${tr.event}`;
  }
}

/**
 * ตัวอย่างเทมเพลตในกรอบมือถือ 9:16 แบบหน้าจอ TikTok LIVE (ชื่อโฮสต์ · LIVE · คนดู · คอมเมนต์จาง ๆ)
 * ภาพนิ่ง /tpl/<id>.webp เป็นค่าเริ่มต้น → เล่น /tpl/<id>.anim.webp เฉพาะตอนการ์ดอยู่ในจอ หรือชี้เมาส์ (เบา ไม่โหลดทุกใบพร้อมกัน)
 */
export function TemplatePreview({ tp }: { tp: Template }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false), [hover, setHover] = useState(false), [bad, setBad] = useState(false); // bad = รูปตัวอย่างโหลดไม่ได้ → โชว์ไอคอนแทน
  useEffect(() => {
    const el = ref.current; if (!el || !tp.id || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { threshold: 0.6 });
    io.observe(el); return () => io.disconnect();
  }, [tp.id]);
  const play = !!tp.id && (seen || hover) && !tp.thumb && !bad;
  const badge = tp.id && HOT.has(tp.id) ? 'hot' : tp.id && NEW.has(tp.id) ? 'new' : null;
  return (
    <div ref={ref} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="relative flex justify-center overflow-hidden bg-gradient-to-br from-pink-soft via-white to-violet-soft px-3 pb-2.5 pt-3">
      {/* กรอบมือถือ */}
      <div className="relative aspect-[9/16] w-full max-w-[168px] overflow-hidden rounded-[18px] bg-violet-soft shadow-[0_8px_22px_-8px_rgba(120,60,160,.45)] ring-[3px] ring-ink/85 transition-transform duration-300 group-hover:-translate-y-0.5">
        {tp.thumb ? (
          // รูปย่อ (เช่น มุกแกล้งวีเจ) แทนตัวอย่างอัดจอ
          <div className="absolute inset-0 grid place-items-center bg-gradient-to-b from-[#c9b8e8] via-[#e7d6ee] to-[#f6c9da]">
            <img src={tp.thumb} alt={t(tp.title)} width={192} height={192} loading="lazy" decoding="async" className={`w-[78%] object-contain drop-shadow-[0_6px_10px_rgba(80,40,110,.35)]`} />
          </div>
        ) : tp.id && !bad ? (
          <>
            <img src={`/tpl/${tp.id}.webp`} alt="" onError={() => setBad(true)} width={270} height={480} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
            {play && <img src={`/tpl/${tp.id}.anim.webp`} alt="" aria-hidden width={270} height={480} decoding="async" className="absolute inset-0 size-full object-cover" />}
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-gradient-to-b from-pink-soft to-violet-soft text-5xl">{tp.icon}</div>
        )}
        {/* UI แบบไลฟ์ TikTok (ตกแต่ง) */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-1 bg-gradient-to-b from-black/25 to-transparent p-1.5 pb-4">
          <div className="flex min-w-0 items-center gap-1 rounded-full bg-black/30 py-0.5 pl-0.5 pr-1.5 backdrop-blur-sm">
            <span className="size-3.5 shrink-0 rounded-full bg-gradient-to-br from-pink to-violet ring-1 ring-white/80" />
            <span className="truncate text-[7px] font-semibold leading-none text-white">mimi</span>
            <span className="rounded-full bg-pink px-1 text-[6px] font-bold leading-[9px] text-white">+</span>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <span className="rounded-[3px] bg-gradient-to-r from-[#ff2d55] to-[#ff5c8a] px-1 text-[6.5px] font-bold leading-[11px] tracking-wide text-white">LIVE</span>
            <span className="rounded-full bg-black/30 px-1 text-[6.5px] leading-[11px] text-white">👁 1.2K</span>
          </div>
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 space-y-0.5 bg-gradient-to-t from-black/25 to-transparent p-1.5 pt-6 opacity-80">
          <div className="w-fit max-w-[80%] truncate rounded-full bg-black/25 px-1.5 text-[6.5px] leading-[11px] text-white"><b className="text-pink-soft">nana</b> {t('น่ารักมาก')} 💕</div>
          <div className="w-fit max-w-[80%] truncate rounded-full bg-black/25 px-1.5 text-[6.5px] leading-[11px] text-white"><b className="text-yellow-200">boss</b> {t('ส่งกุหลาบ')} 🌹</div>
          <div className="flex items-center gap-1">
            <span className="h-3 flex-1 rounded-full bg-white/25" />
            <span className="text-[8px] leading-none">🎁</span><span className="text-[8px] leading-none">❤️</span>
          </div>
        </div>
        <span className="absolute left-1/2 top-[3px] h-1 w-6 -translate-x-1/2 rounded-full bg-ink/80" />
      </div>
      <span className="absolute left-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-white/90 text-sm shadow-sm sm:size-8 sm:text-base">{tp.icon}</span>
      {badge && (
        <span className={`absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm sm:text-[11px] ${badge === 'hot' ? 'bg-gradient-to-r from-[#ff7a3d] to-[#ff3d7f]' : 'bg-gradient-to-r from-violet to-[#5b8cff]'}`}>
          {badge === 'hot' ? `🔥 ${t('ยอดนิยม')}` : t('ใหม่')}
        </span>
      )}
    </div>
  );
}
