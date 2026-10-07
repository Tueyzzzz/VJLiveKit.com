'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Eye, Gem, Heart, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { TikTokAvatar } from './TikTokAvatar';

interface Status { username: string | null; state: 'live' | 'waiting' | 'idle' | 'no-username'; viewers: number; diamonds: number; likes: number; widgets: number; since: number | null }

const nf = (n: number) => n.toLocaleString('en-US');

/**
 * แถบสถานะไลฟ์ตัวใหญ่ ชัด บนสุดของแดชบอร์ด: กำลังไลฟ์ (คนดู/เพชร/ไลก์สด) · เชื่อมต่อแล้ว รอเริ่มไลฟ์ · ยังไม่ได้ตั้งชื่อ TikTok
 * อัปเดตเองทุก 15 วินาที
 */
export function LiveStatusBar() {
  const t = useT();
  const [s, setS] = useState<Status | null>(null);
  const load = useCallback(() => api<Status>('/api/live/status').then(setS).catch(() => {}), []);
  useEffect(() => { void load(); const tm = setInterval(load, 15_000); return () => clearInterval(tm); }, [load]);
  if (!s) return null;

  const look = {
    live: { dot: 'bg-red-500 animate-pulse', box: 'border-red-200 bg-gradient-to-r from-red-50 to-pink-soft/60', badge: 'bg-red-500 text-white', text: t('🔴 กำลังไลฟ์') },
    waiting: { dot: 'bg-amber-400 animate-pulse', box: 'border-amber-200 bg-amber-50/70', badge: 'bg-amber-400 text-ink', text: t('⏳ เชื่อมต่อแล้ว — รอเริ่มไลฟ์') },
    idle: { dot: 'bg-gray-300', box: 'border-line bg-white', badge: 'bg-gray-100 text-muted', text: t('⚪ ยังไม่ได้เชื่อมต่อไลฟ์') },
    'no-username': { dot: 'bg-gray-300', box: 'border-line bg-white', badge: 'bg-gray-100 text-muted', text: t('ยังไม่ได้ตั้งชื่อ TikTok') },
  }[s.state];
  const mins = s.since ? Math.max(1, Math.round((Date.now() - s.since) / 60000)) : 0;

  return (
    <div className={`mb-6 flex flex-col gap-3 rounded-2xl border p-4 shadow-sm sm:flex-row sm:items-center ${look.box}`}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="relative">
          <TikTokAvatar username={s.username} size={48} />
          <span className={`absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full ring-2 ring-white ${look.dot}`} />
        </div>
        <div className="min-w-0">
          <div className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold sm:text-base ${look.badge}`}>{look.text}</div>
          <div className="mt-1 flex items-center gap-1.5 truncate text-sm text-muted">
            {s.username ? <>TikTok.com/<b className="text-ink">@{s.username}</b></> : t('ตั้งชื่อ TikTok เพื่อเริ่มใช้งาน')}
            <Link href="/dashboard/" title={t('แก้ชื่อ TikTok')} className="text-muted hover:text-pink"><Pencil className="size-3.5" /></Link>
          </div>
        </div>
      </div>
      {s.state === 'live' && (
        <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-4">
          <span className="flex items-center gap-1.5 rounded-xl bg-white/70 px-3 py-2 text-sm"><Eye className="size-4 text-violet" /><b>{nf(s.viewers)}</b></span>
          <span className="flex items-center gap-1.5 rounded-xl bg-white/70 px-3 py-2 text-sm"><Gem className="size-4 text-sky-500" /><b>{nf(s.diamonds)}</b></span>
          <span className="flex items-center gap-1.5 rounded-xl bg-white/70 px-3 py-2 text-sm"><Heart className="size-4 text-pink" /><b>{nf(s.likes)}</b></span>
        </div>
      )}
      {s.state === 'live' && <div className="text-xs text-muted sm:w-24 sm:text-right">{t('ไลฟ์มา {m} นาที', { m: mins })}</div>}
      {s.state === 'waiting' && <p className="text-xs text-muted sm:max-w-56">{t('ระบบต่อเข้าไลฟ์ให้อัตโนมัติเมื่อเริ่มไลฟ์ — เปิดเว็บนี้ค้างไว้ได้เลย')}</p>}
      {s.state === 'idle' && <p className="text-xs text-muted sm:max-w-56">{t('เริ่มไลฟ์ใน TikTok แล้วเปิดวิดเจ็ตในโปรแกรมไลฟ์ — สถานะจะเปลี่ยนเอง')}</p>}
      {s.state === 'no-username' && <Link href="/dashboard/" className="rounded-xl bg-pink px-4 py-2 text-center text-sm font-medium text-white">{t('ตั้งชื่อ TikTok')}</Link>}
    </div>
  );
}
