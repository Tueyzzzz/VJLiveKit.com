'use client';

import { useEffect, useMemo, useState } from 'react';
import { Gift, Search, Shuffle } from 'lucide-react';
import { api, API_BASE } from '@/lib/api';
import { Button, Card, Spinner } from './ui';

interface GiftInfo { name: string; id?: number; image?: string; diamonds: number; th?: string }

const COUNTS = [1, 5, 10, 99];
const BURSTS = [1, 5, 20];

/**
 * 🧪 หลังบ้าน: ส่งของขวัญ TikTok ทดสอบขึ้นโอเวอร์เลย์ (เข้าห้องของบัญชีแอดมินเองเท่านั้น — ไม่ยุ่งกองของขวัญลูกค้า)
 * ไหลทางเดียวกับของจริงทุกอย่าง: วิดเจ็ตบนจอ · กฎ Actions · อันดับผู้ให้ · กองสะสม → ใช้ดูว่าโอเวอร์เลย์บักไหม
 */
export function AdminGiftTester() {
  const [gifts, setGifts] = useState<GiftInfo[] | null>(null);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<GiftInfo | null>(null);
  const [count, setCount] = useState(1);
  const [combo, setCombo] = useState(false);
  const [burst, setBurst] = useState(1);
  const [nick, setNick] = useState('ทดสอบ');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/gifts`).then((r) => r.json()).then((r: { gifts: GiftInfo[] }) => {
      const list = (r.gifts ?? []).filter((g) => g.image);
      setGifts(list); setSel(list.find((g) => g.name === 'Rose') ?? list[0] ?? null);
    }).catch(() => setGifts([]));
  }, []);

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return (gifts ?? []).filter((g) => !k || g.name.toLowerCase().includes(k) || (g.th ?? '').includes(k) || String(g.diamonds) === k);
  }, [gifts, q]);

  async function send(g: GiftInfo | null, opts?: { count?: number; burst?: number; combo?: boolean }) {
    if (!g) return;
    setBusy(true); setMsg(null);
    try {
      const r = await api<{ room: string; widgets: number }>('/api/admin/test-gift', {
        method: 'POST',
        body: { giftName: g.name, giftId: g.id, image: g.image, diamonds: g.diamonds, count: opts?.count ?? count, combo: opts?.combo ?? combo, burst: opts?.burst ?? burst, nickname: nick },
      });
      setMsg(r.widgets > 0
        ? { ok: true, text: `ส่ง ${g.name} เข้าห้อง @${r.room} แล้ว · วิดเจ็ตที่เปิดอยู่ ${r.widgets} อัน` }
        : { ok: false, text: `ส่งเข้าห้อง @${r.room} แล้ว แต่ยังไม่มีวิดเจ็ตเปิดอยู่ — เปิดลิงก์วิดเจ็ตของบัญชีนี้ใน OBS หรือแท็บใหม่ก่อน แล้วส่งอีกครั้ง` });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }

  async function randomBurst() { // ทดสอบหนัก: ของขวัญสุ่ม 20 ชิ้นติด ๆ กัน (ถูก-แพงปนกัน)
    if (!gifts?.length) return;
    for (let i = 0; i < 20; i++) {
      const g = gifts[Math.floor(Math.random() * gifts.length)];
      void send(g, { count: g.diamonds >= 500 ? 1 : 1 + Math.floor(Math.random() * 5), burst: 1, combo: false });
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return (
    <Card className="space-y-4 p-4">
      <div>
        <h2 className="font-medium">🧪 ทดสอบส่งของขวัญขึ้นโอเวอร์เลย์</h2>
        <p className="mt-1 text-xs text-muted">ส่งเข้าห้องของบัญชีแอดมินเอง (ไม่ต้องไลฟ์) · วิดเจ็ตบนจอ กฎ Actions และอันดับ ทำงานเหมือนของจริงทุกอย่าง · ของขวัญทดสอบเข้ากองของบัญชีนี้จริง กด &quot;ล้าง&quot; ในหน้าตั้งค่าวิดเจ็ตได้ · ลูกค้าไม่เห็น</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาของขวัญ (ชื่อ / ราคา)" className="w-full rounded-xl border border-line bg-white py-2 pl-9 pr-3 text-sm" />
      </div>

      {!gifts ? <Spinner /> : (
        <div className="grid max-h-80 grid-cols-4 gap-1.5 overflow-y-auto rounded-xl border border-line bg-canvas/50 p-1.5 sm:grid-cols-6 lg:grid-cols-8">
          {shown.map((g) => (
            <button key={g.name} type="button" onClick={() => setSel(g)}
              className={`flex flex-col items-center gap-0.5 rounded-lg border-2 p-1 text-center transition ${sel?.name === g.name ? 'border-pink bg-pink-soft' : 'border-transparent bg-white hover:border-pink/40'}`}>
              <img src={g.image} alt="" width={44} height={44} loading="lazy" className="size-11 object-contain" />
              <span className="line-clamp-1 w-full text-[10px] leading-tight">{g.name}</span>
              <span className="text-[10px] text-muted">💎{g.diamonds.toLocaleString('en-US')}</span>
            </button>
          ))}
          {!shown.length && <p className="col-span-full py-6 text-center text-xs text-muted">ไม่พบของขวัญ</p>}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-medium">จำนวน (ต่อครั้ง)</div>
          <div className="flex flex-wrap gap-1.5">
            {COUNTS.map((n) => <button key={n} type="button" onClick={() => setCount(n)} className={`rounded-full border px-3 py-1 text-xs ${count === n ? 'border-pink bg-pink text-white' : 'border-line bg-white'}`}>×{n}</button>)}
          </div>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs"><input type="checkbox" className="accent-pink" checked={combo} onChange={(e) => setCombo(e.target.checked)} /> ส่งแบบกดรัว (คอมโบ เหมือนคนกดค้าง)</label>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium">คนส่งพร้อมกัน</div>
          <div className="flex flex-wrap gap-1.5">
            {BURSTS.map((n) => <button key={n} type="button" onClick={() => setBurst(n)} className={`rounded-full border px-3 py-1 text-xs ${burst === n ? 'border-pink bg-pink text-white' : 'border-line bg-white'}`}>{n} คน</button>)}
          </div>
          <input value={nick} onChange={(e) => setNick(e.target.value)} maxLength={30} placeholder="ชื่อคนส่ง" className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-1.5 text-sm" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button className="min-w-0 flex-1" loading={busy} disabled={!sel} onClick={() => send(sel)}>
          <Gift className="size-4" /> ส่ง {sel ? `${sel.name} ×${count}${burst > 1 ? ` · ${burst} คน` : ''}` : ''}
        </Button>
        <Button variant="secondary" disabled={!gifts?.length || busy} onClick={() => void randomBurst()}><Shuffle className="size-4" /> สุ่มรัว 20 ชิ้น</Button>
      </div>
      {msg && <p className={`rounded-lg px-3 py-2 text-xs ${msg.ok ? 'bg-mint/15 text-ink' : 'bg-pink-soft text-pink'}`}>{msg.text}</p>}
    </Card>
  );
}
