'use client';

import { useEffect, useState } from 'react';
import { Card, Spinner, cx } from './ui';
import { TikTokAvatar } from './TikTokAvatar';
import { api } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';
interface Order { code: string; name: string; at: string; userId: string; email: string; tiktok: string | null; inUse: boolean }
const POSES: [number, string][] = [[1, 'ปกติ'], [2, 'กะพริบ'], [3, 'อ้าปาก'], [4, 'ผมซ้าย'], [5, 'ผมขวา'], [6, 'รับของขวัญ'], [7, 'ดีใจ'], [8, 'ส่งหัวใจ'], [9, 'เต้น A'],
  [10, 'เต้น B'], [11, 'เต้น C'], [12, 'เดิน 1'], [13, 'เดิน 2'], [14, 'จุ๊บ 1'], [15, 'จุ๊บ 2'], [16, 'เดินกลับ 1'], [17, 'เดินกลับ 2']];

/** หลังบ้าน: มาสคอตสั่งทำ — ใครซื้อแล้ว · ใช้อยู่ไหม · ดูครบ 17 ท่า + ตัวอย่างเคลื่อนไหว */
export function AdminMascots() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { api<{ orders: Order[] }>('/api/admin/mascots').then((r) => setOrders(r.orders)).catch(() => setOrders([])); }, []);
  if (!orders) return <Spinner />;
  if (!orders.length) return <Card className="py-8 text-center text-sm text-muted">ยังไม่มีลูกค้าสั่งทำมาสคอต</Card>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">ลูกค้าที่สั่งทำมาสคอตหน้าตัวเอง {orders.length} ตัว — เพิ่มลูกค้าใหม่ที่ไฟล์ <code>packages/server/src/mascots/custom.ts</code></p>
      {orders.map((o) => (
        <Card key={o.code} className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <img src={`${API_BASE}/overlay/mascot/${o.code}/thumb.webp`} alt="" className="size-20 rounded-2xl bg-pink-soft/50 object-contain" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{o.name} <span className="text-xs font-normal text-muted">({o.code})</span></div>
              <div className="flex items-center gap-1.5 text-sm text-muted"><TikTokAvatar username={o.tiktok} size={20} /> {o.email}{o.tiktok && <> · @{o.tiktok}</>}</div>
              <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                <span className="rounded-full bg-canvas px-2 py-0.5">ส่งมอบ {o.at}</span>
                <span className={cx('rounded-full px-2 py-0.5', o.inUse ? 'bg-mint/20 text-[#2e8b75]' : 'bg-gray-100 text-muted')}>{o.inUse ? '✓ ลูกค้าเลือกใช้อยู่' : 'ลูกค้ายังไม่ได้เลือกใช้'}</span>
              </div>
            </div>
            <button onClick={() => setOpen(open === o.code ? null : o.code)} className="rounded-xl border border-line px-3 py-1.5 text-sm hover:bg-canvas">{open === o.code ? 'ซ่อน' : 'ดูครบ 17 ท่า'}</button>
          </div>
          {open === o.code && (
            <>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-9">
                {POSES.map(([n, l]) => (
                  <div key={n} className="rounded-xl bg-canvas p-1 text-center">
                    <img src={`${API_BASE}/overlay/mascot/${o.code}/${n}.webp`} alt="" loading="lazy" className="aspect-square w-full object-contain" />
                    <div className="text-[10px] text-muted">{n}. {l}</div>
                  </div>
                ))}
              </div>
              <div className="relative aspect-video overflow-hidden rounded-xl" style={{ background: 'radial-gradient(circle at 30% 20%, #3a2d52, #17121f 70%)' }}>
                <iframe src={`${API_BASE}/overlay/mascot.html?demo=1&char=${o.code}&pos=bc`} title="ตัวอย่าง" className="absolute inset-0 h-full w-full border-0" />
              </div>
            </>
          )}
        </Card>
      ))}
    </div>
  );
}
