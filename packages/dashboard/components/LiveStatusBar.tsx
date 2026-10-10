'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Eye, Gem, Heart, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { TikTokAvatar } from './TikTokAvatar';

interface Status { username: string | null; state: 'live' | 'waiting' | 'idle' | 'no-username'; viewers: number; diamonds: number; likes: number; widgets: number; since: number | null }

const nf = (n: number) => n.toLocaleString('en-US');

/**
 * แถบสถานะไลฟ์ตัวใหญ่ ชัด บนสุดของแดชบอร์ด: กำลังไลฟ์ (คนดู/เพชร/ไลก์สด) · เชื่อมต่อแล้ว รอเริ่มไลฟ์ · ยังไม่ได้ตั้งชื่อ TikTok
 * อัปเดตเองทุก 15 วินาที
 */
export function LiveStatusBar() {
  const t = useT();
  const [s, setS] = useState<Status | null>(null);
  const { refresh } = useAuth();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(false);
  const load = useCallback(() => api<Status>('/api/live/status').then(setS).catch(() => {}), []);
  useEffect(() => { void load(); const tm = setInterval(load, 15_000); return () => clearInterval(tm); }, [load]);
  if (!s) return null;

  async function saveName(e: FormEvent) {
    e.preventDefault();
    const v = name.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?tiktok\.com\/@/i, '').split(/[/?]/)[0];
    if (!/^[A-Za-z0-9._]{2,24}$/.test(v)) { setErr(t('ชื่อ TikTok ไม่ถูกต้อง')); return; }
    setSaving(true); setErr('');
    try { await api('/api/auth/me', { method: 'PATCH', body: { tiktokUsername: v } }); await refresh(); await load(); setEditing(false); }
    catch (er) { setErr((er as Error).message); } finally { setSaving(false); }
  }

  if (s.state === 'no-username') return (
    <form onSubmit={saveName} className="mb-6 rounded-2xl border-2 border-pink/50 bg-gradient-to-r from-pink-soft to-white p-4 shadow-sm">
      <div className="flex items-center gap-2 font-semibold text-ink"><span className="grid size-7 place-items-center rounded-full bg-pink text-sm text-white">1</span>{t('ขั้นแรก: ใส่ชื่อ TikTok ที่คุณไลฟ์')}</div>
      <p className="mt-1 text-sm text-muted">{t('ใส่ชื่อหลัง @ ในลิงก์โปรไฟล์ เช่น tiktok.com/@mimi_live → mimi_live แล้ววิดเจ็ตทุกตัวจะต่อกับไลฟ์ของคุณเอง')}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <div className="flex min-w-0 flex-1">
          <span className="grid place-items-center rounded-l-xl border border-r-0 border-line bg-white px-3 text-muted">@</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="your_tiktok" autoFocus
            className="min-w-0 flex-1 rounded-r-xl border border-line bg-white px-3 py-2.5 text-base focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink/20" />
        </div>
        <button type="submit" disabled={saving || !name.trim()} className="rounded-xl bg-pink px-5 py-2.5 font-medium text-white shadow-sm disabled:opacity-50">{saving ? '…' : t('บันทึกชื่อ TikTok')}</button>
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    </form>
  );

  const look = {
    live: { dot: 'bg-red-500 animate-pulse', box: 'border-red-200 bg-gradient-to-r from-red-50 to-pink-soft/60', badge: 'bg-red-500 text-white', text: t('🔴 กำลังไลฟ์') },
    waiting: { dot: 'bg-amber-400 animate-pulse', box: 'border-amber-200 bg-amber-50/70', badge: 'bg-amber-400 text-ink', text: t('⏳ เชื่อมต่อแล้ว — รอเริ่มไลฟ์') },
    idle: { dot: 'bg-gray-300', box: 'border-line bg-white', badge: 'bg-gray-100 text-muted', text: t('⚪ ยังไม่ได้เชื่อมต่อไลฟ์') },
    'no-username': { dot: 'bg-gray-300', box: 'border-line bg-white', badge: 'bg-gray-100 text-muted', text: t('ยังไม่ได้ตั้งชื่อ TikTok') },
  }[s.state];
  const mins = s.since ? Math.max(1, Math.round((Date.now() - s.since) / 60000)) : 0;

  return (
    <div className="mb-6">
    <div className={`flex flex-col gap-3 rounded-2xl border p-4 shadow-sm sm:flex-row sm:items-center ${look.box}`}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="relative">
          <TikTokAvatar username={s.username} size={48} />
          <span className={`absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full ring-2 ring-white ${look.dot}`} />
        </div>
        <div className="min-w-0">
          <div className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold sm:text-base ${look.badge}`}>{look.text}</div>
          {editing ? (
            <form onSubmit={saveName} className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-sm text-muted">@</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoFocus className="w-40 rounded-lg border border-line bg-white px-2 py-1 text-sm focus:border-pink focus:outline-none" />
              <button type="submit" disabled={saving} className="rounded-lg bg-pink px-3 py-1 text-xs font-medium text-white disabled:opacity-50">{saving ? '…' : t('บันทึก')}</button>
              <button type="button" onClick={() => { setEditing(false); setErr(''); }} className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-white">{t('ยกเลิก')}</button>
              {err && <span className="w-full text-xs text-red-600">{err}</span>}
            </form>
          ) : (
            <div className="mt-1 flex items-center gap-1.5 truncate text-sm text-muted">
              {s.username ? <>TikTok.com/<b className="text-ink">@{s.username}</b></> : t('ตั้งชื่อ TikTok เพื่อเริ่มใช้งาน')}
              {/* ระหว่างไลฟ์ห้ามเปลี่ยนชื่อ (วิดเจ็ตทุกตัวจะหลุดไปต่อบัญชีอื่น) */}
              {s.state === 'live'
                ? <span title={t('เปลี่ยนชื่อ TikTok ได้หลังจบไลฟ์')} className="cursor-not-allowed text-gray-300"><Pencil className="size-3.5" /></span>
                : <button type="button" onClick={() => { setName(s.username ?? ''); setEditing(true); }} title={t('แก้ชื่อ TikTok')} className="text-muted hover:text-pink"><Pencil className="size-3.5" /></button>}
            </div>
          )}
        </div>
      </div>
      {s.state === 'live' && (
        <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-4">
          <span className="flex items-center gap-1.5 rounded-xl bg-white/70 px-3 py-2 text-sm"><Eye className="size-4 text-violet" /><b>{nf(s.viewers)}</b></span>
          <span className="flex items-center gap-1.5 rounded-xl bg-white/70 px-3 py-2 text-sm"><Gem className="size-4 text-sky-500" /><b>{nf(s.diamonds)}</b></span>
          <span className="flex items-center gap-1.5 rounded-xl bg-white/70 px-3 py-2 text-sm"><Heart className="size-4 text-pink" /><b>{nf(s.likes)}</b></span>
        </div>
      )}
      {s.state === 'live' && <div className="text-xs text-muted sm:w-24 sm:text-right">{t('ไลฟ์มา {m} นาที', { m: mins })}</div>}
    </div>
    {/* ยังไม่ไลฟ์ → ป้ายเด่น ๆ บอกวิธีใช้ให้ถูก (เปิดวิดเจ็ตตอนไลฟ์ — ไม่ต้องเปิดค้างไว้ทั้งวัน) */}
    {(s.state === 'idle' || s.state === 'waiting') && (
      <div className="mt-2 flex items-start gap-3 rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 via-pink-soft/60 to-amber-50 p-3.5 shadow-sm sm:items-center sm:p-4">
        <span className="grid size-10 shrink-0 animate-pulse place-items-center rounded-full bg-amber-400 text-xl shadow">📢</span>
        <div className="min-w-0">
          <div className="text-base font-bold text-ink sm:text-lg">{t('วิดเจ็ตทำงานตอนคุณไลฟ์เท่านั้น')}</div>
          <div className="mt-0.5 text-sm text-ink/80">{t('เริ่มไลฟ์ใน TikTok ก่อน แล้วเปิดโปรแกรมไลฟ์ (OBS / TikTok LIVE Studio) — ระบบต่อให้เองในไม่กี่วินาที · ไม่ต้องเปิดค้างไว้ก่อนไลฟ์นาน ๆ')}</div>
        </div>
      </div>
    )}
    </div>
  );
}
