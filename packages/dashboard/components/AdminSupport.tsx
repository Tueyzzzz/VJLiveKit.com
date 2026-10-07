'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button, Card, cx } from './ui';
import { SupportChat, type SupportMsg } from './SupportChat';
import { TikTokAvatar } from './TikTokAvatar';
import { api } from '@/lib/api';

interface Row { userId: string; email: string; name: string; tiktok: string | null; unreadAdmin: number; status: 'open' | 'done'; updatedAt: string; last: SupportMsg | null }

/** หลังบ้าน: แชทแจ้งปัญหาจากลูกค้า — รายการห้อง (ซ้าย) · แชท (ขวา) · มือถือดูทีละอย่าง */
export function AdminSupport() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const list = useCallback(() => api<{ threads: Row[] }>('/api/admin/support').then((r) => setRows(r.threads)).catch(() => {}), []);
  useEffect(() => {
    void list(); const tm = setInterval(list, 20_000);
    window.addEventListener('vjl-support', list);
    return () => { clearInterval(tm); window.removeEventListener('vjl-support', list); };
  }, [list]);

  const load = useCallback(async () => {
    const r = await api<{ thread: { msgs: SupportMsg[] } }>(`/api/admin/support/${sel}`);
    window.dispatchEvent(new Event('vjl-support-read')); void list();
    return r.thread.msgs;
  }, [sel, list]);
  const send = useCallback(async (b: { text: string; img?: string }) => { await api(`/api/admin/support/${sel}`, { method: 'POST', body: b }); }, [sel]);
  const cur = rows?.find((r) => r.userId === sel);
  const shown = (rows ?? []).filter((r) => filter === 'all' || r.status === 'open');

  async function setStatus(status: 'open' | 'done') {
    if (status === 'done' && !confirm('แก้ปัญหาเสร็จแล้ว? แชทนี้จะถูกลบทั้งหมด (ข้อความ + รูป)')) return;
    await api(`/api/admin/support/${sel}/status`, { method: 'POST', body: { status } });
    if (status === 'done') setSel(null);
    void list();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <Card className={cx('space-y-2 p-3', sel ? 'hidden lg:block' : '')}>
        <div className="flex gap-1">
          {(['open', 'all'] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={cx('rounded-full px-3 py-1 text-xs', filter === f ? 'bg-pink text-white' : 'bg-canvas text-muted')}>{f === 'open' ? 'ยังไม่ปิด' : 'ทั้งหมด'}</button>)}
        </div>
        {!rows ? <p className="text-sm text-muted">…</p> : shown.length === 0 ? <p className="py-6 text-center text-sm text-muted">ไม่มีแชท</p> : shown.map((r) => (
          <button key={r.userId} onClick={() => setSel(r.userId)} className={cx('flex w-full items-center gap-2.5 rounded-xl p-2 text-left', sel === r.userId ? 'bg-pink-soft' : 'hover:bg-canvas')}>
            <TikTokAvatar username={r.tiktok} size={36} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-sm font-medium"><span className="truncate">{r.name || r.email}</span>{r.status === 'done' && <CheckCircle2 className="size-3.5 shrink-0 text-mint" />}</span>
              <span className="block truncate text-xs text-muted">{r.last ? (r.last.from === 'admin' ? 'คุณ: ' : '') + (r.last.text || '📷 รูป') : ''}</span>
            </span>
            {r.unreadAdmin > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">{r.unreadAdmin}</span>}
          </button>
        ))}
      </Card>
      {sel ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setSel(null)} className="rounded-lg p-1.5 hover:bg-canvas lg:hidden" aria-label="กลับ"><ArrowLeft className="size-4" /></button>
            <span className="min-w-0 flex-1 truncate text-sm"><b>{cur?.name || cur?.email}</b> {cur?.tiktok && <span className="text-muted">@{cur.tiktok}</span>} <span className="text-xs text-muted">{cur?.email}</span></span>
            {cur && <Button variant="secondary" onClick={() => void setStatus('done')}>✓ แก้เสร็จ (ลบแชท)</Button>}
          </div>
          <SupportChat key={sel} load={load} send={send} me="admin" />
        </div>
      ) : <Card className="hidden place-items-center text-sm text-muted lg:grid">เลือกแชททางซ้าย</Card>}
    </div>
  );
}
