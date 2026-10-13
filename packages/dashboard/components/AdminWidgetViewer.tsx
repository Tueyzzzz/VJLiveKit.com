'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Eye, X } from 'lucide-react';
import { api } from '@/lib/api';
import { WIDGET_LABELS } from './Pricing';
import { Button, Card, Spinner } from './ui';

/** 👀 หลังบ้าน: เปิดดูวิดเจ็ตของลูกค้าแบบสด (ลิงก์เดียวกับใน OBS ของลูกค้า) — จอ 1920×1080 ย่อให้พอดีกรอบ */
export function AdminWidgetViewer({ userId, configured }: { userId: string; configured: string[] }) {
  const [links, setLinks] = useState<{ type: string; url: string }[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cur, setCur] = useState<string | null>(null);
  const [k, setK] = useState(0.3);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current; if (!el) return;
    const fit = () => setK(el.clientWidth / 1920);
    fit(); const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect();
  }, [cur]);

  async function open() {
    setBusy(true); setErr(null);
    try {
      const r = await api<{ links: { type: string; url: string }[] }>(`/api/admin/users/${userId}/widget-links`);
      const set = new Set(configured);
      const sorted = r.links.slice().sort((a, b) => Number(set.has(b.type)) - Number(set.has(a.type)));
      setLinks(sorted); setCur(sorted[0]?.type ?? null);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  const url = links?.find((l) => l.type === cur)?.url;
  return (
    <Card className="p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">👀 ดูวิดเจ็ตของลูกค้า</h3>
        {links
          ? <Button variant="ghost" onClick={() => { setLinks(null); setCur(null); }}><X className="size-4" /> ปิด</Button>
          : <Button variant="secondary" loading={busy} onClick={open}><Eye className="size-4" /> เปิดดูแบบสด</Button>}
      </div>
      {err && <p className="mt-2 text-pink">{err}</p>}
      {!links && !err && <p className="mt-1 text-xs text-muted">เห็นเหมือนบนจอไลฟ์ของลูกค้าตอนนี้ (ลิงก์เดียวกับใน OBS) · ถ้ามีของขวัญเข้าอาจมีเสียงที่เครื่องเรา · การเปิดดูถูกบันทึกในบันทึกแอดมิน</p>}
      {links && (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {links.map((l) => (
              <button key={l.type} type="button" onClick={() => setCur(l.type)}
                className={`rounded-full border px-3 py-1 text-xs transition ${cur === l.type ? 'border-pink bg-pink text-white' : 'border-line bg-white hover:bg-pink-soft'}`}>
                {configured.includes(l.type) ? '⚙️ ' : ''}{WIDGET_LABELS[l.type] ?? l.type}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">⚙️ = ลูกค้าปรับตั้งค่าไว้ (น่าจะใช้อยู่)</p>
          {url && (
            <>
              <div ref={box} className="relative mt-2 aspect-video w-full overflow-hidden rounded-xl border border-line"
                style={{ background: 'repeating-conic-gradient(#2a2335 0% 25%, #221c2c 0% 50%) 50% / 24px 24px' }}>
                {!k ? <Spinner /> : (
                  <iframe key={url} src={url} title="วิดเจ็ตของลูกค้า" className="absolute left-0 top-0 origin-top-left border-0"
                    style={{ width: 1920, height: 1080, transform: `scale(${k})` }} allow="autoplay" />
                )}
              </div>
              <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-pink underline"><ExternalLink className="size-3.5" /> เปิดในแท็บใหม่ (ขนาดเต็ม)</a>
            </>
          )}
        </>
      )}
    </Card>
  );
}
