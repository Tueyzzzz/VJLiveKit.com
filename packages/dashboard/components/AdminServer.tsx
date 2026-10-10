'use client';

import { useEffect, useState } from 'react';
import { Badge, Card, Spinner } from '@/components/ui';
import { api } from '@/lib/api';

type Stats = {
  host: { cpus: number; cpu: number; load: number[]; memTotal: number; memFree: number; uptime: number };
  disk: { total: number; free: number } | null;
  app: { rss: number; heapUsed: number; uptime: number; node: string; commit: string };
  db: { ok: boolean; ms: number | null };
  sockets: { open: number; rejected: number; banned: { ip: string; minutesLeft: number }[] };
  rooms: { rooms: number; liveRooms: number };
};

const gb = (b: number) => (b / 1024 ** 3).toFixed(b >= 10 * 1024 ** 3 ? 0 : 1) + ' GB';
const mb = (b: number) => Math.round(b / 1024 ** 2) + ' MB';
const dur = (s: number) => { const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60); return d ? `${d} วัน ${h} ชม.` : h ? `${h} ชม. ${m} นาที` : `${m} นาที`; };

/** แถบเปอร์เซ็นต์ — เขียว < 70% · ส้ม < 90% · แดง ≥ 90% */
function Meter({ label, pct, detail }: { label: string; pct: number; detail: string }) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const color = p >= 90 ? 'bg-red-400' : p >= 70 ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2"><span className="text-sm text-muted">{label}</span><b className="text-2xl">{p}%</b></div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-violet-soft"><div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${p}%` }} /></div>
      <div className="mt-1.5 text-xs text-muted">{detail}</div>
    </Card>
  );
}
function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return <Card><div className="text-sm text-muted">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div>{sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}</Card>;
}

/** แท็บเซิร์ฟเวอร์: สุขภาพเครื่อง อัปเดตทุก 5 วินาที */
export function AdminServer() {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    const f = () => api<Stats>('/api/admin/server').then((r) => { setS(r); setErr(''); }).catch((e) => setErr((e as Error).message));
    void f(); const t = setInterval(f, 5000); return () => clearInterval(t);
  }, []);
  if (!s) return err ? <Card className="text-sm text-pink">{err}</Card> : <Spinner />;
  const memUsed = s.host.memTotal - s.host.memFree, diskUsed = s.disk ? s.disk.total - s.disk.free : 0;
  const healthy = s.db.ok && s.host.cpu < 90 && memUsed / s.host.memTotal < 0.92 && (!s.disk || diskUsed / s.disk.total < 0.9);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={healthy ? 'mint' : 'pink'}>{healthy ? '✅ ปกติ' : '⚠️ ต้องดู'}</Badge>
        <span className="text-muted">เวอร์ชัน {s.app.commit.slice(0, 7)} · Node {s.app.node} · อัปเดตทุก 5 วินาที</span>
        {err && <span className="text-pink">({err})</span>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Meter label="CPU" pct={s.host.cpu} detail={`${s.host.cpus} คอร์ · โหลดเฉลี่ย ${s.host.load.join(' / ')}`} />
        <Meter label="RAM" pct={(memUsed / s.host.memTotal) * 100} detail={`ใช้ ${gb(memUsed)} จาก ${gb(s.host.memTotal)} · เหลือ ${mb(s.host.memFree)}`} />
        {s.disk && <Meter label="ดิสก์" pct={(diskUsed / s.disk.total) * 100} detail={`ใช้ ${gb(diskUsed)} จาก ${gb(s.disk.total)} · เหลือ ${gb(s.disk.free)}`} />}
        <Stat label="ฐานข้อมูล" value={s.db.ok ? <span className="text-emerald-500">ปกติ</span> : <span className="text-pink">ต่อไม่ได้</span>} sub={s.db.ms !== null ? `ตอบใน ${s.db.ms} ms` : 'ตรวจสอบ Postgres'} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="ไลฟ์อยู่ตอนนี้" value={s.rooms.liveRooms} sub={`ห้องที่ระบบดูแล ${s.rooms.rooms} ห้อง`} />
        <Stat label="จอ/หน้าเว็บที่ต่ออยู่" value={s.sockets.open} sub="วิดเจ็ต + แดชบอร์ดที่เปิดอยู่" />
        <Stat label="แอปทำงานมา" value={dur(s.app.uptime)} sub={`ใช้ RAM ${mb(s.app.rss)} · เครื่องเปิดมา ${dur(s.host.uptime)}`} />
        <Stat label="กันยิง" value={s.sockets.rejected} sub={s.sockets.banned.length ? `ถูกปฏิเสธ · แบนอยู่ ${s.sockets.banned.length} IP` : 'ครั้งที่ถูกปฏิเสธ (ตั้งแต่เปิดแอป) · ไม่มี IP ถูกแบน'} />
      </div>
      {s.sockets.banned.length > 0 && (
        <Card>
          <div className="mb-2 text-sm font-medium">IP ที่ถูกแบนชั่วคราว (เชื่อมต่อถี่ผิดปกติ)</div>
          <div className="flex flex-wrap gap-2 text-xs">{s.sockets.banned.map((b) => <span key={b.ip} className="rounded-full bg-violet-soft px-3 py-1">{b.ip} · อีก {b.minutesLeft} นาที</span>)}</div>
        </Card>
      )}
    </div>
  );
}
