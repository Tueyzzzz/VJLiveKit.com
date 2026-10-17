'use client';

import { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { Alert, Button, Card, Spinner } from './ui';

interface Finance {
  total: number; count: number; pending: number; thisMonth: number; lastMonth: number; mrr: number; activePaid: number; trialsActive: number;
  months: { month: string; baht: number }[];
  byKind: { kind: string; n: number; baht: number }[];
  renewSoon: { user: string; plan: string; baht: number; ends: string }[];
  trialsEnding: { user: string; ends: string }[];
  recent: { id: string; at: string; user: string; kind: string; baht: number; provider: string }[];
}

const B = (n: number) => '฿' + Math.round(n).toLocaleString('th-TH');
const D = (s: string) => new Date(s).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
const MONTH = (m: string) => new Date(m + '-01T00:00:00').toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });

/** 💰 หลังบ้าน › รายงานการเงิน — รายได้รายเดือน · ตามแพลน · MRR · ต่ออายุเร็ว ๆ นี้ · ทดลองใกล้หมด · รายการล่าสุด (ส่งออก CSV) */
export function AdminFinance() {
  const [f, setF] = useState<Finance | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = () => { setErr(null); api<Finance>('/api/admin/finance').then(setF).catch((e) => setErr((e as Error).message)); };
  useEffect(load, []);
  if (err) return <Alert>{err}</Alert>;
  if (!f) return <Spinner />;

  const max = Math.max(1, ...f.months.map((m) => m.baht));
  const diff = f.lastMonth ? Math.round(((f.thisMonth - f.lastMonth) / f.lastMonth) * 100) : null;
  const week = f.trialsEnding.filter((t) => new Date(t.ends).getTime() - Date.now() < 7 * 86_400_000);
  function csv() {
    const rows = [['วันที่', 'ลูกค้า', 'รายการ', 'บาท', 'ช่องทาง'], ...f!.recent.map((r) => [new Date(r.at).toLocaleString('th-TH'), r.user, r.kind, String(r.baht), r.provider])];
    const blob = new Blob(['﻿' + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `vjlivekit-finance-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  }
  const stat = (label: string, value: string, sub?: string) => (
    <Card className="p-4"><div className="text-xs text-muted">{label}</div><div className="mt-1 font-display text-3xl">{value}</div>{sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}</Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl">💰 รายงานการเงิน</h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={load}><RefreshCw className="size-4" /> รีเฟรช</Button>
          <Button variant="secondary" onClick={csv} disabled={!f.recent.length}><Download className="size-4" /> ส่งออก CSV</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stat('รายได้เดือนนี้', B(f.thisMonth), diff == null ? `เดือนก่อน ${B(f.lastMonth)}` : `${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff)}% จากเดือนก่อน (${B(f.lastMonth)})`)}
        {stat('รายได้ประจำต่อเดือน (MRR)', B(f.mrr), `สมาชิกจ่ายเงินที่ใช้งานอยู่ ${f.activePaid} คน`)}
        {stat('รายได้รวมทั้งหมด', B(f.total), `${f.count} รายการ`)}
        {stat('ทดลองใช้อยู่', f.trialsActive.toLocaleString('th-TH') + ' คน', `หมดใน 7 วัน ${week.length} คน · สลิปรอตรวจ ${f.pending}`)}
      </div>

      <Card className="p-4">
        <h3 className="mb-3 font-medium">รายได้รายเดือน (12 เดือน)</h3>
        <div className="flex h-44 items-end gap-1.5">
          {f.months.map((m, i) => (
            <div key={m.month} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className="hidden text-[10px] text-muted sm:block">{m.baht ? B(m.baht) : ''}</div>
              <div className="w-full rounded-t-md bg-gradient-to-t from-pink to-violet" style={{ height: `${Math.max(2, (m.baht / max) * 120)}px`, opacity: m.baht ? 1 : 0.25 }} />
              <div className={`truncate text-[10px] text-muted ${i % 2 && i !== 11 ? 'invisible sm:visible' : ''}`}>{MONTH(m.month)}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-2 font-medium">รายได้แยกตามรายการ</h3>
          {!f.byKind.length ? <p className="text-sm text-muted">ยังไม่มีรายได้</p> : (
            <table className="w-full text-sm"><tbody>
              {f.byKind.map((k) => (
                <tr key={k.kind} className="border-t border-line/70"><td className="py-1.5">{k.kind}</td><td className="py-1.5 text-right text-muted">{k.n} รายการ</td><td className="py-1.5 text-right font-medium">{B(k.baht)}</td></tr>
              ))}
            </tbody></table>
          )}
        </Card>
        <Card className="p-4">
          <h3 className="mb-2 font-medium">ต้องต่ออายุใน 14 วัน (สมาชิกจ่ายเงิน)</h3>
          {!f.renewSoon.length ? <p className="text-sm text-muted">ไม่มี</p> : (
            <table className="w-full text-sm"><tbody>
              {f.renewSoon.map((r, i) => (
                <tr key={i} className="border-t border-line/70"><td className="py-1.5">@{r.user}</td><td className="py-1.5 text-muted">{r.plan}</td><td className="py-1.5 text-right">{D(r.ends)}</td><td className="py-1.5 text-right font-medium">{B(r.baht)}</td></tr>
              ))}
            </tbody></table>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="mb-1 font-medium">ทดลองใช้ใกล้หมด (โอกาสขาย)</h3>
        <p className="mb-2 text-xs text-muted">ทักแชทชวนต่อแพลนก่อนหมด — ตอนนี้มีโปรเดือนแรกลด 10%</p>
        {!f.trialsEnding.length ? <p className="text-sm text-muted">ไม่มี</p> : (
          <div className="flex flex-wrap gap-1.5">
            {f.trialsEnding.slice(0, 30).map((t, i) => {
              const days = Math.ceil((new Date(t.ends).getTime() - Date.now()) / 86_400_000);
              return <span key={i} className={`rounded-full border px-2.5 py-1 text-xs ${days <= 7 ? 'border-pink/40 bg-pink-soft text-pink' : 'border-line bg-white'}`}>@{t.user} · อีก {days} วัน</span>;
            })}
          </div>
        )}
      </Card>

      <Card className="overflow-x-auto p-0">
        <div className="px-4 pt-4 font-medium">รายการชำระเงินล่าสุด</div>
        {!f.recent.length ? <p className="p-4 text-sm text-muted">ยังไม่มีการชำระเงิน</p> : (
          <table className="mt-2 w-full min-w-[520px] text-sm">
            <thead><tr className="text-left text-xs text-muted"><th className="px-4 py-2">วันที่</th><th className="px-4 py-2">ลูกค้า</th><th className="px-4 py-2">รายการ</th><th className="px-4 py-2">ช่องทาง</th><th className="px-4 py-2 text-right">บาท</th></tr></thead>
            <tbody>
              {f.recent.map((r) => (
                <tr key={r.id} className="border-t border-line/70"><td className="px-4 py-2">{new Date(r.at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</td><td className="px-4 py-2">@{r.user}</td><td className="px-4 py-2">{r.kind}</td><td className="px-4 py-2 text-muted">{r.provider === 'slip' ? 'โอน + สลิป' : r.provider}</td><td className="px-4 py-2 text-right font-medium">{B(r.baht)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
