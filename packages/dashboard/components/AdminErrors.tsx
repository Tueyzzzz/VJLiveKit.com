'use client';

import { useEffect, useState } from 'react';
import { Badge, Card, Input, Select, Spinner } from '@/components/ui';
import { api } from '@/lib/api';

type Entry = { ts: number; src: string; msg: string; stack?: string; where?: string; user?: string; ver?: string; ua?: string; ip?: string };
type Group = { key: string; src: string; msg: string; where?: string; count: number; first: number; last: number; users: string[]; userCount: number; sample: Entry };
type Res = { total: number; bySrc: Record<string, number>; groups: Group[]; recent: Entry[] };

const SRC: Record<string, string> = { server: '🖥️ เซิร์ฟเวอร์', tiktok: '📡 TikTok', overlay: '🎨 วิดเจ็ต', dashboard: '🧭 แดชบอร์ด' };
const ago = (ts: number) => { const s = Math.round((Date.now() - ts) / 1000); return s < 60 ? `${s} วิ` : s < 3600 ? `${Math.floor(s / 60)} นาที` : s < 86400 ? `${Math.floor(s / 3600)} ชม.` : `${Math.floor(s / 86400)} วัน`; };

/** Error log (เก็บ 3 วัน): จัดกลุ่มเรื่องเดียวกัน · กรองตามแหล่ง/ผู้ใช้ · อัปเดตทุก 30 วินาที */
export function AdminErrors() {
  const [r, setR] = useState<Res | null>(null);
  const [err, setErr] = useState('');
  const [src, setSrc] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const f = () => api<Res>(`/api/admin/errors?days=3${src ? `&src=${src}` : ''}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`).then((x) => { setR(x); setErr(''); }).catch((e) => setErr((e as Error).message));
    const d = setTimeout(f, q ? 400 : 0); const t = setInterval(f, 30_000);
    return () => { clearTimeout(d); clearInterval(t); };
  }, [src, q]);
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold">🐞 Error log <span className="text-xs font-normal text-muted">· 3 วันล่าสุด</span></div>
        {r && <div className="flex flex-wrap gap-1.5 text-xs">{Object.entries(SRC).map(([k, l]) => <Badge key={k} tone={r.bySrc[k] ? 'pink' : 'gray'}>{l} {r.bySrc[k] ?? 0}</Badge>)}</div>}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[180px_1fr]">
        <Select value={src} onChange={(e) => setSrc(e.target.value)}><option value="">ทุกแหล่ง</option>{Object.entries(SRC).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา: @ชื่อ TikTok / อีเมล / ข้อความ / วิดเจ็ต" />
      </div>
      {err && <div className="mt-2 text-sm text-pink">{err}</div>}
      {!r ? <div className="mt-3"><Spinner /></div> : r.groups.length === 0 ? (
        <div className="mt-3 rounded-xl bg-violet-soft/50 p-4 text-center text-sm text-muted">✅ ไม่มี error{q || src ? 'ตามที่กรอง' : 'ใน 3 วันนี้'}</div>
      ) : (
        <div className="mt-3 grid gap-2">
          {r.groups.map((g) => (
            <div key={g.key} className="rounded-xl border border-violet-soft p-3">
              <button type="button" className="w-full text-left" onClick={() => setOpen(open === g.key ? null : g.key)}>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <Badge tone="violet">{SRC[g.src] ?? g.src}</Badge>
                  <Badge tone={g.count >= 20 ? 'pink' : 'gray'}>× {g.count}</Badge>
                  {g.where && <span className="max-w-full truncate text-muted">{g.where}</span>}
                  <span className="ml-auto text-muted">ล่าสุด {ago(g.last)}ที่แล้ว</span>
                </div>
                <div className="mt-1.5 break-words font-mono text-[13px] leading-snug">{g.msg}</div>
                {g.userCount > 0 && <div className="mt-1 break-words text-xs text-muted">👤 {g.users.slice(0, 5).join(', ')}{g.userCount > 5 ? ` +${g.userCount - 5}` : ''}</div>}
              </button>
              {open === g.key && (
                <div className="mt-2 grid gap-1 border-t border-violet-soft pt-2 text-xs text-muted">
                  <div>ครั้งแรก {new Date(g.first).toLocaleString('th-TH')} · ล่าสุด {new Date(g.last).toLocaleString('th-TH')}</div>
                  {g.sample.ver && <div>เวอร์ชัน {g.sample.ver}</div>}
                  {g.sample.ua && <div className="break-words">{g.sample.ua}</div>}
                  {g.userCount > 5 && <div className="break-words">👤 {g.users.join(', ')}</div>}
                  {g.sample.stack && <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-violet-soft/50 p-2 font-mono text-[11px] text-ink">{g.sample.stack}</pre>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
