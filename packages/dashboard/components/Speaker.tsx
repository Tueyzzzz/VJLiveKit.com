'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useAuth } from '@/lib/auth';
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

// สถานะร่วม: ตัวเชื่อม (อยู่ทุกหน้าของเว็บ) ↔ ปุ่มในเมนูแดชบอร์ด
const store = { live: false, on: true, hasSound: false, sock: null as (SocketLike | null) };
const subs = new Set<() => void>();
let snap = { ...store };
const emit = () => { snap = { live: store.live, on: store.on, hasSound: store.hasSound, sock: store.sock }; subs.forEach((f) => f()); };
const useStore = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => snap, () => snap);

/**
 * เชื่อมเว็บกับระบบ (แบบ TikFinity) — ล็อกอินแล้วเปิดหน้าไหนของ vjlivekit.com ก็ได้:
 * - วิดเจ็ตในโปรแกรมไลฟ์ทำงานเฉพาะตอนเปิดเว็บอยู่ (ปิดเว็บ → พักหลัง 90 วินาที)
 * - กฎ "เล่นเสียง" ดังที่เครื่องนี้ (ปิดได้ → ไปดังที่ลิงก์ FX แทน) · กันจอดับระหว่างเปิด
 * วางไว้ที่ root layout (ใน AuthProvider)
 */
export function LiveLink() {
  const { user } = useAuth();
  const username = user?.tiktokUsername;
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { try { store.on = localStorage.getItem(KEY) !== 'off'; emit(); } catch { /* ignore */ } }, []);
  // มีกฎเสียงที่เปิดอยู่ไหม (เช็กซ้ำทุกนาที เผื่อเพิ่งสร้างกฎ)
  useEffect(() => {
    if (!username) return;
    const check = () => api<{ rules: Rule[] }>('/api/actions').then((r) => { store.hasSound = r.rules.some((x) => x.enabled && x.action.type === 'sound'); emit(); }).catch(() => {});
    check(); const t = setInterval(check, 60_000); return () => clearInterval(t);
  }, [username]);

  useEffect(() => {
    if (!username) return;
    let sock: SocketLike | null = null, lock: { release: () => Promise<void> } | null = null, dead = false;
    const keepAwake = async () => { try { lock = await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen') ?? null; } catch { /* ไม่รองรับ */ } };
    const onVis = () => { if (document.visibilityState === 'visible') void keepAwake(); };
    void (async () => {
      try { await Promise.all([loadScript(`${API_BASE}/socket.io/socket.io.js`), loadScript(`${API_BASE}/overlay/js/sfx.js`)]); } catch { return; }
      const io = (window as unknown as { io?: IoFn }).io;
      if (dead || !io) return;
      sock = io(API_BASE || location.origin, { query: { session: getToken() ?? '', play: store.on ? '1' : '0' }, transports: ['websocket', 'polling'] });
      store.sock = sock; emit();
      sock.on('ready', () => { store.live = true; emit(); });
      sock.on('disconnect', () => { store.live = false; emit(); });
      sock.on('action', (f: Fire) => {
        const who = f.event?.user?.nickname || f.event?.user?.uniqueId || '';
        if (f.action.type === 'sound' && store.on) {
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
    return () => { dead = true; sock?.disconnect(); store.sock = null; store.live = false; emit(); document.removeEventListener('visibilitychange', onVis); void lock?.release().catch(() => {}); };
  }, [username]);

  if (!toast) return null;
  return <div className="fixed bottom-4 right-4 z-50 max-w-xs rounded-2xl bg-white px-4 py-3 text-sm shadow-lg ring-1 ring-line">🔊 {toast}</div>;
}

/** สถานะการเชื่อมต่อ + สวิตช์เสียง (ในเมนูแดชบอร์ด) */
export function Speaker() {
  const st = useStore();
  function toggle() {
    store.on = !store.on; emit();
    try { localStorage.setItem(KEY, store.on ? 'on' : 'off'); } catch { /* ignore */ }
    store.sock?.emit?.('speaker', { play: store.on });
    if (store.on) (window as unknown as { VJLSfx?: Sfx }).VJLSfx?.play('pop', 0.6); // คลิกนี้ปลดล็อกเสียงของเบราว์เซอร์ด้วย
  }
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-3 py-1 text-xs text-muted" title="วิดเจ็ตในโปรแกรมไลฟ์ทำงานเฉพาะตอนเปิดเว็บนี้ค้างไว้ (หน้าไหนก็ได้ ขอแค่ล็อกอินอยู่)">
        <span className={cx('size-2 shrink-0 rounded-full', st.live ? 'bg-mint' : 'bg-gray-300')} />
        {st.live ? 'วิดเจ็ตทำงาน — เปิดเว็บค้างไว้ระหว่างไลฟ์' : 'กำลังเชื่อมต่อ…'}
      </div>
      {st.hasSound && (
        <button onClick={toggle} title={st.on ? 'เสียงจากกฎ Actions ดังที่เครื่องนี้' : 'ปิดเสียงที่เครื่องนี้อยู่ — เสียงจะเล่นที่ลิงก์ FX แทน'}
          className={cx('flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition', st.on ? 'bg-mint/15 text-ink' : 'text-muted hover:bg-violet-soft')}>
          {st.on ? <Volume2 className="size-4 text-mint" /> : <VolumeX className="size-4" />}
          <span className="min-w-0 flex-1 truncate">{st.on ? 'เสียงจากกฎ: ดังที่นี่' : 'เสียงจากกฎ: ปิด (ดังที่ลิงก์ FX)'}</span>
        </button>
      )}
    </div>
  );
}
