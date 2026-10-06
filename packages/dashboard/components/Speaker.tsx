'use client';

import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { api, getToken, type Rule } from '@/lib/api';
import { cx } from './ui';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';
const KEY = 'vjl-speaker';

interface Fire { name: string; times?: number; action: Rule['action']; event?: { user?: { nickname?: string; uniqueId?: string } } }
interface SocketLike { on: (ev: string, fn: (d: never) => void) => void; emit?: (ev: string, d: unknown) => void; disconnect: () => void }
type IoFn = (url: string, opts: object) => SocketLike;
type Sfx = { play: (id: string, vol?: number) => boolean };

/** โหลดสคริปต์ครั้งเดียว (socket.io client + เสียงสำเร็จรูป มาจากเซิร์ฟเวอร์เดียวกัน ไม่ต้องลงแพ็กเกจเพิ่ม) */
const loaded: Record<string, Promise<void>> = {};
function loadScript(src: string): Promise<void> {
  return (loaded[src] ??= new Promise((ok, bad) => {
    const s = document.createElement('script'); s.src = src; s.onload = () => ok(); s.onerror = () => { delete loaded[src]; bad(new Error(src)); };
    document.head.appendChild(s);
  }));
}

/**
 * เชื่อมแดชบอร์ดกับระบบ (แบบ TikFinity) — เปิดเว็บค้างไว้หน้าไหนก็ได้:
 * - วิดเจ็ตในโปรแกรมไลฟ์ทำงานเฉพาะตอนเปิดเว็บอยู่ (ปิดเว็บ → พักหลัง 90 วินาที)
 * - กฎ "เล่นเสียง" ดังที่เครื่องนี้ (ปิดได้ → ไปดังที่ลิงก์ FX แทน) · กันจอดับระหว่างเปิด
 */
export function Speaker({ username }: { username?: string | null }) {
  const [on, setOn] = useState(true);
  const [hasSound, setHasSound] = useState(false);
  const [live, setLive] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRef = useRef(true);
  const sockRef = useRef<(SocketLike & { emit?: (ev: string, d: unknown) => void }) | null>(null);

  useEffect(() => { try { const v = localStorage.getItem(KEY) !== 'off'; setOn(v); onRef.current = v; } catch { /* ignore */ } }, []);
  // มีกฎเสียงที่เปิดอยู่ไหม (เช็กซ้ำทุกนาที เผื่อเพิ่งสร้างกฎ)
  useEffect(() => {
    const check = () => api<{ rules: Rule[] }>('/api/actions').then((r) => setHasSound(r.rules.some((x) => x.enabled && x.action.type === 'sound'))).catch(() => {});
    check(); const t = setInterval(check, 60_000); return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!username) { setLive(false); return; }
    let sock: SocketLike | null = null, lock: { release: () => Promise<void> } | null = null, dead = false;
    const keepAwake = async () => { try { lock = await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen') ?? null; } catch { /* ไม่รองรับ */ } };
    const onVis = () => { if (document.visibilityState === 'visible') void keepAwake(); };
    void (async () => {
      try { await Promise.all([loadScript(`${API_BASE}/socket.io/socket.io.js`), loadScript(`${API_BASE}/overlay/js/sfx.js`)]); } catch { return; }
      const io = (window as unknown as { io?: IoFn }).io;
      if (dead || !io) return;
      sock = io(API_BASE || location.origin, { query: { session: getToken() ?? '', play: onRef.current ? '1' : '0' }, transports: ['websocket', 'polling'] });
      sockRef.current = sock;
      sock.on('ready', () => setLive(true));
      sock.on('disconnect', () => setLive(false));
      sock.on('action', (f: Fire) => {
        const who = f.event?.user?.nickname || f.event?.user?.uniqueId || '';
        if (f.action.type === 'sound' && onRef.current) {
          const sfx = (window as unknown as { VJLSfx?: Sfx }).VJLSfx;
          const n = Math.max(1, Math.min(20, f.times ?? 1)); // คอมโบ → ดังซ้ำตามจำนวน (ไม่เกินที่ตั้ง)
          for (let i = 0; i < n; i++) setTimeout(() => {
            if (f.action.sound && sfx) sfx.play(f.action.sound);
            else if (f.action.url) void new Audio(f.action.url).play().catch(() => {});
          }, i * 700);
        }
        setToast(`${who ? who + ' → ' : ''}${f.name}${(f.times ?? 1) > 1 ? ` ×${f.times}` : ''}`);
        if (toastT.current) clearTimeout(toastT.current);
        toastT.current = setTimeout(() => setToast(null), 4000);
      });
      await keepAwake(); document.addEventListener('visibilitychange', onVis);
    })();
    return () => { dead = true; sock?.disconnect(); sockRef.current = null; document.removeEventListener('visibilitychange', onVis); void lock?.release().catch(() => {}); setLive(false); };
  }, [username]);

  function toggle() {
    const next = !on; setOn(next); onRef.current = next;
    try { localStorage.setItem(KEY, next ? 'on' : 'off'); } catch { /* ignore */ }
    sockRef.current?.emit?.('speaker', { play: next });
    if (next) { const sfx = (window as unknown as { VJLSfx?: Sfx }).VJLSfx; sfx?.play('pop', 0.6); } // คลิกนี้ปลดล็อกเสียงของเบราว์เซอร์ด้วย
  }

  if (!username) return null;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-3 py-1 text-xs text-muted" title="วิดเจ็ตในโปรแกรมไลฟ์ทำงานเฉพาะตอนเปิดหน้าเว็บนี้ค้างไว้">
        <span className={cx('size-2 shrink-0 rounded-full', live ? 'bg-mint' : 'bg-gray-300')} />
        {live ? 'วิดเจ็ตทำงาน — เปิดหน้านี้ค้างไว้ระหว่างไลฟ์' : 'กำลังเชื่อมต่อ…'}
      </div>
      {hasSound && (
        <button onClick={toggle} title={on ? 'เสียงจากกฎ Actions ดังที่เครื่องนี้ (เปิดเว็บไว้หน้าไหนก็ได้)' : 'ปิดเสียงที่เครื่องนี้อยู่ — เสียงจะเล่นที่ลิงก์ FX แทน'}
          className={cx('flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition', on ? 'bg-mint/15 text-ink' : 'text-muted hover:bg-violet-soft')}>
          {on ? <Volume2 className="size-4 text-mint" /> : <VolumeX className="size-4" />}
          <span className="min-w-0 flex-1 truncate">{on ? 'เสียงจากกฎ: ดังที่นี่' : 'เสียงจากกฎ: ปิด (ดังที่ลิงก์ FX)'}</span>
        </button>
      )}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 max-w-xs rounded-2xl bg-white px-4 py-3 text-sm shadow-lg ring-1 ring-line">🔊 {toast}</div>
      )}
    </div>
  );
}
