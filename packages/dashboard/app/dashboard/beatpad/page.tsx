'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Lock, Pencil, Plus, Trash2, Upload as UploadIcon, X } from 'lucide-react';
import { Alert, Button, Input, PageHeader, Select, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { SoundUpload } from '@/components/SoundUpload';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { SFX, playSound, readAsDataUrl, toAudioDataUrl, type Upload } from '@/lib/sounds';
import { TAB_ID } from '@/components/Speaker';

interface Pad { label: string; emoji?: string; color: string; sound?: string; url?: string; volume: number; key?: string; media?: string; mediaType?: 'image' | 'video' }
interface Board { cols: number; pads: Pad[] }
const COLORS = ['#f472b6', '#a78bfa', '#60a5fa', '#38bdf8', '#4ade80', '#84cc16', '#facc15', '#fb923c', '#f87171', '#c084fc', '#2dd4bf', '#94a3b8'];
const EMOJIS = ['👏', '🥁', '🔔', '🎺', '💗', '✨', '🚨', '🥊', '🌀', '😂', '🤣', '😱', '🎉', '💸', '🐐', '🔥', '💀', '🫶', '🎵', '📢'];
const FREE_PADS = 8, MAX_PADS = 24;

/**
 * Beat Pad — กดปุ่มเล่นเสียงระหว่างไลฟ์ · เปิดบนมือถือเป็นรีโมทได้
 * เสียงไปดังที่คอมที่เปิดเว็บไว้ (หรือจอ FX) · ปุ่ม 1–9 บนคีย์บอร์ดกดได้
 */
export default function BeatPadPage() {
  const t = useT();
  const { entitlements } = useAuth();
  const [board, setBoard] = useState<Board | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [edit, setEdit] = useState<number | null>(null);
  const [hit, setHit] = useState<number | null>(null);
  const [here, setHere] = useState(false); // เล่นที่เครื่องนี้ด้วย
  const [narrow, setNarrow] = useState(false); // มือถือ: ไม่เกิน 3 คอลัมน์ ปุ่มจะได้ใหญ่พอกด
  useEffect(() => { const f = () => setNarrow(innerWidth < 640); f(); addEventListener('resize', f); return () => removeEventListener('resize', f); }, []);
  const [note, setNote] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const limit = entitlements?.plan === 'free' ? FREE_PADS : MAX_PADS;

  useEffect(() => {
    api<{ board: Board }>('/api/beatpad').then((r) => setBoard(r.board)).catch((e) => setNote({ tone: 'error', text: (e as Error).message }));
    api<{ sounds: Upload[] }>('/api/sounds').then((r) => setUploads(r.sounds)).catch(() => {});
    // ค่าเริ่มต้น = เล่นที่เครื่องนี้ด้วย (ติ๊กออกได้ ถ้าใช้มือถือเป็นรีโมทอย่างเดียว)
    try { setHere(localStorage.getItem('vjl-pad-here') !== '0'); } catch { setHere(true); }
  }, []);
  const save = useCallback(async (b: Board) => {
    setBoard(b);
    try { await api('/api/beatpad', { method: 'PUT', body: b }); } catch (e) { setNote({ tone: 'error', text: (e as Error).message }); }
  }, []);

  const press = useCallback(async (i: number) => {
    const p = board?.pads[i]; if (!p || (!p.sound && !p.url && !p.media) || i >= limit) return;
    setHit(i); setTimeout(() => setHit((h) => (h === i ? null : h)), 180);
    if (here) void playSound(p);
    try {
      const r = await api<{ screens: number }>('/api/beatpad/play', { method: 'POST', body: { ...p, tab: TAB_ID } });
      if (!r.screens && !here) setNote({ tone: 'info', text: t('ยังไม่มีเครื่องไหนเปิดรับเสียง — เปิดเว็บนี้ค้างไว้ที่คอมที่ไลฟ์ (เปิด "เสียงจากกฎ") หรือใส่ลิงก์ FX ในโปรแกรมไลฟ์') });
    } catch (e) { setNote({ tone: 'error', text: (e as Error).message }); }
  }, [board, here, limit, t]);

  // คีย์บอร์ด 1–9 = ปุ่ม 1–9 (ยกเว้นตอนพิมพ์)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (edit !== null || e.repeat || e.ctrlKey || e.metaKey || e.altKey || (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      // คีย์ลัดที่ตั้งเองก่อน แล้วค่อย 1–9
      const k = board?.pads.findIndex((p, i) => i < limit && p.key && p.key.toLowerCase() === e.key.toLowerCase()) ?? -1;
      if (k >= 0) { e.preventDefault(); void press(k); return; }
      const n = Number(e.key); if (n >= 1 && n <= 9 && !board?.pads.some((p) => p.key === e.key)) void press(n - 1);
    };
    addEventListener('keydown', onKey); return () => removeEventListener('keydown', onKey);
  }, [press, edit, board, limit]);

  if (!board) return <Spinner />;
  const slots = Math.min(MAX_PADS, Math.max(board.pads.length + 1, limit === FREE_PADS ? 12 : board.pads.length + 1));
  const update = (i: number, p: Partial<Pad>) => { const pads = board.pads.slice(); pads[i] = { ...pads[i]!, ...p }; void save({ ...board, pads }); };

  return (
    <div>
      <PageHeader title="🎛️ Beat Pad" description={t('กดปุ่มเล่นเสียงระหว่างไลฟ์ — เปิดหน้านี้บนมือถือใช้เป็นรีโมทได้ เสียงไปดังที่คอมที่ไลฟ์')} />
      {note && <div className="mb-4"><Alert tone={note.tone === 'error' ? undefined : 'info'}>{note.text}</Alert></div>}

      <div className="rounded-3xl border border-white/10 bg-[#17121f] p-3 shadow-xl sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <Select className="!w-auto !border-white/10 !bg-white/5 !text-white" value={board.cols} onChange={(e) => void save({ ...board, cols: Number(e.target.value) })} aria-label={t('จำนวนคอลัมน์')}>
            {/* ตัวเลือกในรายการต้องเป็นตัวเข้มบนพื้นขาว (ปุ่มเป็นตัวขาวบนพื้นมืด — เดิมรายการเป็นขาวบนขาว มองไม่เห็น) */}
            {[2, 3, 4, 5].map((c) => <option key={c} value={c} style={{ color: '#3d2f45', background: '#fff' }}>{t('{n} คอลัมน์', { n: c })}</option>)}
          </Select>
          {/* หัวแผงแบบ VJLiveKit: หัวใจในวงกลมทอง + ชื่อไล่สีชมพู-ม่วง */}
          <h2 className="flex items-center gap-2 font-display text-xl font-bold sm:text-2xl">
            <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="33" r="27" fill="#ffcf5c"/><path d="M32 50c-8-5.6-15-11-15-18.6A8 8 0 0 1 32 27a8 8 0 0 1 15 4.4C47 39 40 44.4 32 50z" fill="#ff6aa8"/></svg>
            <span className="bg-gradient-to-r from-[#ff8ac2] via-[#e0b0ff] to-[#9ad9ff] bg-clip-text text-transparent">VJ Beat Pad</span>
          </h2>
          <label className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs text-white/80">
            <input type="checkbox" className="accent-pink" checked={here} onChange={(e) => { setHere(e.target.checked); try { localStorage.setItem('vjl-pad-here', e.target.checked ? '1' : '0'); } catch { /* ignore */ } }} />
            {t('เล่นที่เครื่องนี้ด้วย')}
          </label>
        </div>

        <div className="grid gap-2.5 sm:gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(board.cols, narrow ? 3 : 4)}, minmax(0,1fr))` }}>
          {Array.from({ length: slots }, (_, i) => {
            const p = board.pads[i], locked = i >= limit;
            if (locked) return (
              <Link key={i} href="/dashboard/billing/" className="grid aspect-square place-items-center rounded-2xl border border-white/10 bg-black/40 p-2 text-center text-[11px] font-semibold text-white/60 sm:text-sm">
                <span><Lock className="mx-auto mb-1 size-5" />{t('อัปเกรดเป็น Pro เพื่อปลดล็อก')}</span>
              </Link>
            );
            if (!p) return (
              <button key={i} onClick={() => { void save({ ...board, pads: [...board.pads, { label: '', emoji: '🎵', color: COLORS[i % COLORS.length]!, sound: 'pop', volume: 1 }] }); setEdit(board.pads.length); }}
                className="grid aspect-square place-items-center rounded-2xl border border-dashed border-white/15 bg-white/5 text-white/50 transition hover:bg-white/10">
                <span className="text-center"><Plus className="mx-auto size-6" /><span className="text-xs sm:text-sm">{t('เพิ่ม Pad')}</span></span>
              </button>
            );
            const ready = !!(p.sound || p.url);
            return (
              <div key={i} className="relative">
                <button onPointerDown={(e) => { e.preventDefault(); void press(i); }}
                  className={`grid aspect-square w-full select-none place-items-center rounded-2xl p-2 text-center text-white shadow-[0_6px_0_rgba(0,0,0,.35)] transition active:translate-y-1 active:shadow-[0_2px_0_rgba(0,0,0,.35)] ${hit === i ? 'brightness-125' : ''} ${ready ? '' : 'opacity-50'}`}
                  style={{ background: `linear-gradient(160deg, ${p.color}, color-mix(in srgb, ${p.color} 70%, #000))` }}>
                  <span>
                    <span className="block text-2xl sm:text-4xl">{p.emoji || '🎵'}</span>
                    <span className="mt-1 block truncate text-xs font-bold sm:text-sm">{p.label || (p.sound ? t(SFX.find(([id]) => id === p.sound)?.[1] ?? p.sound) : t('ไฟล์ของฉัน'))}</span>
                    {(p.key || i < 9) && <span className="mt-0.5 block text-[10px] text-white/70">{p.key ? p.key.toUpperCase() : i + 1}</span>}
                  </span>
                </button>
                <button onClick={() => setEdit(i)} aria-label={t('แก้ไข')} className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/25 text-white/90 hover:bg-black/50 sm:right-1.5 sm:top-1.5 sm:size-8"><Pencil className="size-3 sm:size-3.5" /></button>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex justify-center">
          <button onClick={async () => { if (!confirm(t('เปลี่ยนเป็นชุดเสียงมีม 12 ปุ่ม? (ปุ่มที่ตั้งไว้จะถูกแทนที่)'))) return; const r = await api<{ board: Board }>('/api/beatpad/default'); void save(r.board); }}
            className="rounded-full bg-white/10 px-4 py-1.5 text-xs text-white/80 hover:bg-white/20">🎭 {t('ใช้ชุดเสียงมีม (ค่าเริ่มต้น)')}</button>
        </div>
        <p className="mt-3 text-center text-xs text-white/50">{t('กด 1–9 บนคีย์บอร์ดได้ · เสียงดังที่คอมที่เปิดเว็บนี้ไว้ (เปิด “เสียงจากกฎ” ที่เมนูข้าง) หรือที่ลิงก์ FX')}</p>
      </div>

      {edit !== null && board.pads[edit] && (
        <PadEditor pad={board.pads[edit]!} uploads={uploads} onUploaded={(u) => setUploads((x) => [u, ...x])}
          onChange={(p) => update(edit, p)} onClose={() => setEdit(null)}
          onDelete={() => { void save({ ...board, pads: board.pads.filter((_, k) => k !== edit) }); setEdit(null); }} />
      )}
    </div>
  );
}

function PadEditor({ pad, uploads, onUploaded, onChange, onClose, onDelete }: {
  pad: Pad; uploads: Upload[]; onUploaded: (u: Upload) => void; onChange: (p: Partial<Pad>) => void; onClose: () => void; onDelete: () => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const value = pad.sound || (pad.url ? 'url:' + pad.url : '');
  // อัปโหลดสติกเกอร์ (gif/png/webp) หรือวิดีโอ (mp4/webm) ขึ้นจอ FX
  async function uploadMedia(f: File) {
    if (f.size > 20 * 1024 * 1024) { setErr(t('วิดีโอ/รูปใหญ่เกิน 20MB — ตัดให้สั้นลงก่อน')); return; }
    setBusy(true); setErr(null);
    try {
      const r = await api<{ sound: { url: string; kind?: string } }>('/api/sounds', { method: 'POST', body: { name: f.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'media', data: await readAsDataUrl(f) } });
      onChange({ media: r.sound.url, mediaType: f.type.startsWith('video/') ? 'video' : 'image' });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function upload(f: File) {
    setBusy(true); setErr(null);
    try {
      const r = await api<{ sound: Upload }>('/api/sounds', { method: 'POST', body: { name: f.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'เสียง', data: await toAudioDataUrl(f) } });
      onUploaded(r.sound); onChange({ url: r.sound.url, sound: undefined, label: pad.label || r.sound.name.slice(0, 24) });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 sm:place-items-center" onClick={onClose}>
      <div className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="font-medium">{t('แก้ไขปุ่ม')}</h2><button onClick={onClose} aria-label={t('ปิด')}><X className="size-5 text-muted" /></button></div>
        <div className="space-y-4">
          <label className="block text-sm font-medium">{t('ชื่อปุ่ม')}<Input className="mt-1" maxLength={24} value={pad.label} onChange={(e) => onChange({ label: e.target.value })} placeholder={t('เช่น ตบมุข')} /></label>
          <div>
            <div className="mb-1 text-sm font-medium">{t('ไอคอน')}</div>
            <div className="flex flex-wrap gap-1.5">{EMOJIS.map((e) => <button key={e} onClick={() => onChange({ emoji: e })} className={`grid size-10 place-items-center rounded-xl border text-xl ${pad.emoji === e ? 'border-pink bg-pink-soft' : 'border-line'}`}>{e}</button>)}</div>
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">{t('สีปุ่ม')}</div>
            <div className="flex flex-wrap gap-2">{COLORS.map((c) => <button key={c} onClick={() => onChange({ color: c })} aria-label={c} className={`size-9 rounded-full ring-offset-2 ${pad.color === c ? 'ring-2 ring-ink' : ''}`} style={{ background: c }} />)}</div>
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">{t('เสียง')}</div>
            <div className="flex flex-wrap gap-2">
              <Select className="min-w-0 flex-1" value={value} onChange={(e) => { const v = e.target.value; onChange(v.startsWith('url:') ? { url: v.slice(4), sound: undefined } : { sound: v, url: undefined }); }}>
                <optgroup label={t('เสียงสำเร็จรูป')}>{SFX.map(([id, n]) => <option key={id} value={id}>{t(n)}</option>)}</optgroup>
                {uploads.length > 0 && <optgroup label={t('🎵 ไฟล์ที่อัปโหลด')}>{uploads.map((u) => <option key={u.id} value={'url:' + u.url}>🎵 {u.name}</option>)}</optgroup>}
              </Select>
              <Button variant="secondary" className="px-3" onClick={() => void playSound(pad)}>▶</Button>
              <SoundUpload onUploaded={(u) => { onUploaded(u); onChange({ url: u.url, sound: undefined, label: pad.label || u.name.slice(0, 24) }); }} />
            </div>
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">{t('คีย์ลัด (Hotkey)')}</div>
            <div className="flex gap-2">
              <Input readOnly value={pad.key ? pad.key.toUpperCase() : ''} placeholder={t('แตะแล้วกดปุ่มบนคีย์บอร์ด')} className="flex-1 text-center"
                onKeyDown={(e) => { e.preventDefault(); if (e.key.length === 1 || /^F\d{1,2}$/.test(e.key)) onChange({ key: e.key }); }} />
              {pad.key && <Button variant="secondary" onClick={() => onChange({ key: undefined })}>{t('ล้าง')}</Button>}
            </div>
            <p className="mt-1 text-xs text-muted">{t('ใช้ได้ตอนหน้าต่างเว็บนี้เปิดอยู่ · ใช้มือถือเปิดหน้านี้เป็นรีโมทได้ทุกเวลา')}</p>
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">{t('สติกเกอร์ / วิดีโอ ขึ้นจอ (ไม่บังคับ)')}</div>
            <div className="flex gap-2">
              <Select className="!w-28" value={pad.mediaType ?? 'image'} onChange={(e) => onChange({ mediaType: e.target.value as 'image' | 'video' })}>
                <option value="image">{t('🖼️ สติกเกอร์')}</option><option value="video">{t('🎬 วิดีโอ')}</option>
              </Select>
              <Input className="min-w-0 flex-1" value={pad.media ?? ''} onChange={(e) => onChange({ media: e.target.value.trim() || undefined })} placeholder="https://…gif / .png / .mp4" />
              <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm hover:bg-pink-soft">
                {busy ? <Spinner /> : <UploadIcon className="size-4" />}
                <input type="file" accept="video/*,image/gif,image/png,image/webp,image/jpeg" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadMedia(f); }} />
              </label>
            </div>
            <p className="mt-1 text-xs text-muted">{t('ขึ้นบนจอ FX ในโปรแกรมไลฟ์ 4 วินาที พร้อมเสียง')}</p>
          </div>
          <label className="block text-sm font-medium">{t('ความดัง')} <span className="text-muted">{Math.round(pad.volume * 100)}%</span>
            <input type="range" min={0} max={1.5} step={0.05} value={pad.volume} onChange={(e) => onChange({ volume: Number(e.target.value) })} className="mt-1 w-full accent-pink" />
          </label>
          {err && <Alert>{err}</Alert>}
          <div className="flex justify-between gap-2 pt-1">
            <Button variant="ghost" className="text-red-600" onClick={() => { if (confirm(t('ลบปุ่มนี้?'))) onDelete(); }}><Trash2 className="size-4" /> {t('ลบปุ่ม')}</Button>
            <Button onClick={onClose}>{t('เสร็จ')}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
