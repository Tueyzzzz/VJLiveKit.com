'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { Input } from './ui';
import { api } from '@/lib/api';
import { useLang, useT } from '@/lib/i18n';

interface Gift { name: string; image?: string; diamonds: number; seen: number; th?: string }
const EMOJI: Record<string, string> = { rose: '🌹', 'finger heart': '🫰', perfume: '🧴', galaxy: '🌌', lion: '🦁', universe: '🪐', 'tiktok universe': '🪐', tiktok: '🎵', gg: '🎮', 'ice cream cone': '🍦', doughnut: '🍩', corgi: '🐶', 'money gun': '💸', swan: '🦢', train: '🚂', fireworks: '🎆', 'sports car': '🏎️', falcon: '🦅', 'heart me': '💗', 'hand hearts': '🫶', confetti: '🎉', 'paper crane': '🕊️', rosa: '🌹', interstellar: '🚀' };

let cache: Gift[] | null = null;

let pending: Promise<Gift[]> | null = null;
/** รายการของขวัญ (โหลดครั้งเดียว ใช้ร่วมกันทั้งหน้า) */
export function useGifts(): Gift[] {
  const [gifts, setGifts] = useState<Gift[]>(cache ?? []);
  useEffect(() => {
    if (cache) return;
    pending ??= api<{ gifts: Gift[] }>('/api/gifts').then((r) => (cache = r.gifts)).catch(() => []);
    void pending.then(setGifts);
  }, []);
  return gifts;
}

/** ช่องของขวัญในรายการกฎ: รูป + ชื่อ + ราคา · ไม่ระบุ = ทุกกิฟต์ */
export function GiftCell({ name, event }: { name?: string; event: string }) {
  const t = useT();
  const [lang] = useLang();
  const gifts = useGifts();
  const g = name ? gifts.find((x) => x.name.toLowerCase() === name.toLowerCase()) : undefined;
  const icon = event === 'gift' ? (name ? null : '🎁') : ({ follow: '➕', share: '🔗', like: '❤️', chat: '💬' } as Record<string, string>)[event] ?? '✨';
  const evLabel = ({ follow: 'ติดตาม', share: 'แชร์', like: 'กดไลก์', chat: 'แชท' } as Record<string, string>)[event];
  const label = event === 'gift' ? (name || t('ทุกกิฟต์')) : evLabel ? t(evLabel) : event;
  const th = lang === 'en' ? undefined : g?.th; // ภาษาอังกฤษ → ใช้ชื่อกิฟต์อังกฤษ (g.name / label)
  return (
    <div className="flex w-24 shrink-0 flex-col items-center gap-0.5 text-center">
      <div className="grid size-12 place-items-center rounded-xl bg-pink-soft/60">
        {g?.image ? <img src={g.image} alt={g.name} className="size-10 object-contain" loading="lazy" />
          : <span className="text-2xl">{icon ?? EMOJI[(name ?? '').toLowerCase()] ?? '🎁'}</span>}
      </div>
      <span className="w-full truncate text-xs font-medium" title={th ? `${label} · ${th}` : label}>{th || label}</span>
      {g && <span className="text-[10px] text-muted">💎 {g.diamonds.toLocaleString()}</span>}
    </div>
  );
}

/** ดรอปดาวน์เลือกของขวัญ (มีรูป + ราคา) — พิมพ์ค้นหาหรือใส่ชื่อเองได้ · ว่าง = ทุกกิฟต์ */
export function GiftPicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const t = useT();
  const [lang] = useLang();
  const [gifts, setGifts] = useState<Gift[]>(cache ?? []);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!cache) api<{ gifts: Gift[] }>('/api/gifts').then((r) => { cache = r.gifts; setGifts(r.gifts); }).catch(() => {}); }, []);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close);
  }, []);
  const list = useMemo(() => { const qq = q.trim().toLowerCase(); return qq ? gifts.filter((g) => g.name.toLowerCase().includes(qq) || (g.th ?? '').includes(qq) || String(g.diamonds) === qq) : gifts; }, [gifts, q]);
  const sel = gifts.find((g) => g.name.toLowerCase() === value.trim().toLowerCase());
  const icon = (g?: Gift, name = '') => g?.image
    ? <img src={g.image} alt="" className="size-7 object-contain" />
    : <span className="grid size-7 place-items-center text-lg">{EMOJI[(g?.name ?? name).toLowerCase()] ?? '🎁'}</span>;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-xl border border-line bg-white px-3 py-1.5 text-left text-sm hover:border-pink/50">
        {value ? icon(sel, value) : <span className="grid size-7 place-items-center text-lg">🎁</span>}
        <span className="flex-1 truncate">{value ? <>{value}{sel && <span className="ml-1 text-muted">· 💎 {sel.diamonds.toLocaleString('th-TH')}</span>}</> : <span className="text-muted">{t('ทุกกิฟต์')}</span>}</span>
        {value && <span role="button" tabIndex={0} aria-label={t('ล้าง')} onClick={(e) => { e.stopPropagation(); onChange(''); }} className="text-muted hover:text-ink"><X className="size-4" /></span>}
        <ChevronDown className="size-4 text-muted" />
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-1 w-[min(26rem,calc(100vw-2rem))] min-w-full rounded-xl border border-line bg-white p-2 shadow-lg">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('ค้นหาชื่อไทย/อังกฤษ หรือราคาเพชร')} className="pl-8"
              onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) { e.preventDefault(); onChange(list[0]?.name ?? q.trim()); setOpen(false); setQ(''); } }} />
          </div>
          <div className="grid max-h-80 grid-cols-4 gap-1.5 overflow-y-auto overflow-x-hidden">
            <button type="button" onClick={() => { onChange(''); setOpen(false); }} className={`flex flex-col items-center rounded-lg p-1.5 text-xs hover:bg-pink-soft ${!value ? 'bg-pink-soft' : ''}`}>
              <span className="grid size-10 place-items-center text-2xl">✨</span>{t('ทุกกิฟต์')}
            </button>
            {list.map((g) => (
              <button key={g.name} type="button" onClick={() => { onChange(g.name); setOpen(false); setQ(''); }} title={g.th && lang !== 'en' ? `${g.name} · ${g.th}` : g.name}
                className={`flex flex-col items-center rounded-lg p-1.5 text-xs hover:bg-pink-soft ${sel?.name === g.name ? 'bg-pink-soft' : ''}`}>
                <span className="grid size-10 place-items-center">{g.image ? <img src={g.image} alt="" loading="lazy" className="size-10 object-contain" /> : <span className="text-2xl">{EMOJI[g.name.toLowerCase()] ?? '🎁'}</span>}</span>
                <span className="w-full truncate text-center">{g.name}</span>
                {g.th && lang !== 'en' && <span className="w-full truncate text-center text-[10px] text-muted">{g.th}</span>}
                <span className="text-[10px] text-muted">💎 {g.diamonds.toLocaleString('th-TH')}</span>
              </button>
            ))}
            {q.trim() && !list.some((g) => g.name.toLowerCase() === q.trim().toLowerCase()) && (
              <button type="button" onClick={() => { onChange(q.trim()); setOpen(false); setQ(''); }} className="col-span-full rounded-lg border border-dashed border-line p-2 text-xs hover:bg-pink-soft">
                {t('ใช้ชื่อ “{name}”', { name: q.trim() })}
              </button>
            )}
          </div>
          <p className="mt-2 text-[10px] text-muted">{t('รายการของขวัญและรูปจริงอัปเดตจาก TikTok อัตโนมัติ · ไม่เจอให้พิมพ์ชื่ออังกฤษตามใน TikTok')}</p>
        </div>
      )}
    </div>
  );
}
