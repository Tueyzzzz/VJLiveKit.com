'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { Input } from './ui';
import { api } from '@/lib/api';

interface Gift { name: string; image?: string; diamonds: number; seen: number }
const EMOJI: Record<string, string> = { rose: '🌹', 'finger heart': '🫰', perfume: '🧴', galaxy: '🌌', lion: '🦁', universe: '🪐', 'tiktok universe': '🪐', tiktok: '🎵', gg: '🎮', 'ice cream cone': '🍦', doughnut: '🍩', corgi: '🐶', 'money gun': '💸', swan: '🦢', train: '🚂', fireworks: '🎆', 'sports car': '🏎️', falcon: '🦅', 'heart me': '💗', 'hand hearts': '🫶', confetti: '🎉', 'paper crane': '🕊️', rosa: '🌹', interstellar: '🚀' };

let cache: Gift[] | null = null;

/** ดรอปดาวน์เลือกของขวัญ (มีรูป + ราคา) — พิมพ์ค้นหาหรือใส่ชื่อเองได้ · ว่าง = ทุกกิฟต์ */
export function GiftPicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const [gifts, setGifts] = useState<Gift[]>(cache ?? []);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!cache) api<{ gifts: Gift[] }>('/api/gifts').then((r) => { cache = r.gifts; setGifts(r.gifts); }).catch(() => {}); }, []);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close);
  }, []);
  const list = useMemo(() => { const t = q.trim().toLowerCase(); return t ? gifts.filter((g) => g.name.toLowerCase().includes(t)) : gifts; }, [gifts, q]);
  const sel = gifts.find((g) => g.name.toLowerCase() === value.trim().toLowerCase());
  const icon = (g?: Gift, name = '') => g?.image
    ? <img src={g.image} alt="" className="size-7 object-contain" />
    : <span className="grid size-7 place-items-center text-lg">{EMOJI[(g?.name ?? name).toLowerCase()] ?? '🎁'}</span>;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-xl border border-line bg-white px-3 py-1.5 text-left text-sm hover:border-pink/50">
        {value ? icon(sel, value) : <span className="grid size-7 place-items-center text-lg">🎁</span>}
        <span className="flex-1 truncate">{value ? <>{value}{sel && <span className="ml-1 text-muted">· 💎 {sel.diamonds.toLocaleString('th-TH')}</span>}</> : <span className="text-muted">ทุกกิฟต์</span>}</span>
        {value && <span role="button" tabIndex={0} aria-label="ล้าง" onClick={(e) => { e.stopPropagation(); onChange(''); }} className="text-muted hover:text-ink"><X className="size-4" /></span>}
        <ChevronDown className="size-4 text-muted" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-line bg-white p-2 shadow-lg">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา หรือพิมพ์ชื่อกิฟต์" className="pl-8"
              onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) { e.preventDefault(); onChange(list[0]?.name ?? q.trim()); setOpen(false); setQ(''); } }} />
          </div>
          <div className="grid max-h-72 grid-cols-3 gap-1.5 overflow-y-auto sm:grid-cols-4">
            <button type="button" onClick={() => { onChange(''); setOpen(false); }} className={`flex flex-col items-center rounded-lg p-1.5 text-xs hover:bg-pink-soft ${!value ? 'bg-pink-soft' : ''}`}>
              <span className="grid size-10 place-items-center text-2xl">✨</span>ทุกกิฟต์
            </button>
            {list.map((g) => (
              <button key={g.name} type="button" onClick={() => { onChange(g.name); setOpen(false); setQ(''); }} title={g.name}
                className={`flex flex-col items-center rounded-lg p-1.5 text-xs hover:bg-pink-soft ${sel?.name === g.name ? 'bg-pink-soft' : ''}`}>
                <span className="grid size-10 place-items-center">{g.image ? <img src={g.image} alt="" className="size-10 object-contain" /> : <span className="text-2xl">{EMOJI[g.name.toLowerCase()] ?? '🎁'}</span>}</span>
                <span className="w-full truncate text-center">{g.name}</span>
                <span className="text-[10px] text-muted">💎 {g.diamonds.toLocaleString('th-TH')}</span>
              </button>
            ))}
            {q.trim() && !list.some((g) => g.name.toLowerCase() === q.trim().toLowerCase()) && (
              <button type="button" onClick={() => { onChange(q.trim()); setOpen(false); setQ(''); }} className="col-span-full rounded-lg border border-dashed border-line p-2 text-xs hover:bg-pink-soft">
                ใช้ชื่อ “{q.trim()}”
              </button>
            )}
          </div>
          <p className="mt-2 text-[10px] text-muted">รูปของขวัญจะขึ้นเองเมื่อมีคนส่งกิฟต์นั้นในไลฟ์ครั้งแรก · ชื่อต้องตรงกับชื่อภาษาอังกฤษใน TikTok</p>
        </div>
      )}
    </div>
  );
}
