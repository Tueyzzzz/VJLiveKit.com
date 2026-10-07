'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Scissors, Upload as UploadIcon, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { Upload } from '@/lib/sounds';
import { Alert, Button, Spinner } from './ui';

const RATE = 22050, MAX_SEC = 90;
const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

/** ตัดช่วง [a,b] ของเสียง → WAV โมโน 22kHz (data URL) */
async function encodeWav(buf: AudioBuffer, a: number, b: number): Promise<string> {
  const n = Math.max(1, Math.floor((b - a) * RATE));
  const off = new OfflineAudioContext(1, n, RATE);
  const src = off.createBufferSource(); src.buffer = buf;
  const g = off.createGain(); // เฟดเข้า-ออกสั้น ๆ กันเสียงคลิก
  g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(1, 0.02); g.gain.setValueAtTime(1, Math.max(0.03, (b - a) - 0.03)); g.gain.linearRampToValueAtTime(0, b - a);
  src.connect(g); g.connect(off.destination); src.start(0, a, b - a);
  const out = (await off.startRendering()).getChannelData(0);
  const v = new DataView(new ArrayBuffer(44 + n * 2));
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, out[i]!)) * 0x7fff, true);
  return new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(new Blob([v.buffer], { type: 'audio/wav' })); });
}

/**
 * ปุ่มอัปโหลดเสียง + ตัดท่อน: เลือกไฟล์เสียงหรือวิดีโอ → ลากเลือกช่วงที่ต้องการ (ฟังก่อนได้) → อัปโหลดเฉพาะท่อนนั้น
 * วิดีโอถูกแปลงเป็นเสียงในเครื่อง (ไม่ต้องใช้โปรแกรมอื่น)
 */
export function SoundUpload({ onUploaded, label, className = '' }: { onUploaded: (u: Upload) => void; label?: string; className?: string }) {
  const t = useT();
  const [file, setFile] = useState<File | null>(null);
  return (
    <>
      <label className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-sm hover:bg-pink-soft ${className}`}>
        <UploadIcon className="size-4" /> {label ?? t('อัปโหลด')}
        <input type="file" accept="audio/*,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setFile(f); }} />
      </label>
      {file && <Trimmer file={file} onClose={() => setFile(null)} onUploaded={(u) => { setFile(null); onUploaded(u); }} />}
    </>
  );
}

function Trimmer({ file, onClose, onUploaded }: { file: File; onClose: () => void; onUploaded: (u: Upload) => void }) {
  const t = useT();
  const [buf, setBuf] = useState<AudioBuffer | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [a, setA] = useState(0), [b, setB] = useState(0);
  const [busy, setBusy] = useState(false), [playing, setPlaying] = useState(false), [pos, setPos] = useState<number | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const ac = useRef<AudioContext | null>(null), node = useRef<AudioBufferSourceNode | null>(null), raf = useRef(0);

  useEffect(() => {
    let dead = false;
    void (async () => {
      try {
        const ctx = new AudioContext(); ac.current = ctx;
        const d = await ctx.decodeAudioData(await file.arrayBuffer());
        if (dead) return;
        setBuf(d); setA(0); setB(Math.min(d.duration, 15)); // เริ่มที่ 15 วินาทีแรก — ลากปรับได้
      } catch { setErr(t('เปิดไฟล์นี้ไม่ได้ — ลองไฟล์ mp3 / mp4 ทั่วไป')); }
    })();
    return () => { dead = true; node.current?.stop(); cancelAnimationFrame(raf.current); void ac.current?.close(); };
  }, [file, t]);

  // วาดคลื่นเสียง + ช่วงที่เลือก
  useEffect(() => {
    const cv = canvas.current; if (!cv || !buf) return;
    const W = cv.width = cv.clientWidth * 2, H = cv.height = 160, ctx = cv.getContext('2d')!, ch = buf.getChannelData(0), step = Math.ceil(ch.length / W);
    ctx.clearRect(0, 0, W, H);
    const x = (s: number) => (s / buf.duration) * W;
    ctx.fillStyle = 'rgba(255,106,168,.12)'; ctx.fillRect(x(a), 0, x(b) - x(a), H);
    for (let i = 0; i < W; i++) {
      let mx = 0; for (let j = 0; j < step; j += 8) mx = Math.max(mx, Math.abs(ch[i * step + j] ?? 0));
      const inSel = i >= x(a) && i <= x(b);
      ctx.fillStyle = inSel ? '#ff6aa8' : '#d8cfe3'; const h = Math.max(2, mx * H * 0.9); ctx.fillRect(i, (H - h) / 2, 1, h);
    }
    ctx.fillStyle = '#7c3aed'; ctx.fillRect(x(a) - 2, 0, 4, H); ctx.fillRect(x(b) - 2, 0, 4, H);
    if (pos !== null) { ctx.fillStyle = '#3d2f45'; ctx.fillRect(x(pos) - 1, 0, 2, H); }
  }, [buf, a, b, pos]);

  function stop() { node.current?.stop(); node.current = null; setPlaying(false); setPos(null); cancelAnimationFrame(raf.current); }
  function play() {
    if (!buf || !ac.current) return;
    if (playing) { stop(); return; }
    const s = ac.current.createBufferSource(); s.buffer = buf; s.connect(ac.current.destination);
    const t0 = ac.current.currentTime; s.start(0, a, b - a); s.onended = () => stop(); node.current = s; setPlaying(true);
    const tick = () => { if (!ac.current) return; setPos(a + (ac.current.currentTime - t0)); raf.current = requestAnimationFrame(tick); }; tick();
  }
  async function upload() {
    if (!buf) return;
    stop(); setBusy(true); setErr(null);
    try {
      const data = await encodeWav(buf, a, b);
      const name = (file.name.replace(/\.[^.]+$/, '') || 'เสียง').slice(0, 52) + (a > 0 || b < buf.duration ? ` (${fmt(a)})` : '');
      const r = await api<{ sound: Upload }>('/api/sounds', { method: 'POST', body: { name: name.slice(0, 60), data } });
      onUploaded(r.sound);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  // คลิกบนคลื่น = ย้ายจุดที่ใกล้กว่า (เริ่ม/จบ)
  function onWave(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!buf) return;
    const r = e.currentTarget.getBoundingClientRect(), s = Math.max(0, Math.min(buf.duration, ((e.clientX - r.left) / r.width) * buf.duration));
    if (Math.abs(s - a) < Math.abs(s - b)) setA(Math.min(s, b - 0.2)); else setB(Math.max(s, a + 0.2));
  }
  const len = b - a, tooLong = len > MAX_SEC;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-end bg-black/40 sm:place-items-center" onClick={onClose}>
      <div className="w-full rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-medium"><Scissors className="size-4 text-pink" /> {t('ตัดท่อนเสียง')}</h2>
          <button onClick={onClose} aria-label={t('ปิด')}><X className="size-5 text-muted" /></button>
        </div>
        <p className="mb-2 truncate text-xs text-muted">{file.name}</p>
        {!buf && !err && <div className="py-10"><Spinner /></div>}
        {buf && (
          <>
            <canvas ref={canvas} onPointerDown={onWave} className="h-20 w-full cursor-pointer touch-none rounded-xl bg-canvas" />
            <div className="mt-3 space-y-2 text-sm">
              <label className="flex items-center gap-2"><span className="w-12 text-muted">{t('เริ่ม')}</span>
                <input type="range" min={0} max={buf.duration} step={0.05} value={a} onChange={(e) => setA(Math.min(Number(e.target.value), b - 0.2))} className="flex-1 accent-pink" />
                <span className="w-14 text-right tabular-nums">{fmt(a)}</span></label>
              <label className="flex items-center gap-2"><span className="w-12 text-muted">{t('จบ')}</span>
                <input type="range" min={0} max={buf.duration} step={0.05} value={b} onChange={(e) => setB(Math.max(Number(e.target.value), a + 0.2))} className="flex-1 accent-pink" />
                <span className="w-14 text-right tabular-nums">{fmt(b)}</span></label>
            </div>
            <p className={`mt-2 text-xs ${tooLong ? 'text-red-600' : 'text-muted'}`}>{t('ความยาว {s} วินาที (ไม่เกิน {max} วินาที) · แตะบนคลื่นเพื่อย้ายจุดเริ่ม/จบ', { s: len.toFixed(1), max: MAX_SEC })}</p>
          </>
        )}
        {err && <div className="mt-3"><Alert>{err}</Alert></div>}
        <div className="mt-4 flex flex-wrap justify-between gap-2">
          <Button variant="secondary" onClick={play} disabled={!buf}>{playing ? <><Pause className="size-4" /> {t('หยุด')}</> : <><Play className="size-4" /> {t('ฟังท่อนนี้')}</>}</Button>
          <Button onClick={() => void upload()} loading={busy} disabled={!buf || tooLong}><UploadIcon className="size-4" /> {t('อัปโหลดท่อนนี้')}</Button>
        </div>
      </div>
    </div>
  );
}
