'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronDown, MessageCircle, X } from 'lucide-react';
import { SupportChat, useSupportUnread, type SupportMsg } from './SupportChat';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';

/** ปุ่มแชทลอยมุมขวาล่าง (ทุกหน้าแดชบอร์ด) → กล่องแชทแจ้งปัญหากับทีมงาน · มือถือเปิดเต็มจอ */
export function SupportBubble() {
  const t = useT();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const { unread } = useSupportUnread();
  const [draft, setDraft] = useState('');
  useEffect(() => {
    const f = (e: Event) => { setDraft(String((e as CustomEvent<{ text?: string }>).detail?.text ?? '')); setOpen(true); };
    window.addEventListener('vjl-open-support', f); return () => window.removeEventListener('vjl-open-support', f);
  }, []);

  const load = useCallback(async () => {
    const r = await api<{ msgs: SupportMsg[] }>('/api/support');
    window.dispatchEvent(new Event('vjl-support-read'));
    return r.msgs;
  }, []);
  const send = useCallback(async (b: { text: string; img?: string }) => { await api('/api/support', { method: 'POST', body: b }); }, []);

  if (path?.startsWith('/dashboard/admin')) return null; // แอดมินตอบที่แท็บ "แชทลูกค้า"

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-white sm:inset-auto sm:bottom-24 sm:right-5 sm:h-[34rem] sm:w-[23rem] sm:overflow-hidden sm:rounded-3xl sm:shadow-2xl sm:ring-1 sm:ring-line">
          <div className="flex items-center gap-3 bg-gradient-to-r from-pink to-violet px-4 py-3 text-white">
            <img src="/menu/support-sm.webp" alt="" className="size-10 rounded-full bg-white/30 object-cover ring-2 ring-white/60"
              onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{t('ทีมงาน VJLiveKit')}</div>
              <div className="flex items-center gap-1.5 text-xs text-white/85"><span className="size-2 rounded-full bg-mint" />{t('แจ้งปัญหา ถามวิธีใช้ — ตอบกลับที่นี่')}</div>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-full p-1.5 hover:bg-white/20" aria-label={t('ปิด')}><X className="size-5" /></button>
          </div>
          <div className="min-h-0 flex-1 [&>div]:h-full [&>div]:rounded-none [&>div]:border-0">
            <SupportChat load={load} send={send} me="user" height="min-h-0 flex-1" draft={draft} />
          </div>
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} aria-label={t('แชทกับทีมงาน')}
        className={`fixed bottom-5 right-5 z-[61] grid size-14 place-items-center rounded-full bg-gradient-to-br from-pink to-violet text-white shadow-lg shadow-pink/30 ring-4 ring-white transition hover:scale-105 ${open ? 'max-sm:hidden' : ''}`}>
        {open ? <ChevronDown className="size-7" /> : <MessageCircle className="size-7" />}
        {!open && unread > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white ring-2 ring-white">{unread}</span>}
      </button>
    </>
  );
}
