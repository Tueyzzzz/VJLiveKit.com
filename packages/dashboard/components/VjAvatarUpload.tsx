'use client';

import { useCallback, useEffect, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Alert, Button, Card } from './ui';
import { useT } from '@/lib/i18n';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

/** ตัดกึ่งกลางเป็นสี่เหลี่ยมจัตุรัส 640px → WEBP (เล็ก คม ส่งเร็ว) */
function toSquare(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = 640;
      const g = c.getContext('2d')!; g.imageSmoothingQuality = 'high';
      g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 640, 640);
      resolve(c.toDataURL('image/webp', 0.9)); URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('เปิดรูปไม่ได้'));
    img.src = URL.createObjectURL(file);
  });
}

/** อวตารของวีเจ 3 ท่า (อัปโหลดเอง) — โผล่ข้างแจ้งเตือนโดเนท สลับท่าไปมา */
export function VjAvatarUpload() {
  const t = useT();
  const [slots, setSlots] = useState<{ n: number; url: string | null }[] | null>(null);
  const [busy, setBusy] = useState(0);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const load = useCallback(() => { api<{ slots: { n: number; url: string | null }[] }>('/api/vjav/me').then((r) => setSlots(r.slots)).catch(() => setSlots([])); }, []);
  useEffect(load, [load]);

  async function upload(n: number, f: File | undefined) {
    if (!f) return;
    setBusy(n); setMsg(null);
    try { await api(`/api/vjav/${n}`, { method: 'POST', body: { data: await toSquare(f) } }); load(); }
    catch (e) { setMsg({ tone: 'error', text: (e as Error).message }); } finally { setBusy(0); }
  }
  async function remove(n: number) { try { await api(`/api/vjav/${n}`, { method: 'DELETE' }); load(); } catch (e) { setMsg({ tone: 'error', text: (e as Error).message }); } }
  // ตั้งวิดเจ็ตโดเนทให้ใช้อวตารนี้ (ค่าอื่นคงเดิม)
  async function useIt() {
    try {
      const r = await api<{ config: Record<string, unknown> }>('/api/widgets/donate/config');
      await api('/api/widgets/donate/config', { method: 'PUT', body: { ...(r.config ?? {}), avatar: 'mine' } });
      setMsg({ tone: 'success', text: t('ตั้งแล้ว ✓ แจ้งเตือนโดเนทจะโชว์อวตารของคุณ') });
    } catch (e) { setMsg({ tone: 'error', text: (e as Error).message }); }
  }
  const has = !!slots?.some((s) => s.url);
  const POSE = [t('ท่า 1 (เช่น ทำมือหัวใจ)'), t('ท่า 2 (เช่น โบกมือขอบคุณ)'), t('ท่า 3 (เช่น ดีใจชูมือ)')];

  return (
    <Card className="mt-6">
      <h2 className="font-medium">{t('✨ อวตารของฉัน (โผล่ข้างแจ้งเตือนโดเนท)')}</h2>
      <p className="mt-1 text-sm text-muted">{t('อัปโหลดรูปตัวเองหรือรูปการ์ตูนหน้าคุณ ได้สูงสุด 3 ท่า — ระบบตัดเป็นสี่เหลี่ยมจัตุรัสให้เอง ตอนมีคนโดเนทจะสลับท่าไปมาข้างป้าย')}</p>
      <div className="mt-4 grid grid-cols-3 gap-3 sm:max-w-md">
        {[1, 2, 3].map((n) => {
          const url = slots?.find((s) => s.n === n)?.url;
          return (
            <div key={n} className="text-center">
              <label className="group relative block aspect-square cursor-pointer overflow-hidden rounded-[22%] border-2 border-dashed border-pink/40 bg-gradient-to-br from-pink-soft/60 to-violet-soft/60 transition hover:border-pink">
                {url ? <img src={`${API_BASE}${url}`} alt="" className="h-full w-full object-cover" />
                  : <span className="absolute inset-0 grid place-items-center text-pink"><ImagePlus className="size-7" /></span>}
                {busy === n && <span className="absolute inset-0 grid place-items-center bg-white/70 text-xs">{t('กำลังอัปโหลด…')}</span>}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { void upload(n, e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              <div className="mt-1 text-[11px] leading-tight text-muted">{POSE[n - 1]}</div>
              {url && <button type="button" onClick={() => void remove(n)} className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted hover:text-pink"><Trash2 className="size-3" /> {t('ลบ')}</button>}
            </div>
          );
        })}
      </div>
      {msg && <div className="mt-3"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="secondary" disabled={!has} onClick={() => void useIt()}>{t('ใช้อวตารนี้ในแจ้งเตือนโดเนท')}</Button>
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('vjl-open-support', { detail: { text: t('สนใจให้ทีมงานทำอวตารการ์ตูนหน้าฉัน 3 ท่าค่ะ/ครับ 🎨') } }))} className="text-sm text-pink underline">{t('ไม่มีรูป? ให้ทีมงานวาดอวตารหน้าคุณ')}</button>
      </div>
    </Card>
  );
}
