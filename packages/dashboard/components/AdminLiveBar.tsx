'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';

interface Room { username: string; connected: boolean; viewers: number; diamonds: number; widgets: number }

/** แอดมินเท่านั้น: แถบจำนวนห้องที่กำลังไลฟ์ (อัปเดตทุก 20 วิ) — เห็นชัดก่อนตัดสินใจ Deploy */
export function AdminLiveBar() {
  const t = useT();
  const [rooms, setRooms] = useState<Room[] | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => api<{ rooms: Room[] }>('/api/admin/live').then((r) => { if (alive) setRooms(r.rooms.filter((x) => x.connected)); }).catch(() => {});
    load(); const id = setInterval(load, 20_000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  if (!rooms) return null;
  const n = rooms.length;
  return (
    <Link href="/dashboard/admin/" className={`mb-5 flex flex-wrap items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm transition hover:shadow-sm ${n ? 'border-red-200 bg-red-50' : 'border-line bg-white'}`}>
      <span className="flex items-center gap-2 font-semibold">
        <span className={`inline-block size-2.5 rounded-full ${n ? 'animate-pulse bg-red-500' : 'bg-gray-300'}`} />
        {n ? t('กำลังไลฟ์ {n} ห้อง', { n }) : t('ตอนนี้ไม่มีใครไลฟ์')}
      </span>
      {rooms.slice(0, 6).map((r) => (
        <span key={r.username} className="rounded-full bg-white px-2.5 py-0.5 text-xs text-ink shadow-sm">
          @{r.username} · 👀 {r.viewers} · 💎 {r.diamonds.toLocaleString()}
        </span>
      ))}
      {n > 6 && <span className="text-xs text-muted">+{n - 6}</span>}
    </Link>
  );
}
