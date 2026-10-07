'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Send, X } from 'lucide-react';
import { Alert, Button, cx } from './ui';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';
export interface SupportMsg { id: string; from: 'user' | 'admin'; text: string; img?: string; ts: string }

/** ย่อรูปก่อนส่ง (กว้างสุด 1280px · jpeg) — แคปจอมือถือส่งได้ไว */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const k = Math.min(1, 1280 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  } finally { URL.revokeObjectURL(url); }
}

/** กล่องแชท — me = ฝั่งที่กำลังดู (ลูกค้า 'user' / แอดมิน 'admin') */
export function SupportChat({ load, send, me, height = 'h-[60dvh]' }: {
  load: () => Promise<SupportMsg[]>; send: (b: { text: string; img?: string }) => Promise<void>; me: 'user' | 'admin'; height?: string;
}) {
  const t = useT();
  const [msgs, setMsgs] = useState<SupportMsg[] | null>(null);
  const [text, setText] = useState('');
  const [img, setImg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => load().then(setMsgs).catch((e) => setErr((e as Error).message)), [load]);
  useEffect(() => {
    void refresh();
    const tm = setInterval(refresh, 15_000);
    window.addEventListener('vjl-support', refresh); // อีกฝั่งตอบ → socket แจ้ง → โหลดใหม่ทันที
    return () => { clearInterval(tm); window.removeEventListener('vjl-support', refresh); };
  }, [refresh]);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [msgs?.length]);

  async function submit() {
    if (!text.trim() && !img) return;
    setBusy(true); setErr(null);
    try { await send({ text: text.trim(), ...(img ? { img } : {}) }); setText(''); setImg(null); await refresh(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white">
      <div ref={box} className={cx('space-y-3 overflow-y-auto bg-canvas/60 p-3 sm:p-4', height)}>
        {msgs === null ? <p className="text-center text-sm text-muted">…</p>
          : msgs.length === 0 ? <p className="py-10 text-center text-sm text-muted">{me === 'user' ? t('พิมพ์ปัญหาที่เจอ แนบรูปหน้าจอได้ — ทีมงานจะตอบกลับที่นี่') : t('ยังไม่มีข้อความ')}</p>
          : msgs.map((m) => {
            const mine = m.from === me;
            return (
              <div key={m.id} className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
                <div className={cx('max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[70%]', mine ? 'rounded-br-md bg-pink text-white' : 'rounded-bl-md bg-white text-ink ring-1 ring-line')}>
                  {!mine && <div className="mb-0.5 text-[11px] font-medium text-violet">{m.from === 'admin' ? t('ทีมงาน VJLiveKit') : t('ลูกค้า')}</div>}
                  {m.img && <a href={`${API_BASE}/api/support/img/${m.img}`} target="_blank" rel="noreferrer"><img src={`${API_BASE}/api/support/img/${m.img}`} alt="" className="mb-1 max-h-60 rounded-lg" /></a>}
                  {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                  <div className={cx('mt-0.5 text-right text-[10px]', mine ? 'text-white/70' : 'text-muted')}>{new Date(m.ts).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</div>
                </div>
              </div>
            );
          })}
      </div>
      {me === 'user' && <p className="border-t border-line bg-canvas/60 px-3 py-1.5 text-center text-[11px] text-muted">{t('🔒 แชทนี้จะถูกลบเมื่อแก้ไขปัญหาเสร็จ')}</p>}
      {err && <div className="px-3 pt-2"><Alert>{err}</Alert></div>}
      {img && (
        <div className="relative mx-3 mt-2 w-fit">
          <img src={img} alt="" className="h-20 rounded-lg ring-1 ring-line" />
          <button onClick={() => setImg(null)} className="absolute -right-2 -top-2 rounded-full bg-ink p-0.5 text-white" aria-label={t('เอารูปออก')}><X className="size-3.5" /></button>
        </div>
      )}
      <div className="flex items-end gap-2 border-t border-line p-2 sm:p-3">
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setImg(await shrink(f).catch(() => null)); }} />
        <button type="button" onClick={() => fileRef.current?.click()} className="grid size-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-violet-soft hover:text-ink" title={t('แนบรูป')} aria-label={t('แนบรูป')}><ImagePlus className="size-5" /></button>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={2000} placeholder={t('พิมพ์ข้อความ…')}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); } }}
          className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-line px-3 py-2 text-sm focus:border-violet focus:outline-none" />
        <Button onClick={() => void submit()} loading={busy} disabled={!text.trim() && !img} className="h-10 shrink-0 px-3" aria-label={t('ส่ง')}><Send className="size-4" /></Button>
      </div>
    </div>
  );
}

/** จำนวนข้อความที่ยังไม่อ่าน (ลูกค้า + แอดมิน) — ใช้ทำตัวเลขแดงในเมนู */
export function useSupportUnread(): { unread: number; admin: number } {
  const [s, setS] = useState({ unread: 0, admin: 0 });
  useEffect(() => {
    const f = () => api<{ unread: number; admin?: number }>('/api/support/unread').then((r) => setS({ unread: r.unread, admin: r.admin ?? 0 })).catch(() => {});
    void f(); const tm = setInterval(f, 60_000);
    window.addEventListener('vjl-support', f); window.addEventListener('vjl-support-read', f);
    return () => { clearInterval(tm); window.removeEventListener('vjl-support', f); window.removeEventListener('vjl-support-read', f); };
  }, []);
  return s;
}
