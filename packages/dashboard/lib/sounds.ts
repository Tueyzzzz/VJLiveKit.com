/** เสียงที่ใช้ร่วมกัน: เสียงสำเร็จรูป (overlay/js/sfx.js) + ไฟล์ที่อัปโหลด — เล่นในเบราว์เซอร์ของวีเจ */

import { translate } from './i18n';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

/** ชื่อแสดงเป็นภาษาไทย — แปลตอนแสดงผลด้วย t(name) */
export const SFX: [string, string][] = [['chime', '🔔 กริ๊ง'], ['coin', '🪙 เหรียญ'], ['levelup', '⬆️ เลเวลอัป'], ['fanfare', '🎺 ฟันแฟร์'], ['magic', '✨ เวทมนตร์'], ['pop', '🫧 ป๊อป'], ['whoosh', '💨 วู้ช'], ['drum', '🥁 ตึ่งโป๊ะ'], ['boing', '🌀 ดึ๋ง'], ['heart', '💗 หัวใจ'], ['applause', '👏 ปรบมือ'], ['punch', '🥊 ต่อยน่ารัก'], ['boom', '💥 บูม! (Boom)'], ['airhorn', '📯 แตรลม (Airhorn)'], ['sadtrombone', '🎺 แป่วว (Sad trombone)'], ['crickets', '🦗 จิ้งหรีด (เงียบกริบ)'], ['scratch', '💿 ขูดแผ่น (Record scratch)'], ['bonk', '🔨 โป๊ก! (Bonk)'], ['correct', '✅ ติ๊งต่อง (ถูกต้อง)'], ['wrong', '❌ บิ๊บ (ผิด!)'], ['drumroll', '🥁 ตีกลองรัว'], ['suspense', '😱 ตึ่ง ตึ่ง ตึ๊ง (ลุ้น)'], ['tada', '🎉 ทาด๊า!'], ['pew', '🔫 ปิ้ว (เลเซอร์)'], ['kaching', '💰 กริ๊งเงิน (Ka-ching)'], ['slideup', '📈 หวีดขึ้น (Slide whistle)'], ['slidedown', '📉 หวีดลง (ร่วง)'], ['alarm', '🚨 ไซเรน']];
/** ความยาวโดยประมาณของเสียงสำเร็จรูป (ms) — ใช้ต่อคิว */
const SFX_MS: Record<string, number> = { chime: 900, coin: 500, levelup: 600, fanfare: 1800, magic: 1000, pop: 200, whoosh: 650, drum: 800, boing: 500, heart: 1000, applause: 1700, punch: 1000, boom: 1700, airhorn: 1300, sadtrombone: 2400, crickets: 2600, scratch: 500, bonk: 300, correct: 700, wrong: 600, drumroll: 2200, suspense: 2200, tada: 1200, pew: 300, kaching: 800, slideup: 700, slidedown: 900, alarm: 1300 };

export interface Upload { id: string; name: string; size: number; url: string }
/**
 * ไฟล์ → data URL สำหรับอัปโหลดเป็น "เสียง"
 * วิดีโอ (mp4/mov/webm) → ดึงเสียงออกมาแปลงเป็นไฟล์เสียง (WAV โมโน 22kHz) ในเครื่องเลย ไม่ต้องใช้โปรแกรมอื่น
 * maxSec = ตัดเหลือไม่เกินกี่วินาที (กันไฟล์ใหญ่)
 */
export async function toAudioDataUrl(f: File, maxSec = 60): Promise<string> {
  if (!f.type.startsWith('video/')) return readAsDataUrl(f);
  const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  const ac = new AC();
  let buf: AudioBuffer;
  try { buf = await ac.decodeAudioData(await f.arrayBuffer()); } catch { throw new Error('ดึงเสียงจากวิดีโอนี้ไม่ได้ — ลองไฟล์ mp4 ทั่วไป'); } finally { void ac.close(); }
  const rate = 22050, len = Math.min(buf.duration, maxSec), n = Math.floor(len * rate);
  const off = new OfflineAudioContext(1, n, rate);
  const src = off.createBufferSource(); src.buffer = buf; src.connect(off.destination); src.start();
  const out = (await off.startRendering()).getChannelData(0);
  // เขียน WAV 16-bit
  const wav = new DataView(new ArrayBuffer(44 + n * 2));
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) wav.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); wav.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 1, true);
  wav.setUint32(24, rate, true); wav.setUint32(28, rate * 2, true); wav.setUint16(32, 2, true); wav.setUint16(34, 16, true); w(36, 'data'); wav.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) wav.setInt16(44 + i * 2, Math.max(-1, Math.min(1, out[i]!)) * 0x7fff, true);
  return readAsDataUrl(new File([wav.buffer], f.name.replace(/\.[^.]+$/, '') + '.wav', { type: 'audio/wav' }));
}

export const readAsDataUrl = (f: File) => new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => bad(new Error(translate('อ่านไฟล์ไม่ได้'))); r.readAsDataURL(f); });

let sfxLoad: Promise<void> | null = null;
function loadSfx(): Promise<void> {
  return (sfxLoad ??= new Promise((ok, bad) => {
    const s = document.createElement('script'); s.src = `${API_BASE}/overlay/js/sfx.js`;
    s.onload = () => ok(); s.onerror = () => { sfxLoad = null; bad(new Error('sfx')); };
    document.head.appendChild(s);
  }));
}

let current: HTMLAudioElement | null = null;
let cancelWait: (() => void) | null = null;

/** เล่นเสียงหนึ่งครั้ง → resolve เมื่อเล่นจบ (ไว้ต่อคิว) */
export async function playSound(a: { sound?: string; url?: string; volume?: number }): Promise<void> {
  const vol = Math.max(0, Math.min(1.5, a.volume ?? 1));
  if (a.sound) {
    try { await loadSfx(); } catch { return; }
    const sfx = (window as unknown as { VJLSfx?: { play: (id: string, v?: number) => boolean; dur?: (id: string) => number } }).VJLSfx;
    sfx?.play(a.sound, vol);
    await new Promise<void>((r) => { const t = setTimeout(r, (sfx?.dur?.(a.sound!) ?? SFX_MS[a.sound!] ?? 800) + 120); cancelWait = () => { clearTimeout(t); r(); }; });
    cancelWait = null;
    return;
  }
  if (!a.url) return;
  await new Promise<void>((done) => {
    const au = new Audio(a.url); au.volume = Math.min(1, vol);
    let fin = false;
    const end = () => { if (fin) return; fin = true; clearTimeout(cap); if (current === au) current = null; cancelWait = null; done(); };
    const cap = setTimeout(() => { au.pause(); end(); }, 60_000); // ไฟล์ยาวเกิน 1 นาที → ตัด ไม่ให้คิวค้าง
    au.onended = end; au.onerror = end;
    current = au; cancelWait = () => { au.pause(); end(); };
    au.play().catch(end);
  });
}

/**
 * ตั้งค่าการเล่นเสียง — เก็บในบัญชี (ตั้งค่าวิดเจ็ต fx) ใช้ทั้งเว็บนี้และลิงก์ FX ในโปรแกรมไลฟ์
 * simultaneous=true เล่นซ้อนกันได้ · false (ค่าเริ่มต้น) = เข้าคิวเล่นทีละเสียงต่อกัน
 * มีสำเนาใน localStorage ไว้อ่านแบบทันที (enqueueSound ต้องรู้ค่าโดยไม่รอเน็ต)
 */
export interface SoundPrefs { simultaneous: boolean; maxQueue: number }
const PREF_KEY = 'vjl-sound-prefs';
const DEFAULT_PREFS: SoundPrefs = { simultaneous: false, maxQueue: 20 };
export function getSoundPrefs(): SoundPrefs {
  try { return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(PREF_KEY) || '{}') as Partial<SoundPrefs>) }; } catch { return { ...DEFAULT_PREFS }; }
}
export function setSoundPrefs(p: SoundPrefs): void { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* ignore */ } }
/** แปลงจากตั้งค่า fx ในบัญชี (soundOverlap / soundQueue) */
export function prefsFromFx(c: Record<string, unknown> | undefined): SoundPrefs {
  const q = Number(c?.soundQueue);
  return { simultaneous: String(c?.soundOverlap ?? '0') === '1', maxQueue: q >= 1 ? Math.min(500, Math.floor(q)) : DEFAULT_PREFS.maxQueue };
}
/** โหลดตั้งค่าจากบัญชีมาเก็บในเครื่องนี้ (เรียกตอนเปิดเว็บ) */
export async function syncSoundPrefs(get: () => Promise<{ config?: Record<string, unknown> }>): Promise<SoundPrefs> {
  try { const p = prefsFromFx((await get()).config); setSoundPrefs(p); return p; } catch { return getSoundPrefs(); }
}

/**
 * แท็บไหนเป็นตัวเล่นเสียง — เปิดเว็บหลายแท็บพร้อมกันจะได้ไม่ดังซ้ำหลายรอบ (เสียงดังเกิน/ตีกัน)
 * แต่ละแท็บเรียก claimSoundLead() ทุก ๆ 3 วิ แท็บแรกได้สิทธิ์ ปิดแท็บนั้น → ~8 วิแท็บอื่นรับต่อ
 */
const LEAD_KEY = 'vjl-sound-lead';
const tabId = () => (typeof window === 'undefined' ? '' : ((window as unknown as { __vjlTab?: string }).__vjlTab ??= Math.random().toString(36).slice(2, 10)));
export function claimSoundLead(): boolean {
  const me = tabId(), now = Date.now();
  try {
    const lead = JSON.parse(localStorage.getItem(LEAD_KEY) ?? '{}') as { tab?: string; ts?: number };
    if (!lead.tab || lead.tab === me || now - (lead.ts ?? 0) > 8000) { localStorage.setItem(LEAD_KEY, JSON.stringify({ tab: me, ts: now })); return true; }
    return false;
  } catch { return true; } // storage ปิด → เล่นเองตามปกติ
}
export function releaseSoundLead(): void {
  try { const lead = JSON.parse(localStorage.getItem(LEAD_KEY) ?? '{}') as { tab?: string }; if (lead.tab === tabId()) localStorage.removeItem(LEAD_KEY); } catch { /* ignore */ }
}

/** คิวเสียง: เล่นซ้อนกันได้ หรือเล่นทีละเสียงตามลำดับ (ไม่เกินความยาวคิวที่ตั้ง) */
const queue: (() => Promise<void>)[] = [];
let running = false;
export function enqueueSound(a: { sound?: string; url?: string; volume?: number }): void {
  const p = getSoundPrefs();
  if (p.simultaneous) { void playSound(a); return; }
  if (queue.length >= p.maxQueue) return; // คิวเต็ม → ข้าม (กันเสียงค้างยาวหลายนาที)
  queue.push(() => playSound(a));
  if (running) return;
  running = true;
  void (async () => { while (queue.length) { try { await queue.shift()!(); } catch { /* ข้ามเสียงที่เสีย */ } } running = false; })();
}
/** จำนวนเสียงที่รอคิวอยู่ */
export const queuedSounds = () => queue.length;
/** หยุดเสียงที่กำลังเล่น + ล้างคิว (ในเครื่องนี้) */
export function stopAllSounds(): void {
  queue.length = 0;
  current?.pause();
  cancelWait?.();
}
