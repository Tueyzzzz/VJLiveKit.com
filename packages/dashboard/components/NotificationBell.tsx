'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useLang, useT } from '@/lib/i18n';

interface Note { id: string; title: string; body: string; link?: string; icon?: string; createdAt: string }
const SEEN = 'vjl-notif-seen';

const readSeen = (): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem(SEEN) || '[]') as string[]); } catch { return new Set(); } };
const writeSeen = (s: Set<string>) => { try { localStorage.setItem(SEEN, JSON.stringify([...s].slice(-300))); } catch { /* ignore */ } };

/** กระดิ่งแจ้งเตือน (ข่าวจากทีมงาน) — จุดแดงบอกจำนวนที่ยังไม่อ่าน · บนมือถือเปิดเป็นแผงเต็มความกว้าง */
export function NotificationBell() {
  const t = useT();
  const [lang] = useLang();
  const [notes, setNotes] = useState<Note[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => api<{ notifications: Note[] }>('/api/notifications').then((r) => setNotes(r.notifications)).catch(() => {}), []);
  useEffect(() => { setSeen(readSeen()); void load(); const tm = setInterval(load, 120_000); return () => clearInterval(tm); }, [load]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const unread = notes.filter((n) => !seen.has(n.id)).length;
  function toggle() {
    const next = !open; setOpen(next);
    if (next && unread) { const s = new Set([...seen, ...notes.map((n) => n.id)]); setSeen(s); writeSeen(s); } // เปิดดู = อ่านแล้ว (จุดแดงหาย แต่ยังเน้นรายการใหม่ในรอบนี้)
  }
  const when = (s: string) => new Date(s).toLocaleString(lang === 'en' ? 'en-US' : 'th-TH', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div ref={ref} className="relative">
      <button onClick={toggle} aria-label={t('การแจ้งเตือน')} aria-expanded={open}
        className="relative grid size-10 place-items-center rounded-xl border border-line bg-white text-muted transition hover:text-ink">
        <Bell className="size-[18px]" />
        {unread > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-pink px-1 text-[11px] font-bold text-white ring-2 ring-white">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-16 z-50 max-h-[75dvh] overflow-hidden rounded-2xl border border-line bg-white shadow-2xl md:absolute md:inset-x-auto md:left-0 md:top-12 md:w-80">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="font-medium">{t('การแจ้งเตือน')}</span>
            <button onClick={() => setOpen(false)} aria-label={t('ปิด')} className="text-muted hover:text-ink"><X className="size-4" /></button>
          </div>
          <ul className="max-h-[60dvh] divide-y divide-line overflow-y-auto">
            {notes.length === 0 ? <li className="px-4 py-8 text-center text-sm text-muted">{t('ยังไม่มีการแจ้งเตือน')}</li> : notes.map((n) => {
              const body = (
                <div className="flex gap-3 px-4 py-3">
                  <span className="text-xl leading-none">{n.icon || '📢'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{n.title}</div>
                    {n.body && <p className="mt-0.5 whitespace-pre-line text-sm text-muted">{n.body}</p>}
                    <div className="mt-1 text-[11px] text-muted/80">{when(n.createdAt)}</div>
                  </div>
                </div>
              );
              return (
                <li key={n.id} className="hover:bg-pink-soft/40">
                  {n.link ? (n.link.startsWith('/') ? <Link href={n.link} onClick={() => setOpen(false)}>{body}</Link> : <a href={n.link} target="_blank" rel="noopener">{body}</a>) : body}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
