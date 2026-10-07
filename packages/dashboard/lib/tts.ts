'use client';

import { getToken } from './api';

/**
 * อ่านแชทออกเสียง (TTS) แบบ TikFinity — เสียงดังที่หน้าเว็บที่เปิดค้างไว้ ไม่ต้องใส่ลิงก์ในโปรแกรมไลฟ์
 * ใช้เสียงของเบราว์เซอร์ (Web Speech) — Edge มีเสียงไทยธรรมชาติ (Premwadee/Niwat), Chrome/มือถือใช้เสียงไทยของเครื่อง
 * ตั้งค่าเก็บที่บัญชี (widgetConfig 'tts') · เลือกเสียง/เปิดที่เครื่องนี้ เก็บแยกต่อเครื่อง
 */

export interface TtsCfg {
  enabled: boolean;
  readChat: boolean; readGift: boolean; readFollow: boolean; readShare: boolean;
  /** all = อ่านทุกแชท · prefix = อ่านเฉพาะแชทที่ขึ้นต้นด้วย prefix */
  chatMode: 'all' | 'prefix'; prefix: string;
  minGift: number;
  tmplChat: string; tmplGift: string; tmplFollow: string; tmplShare: string;
  rate: number; pitch: number; volume: number;
  maxLen: number;
  /** วินาทีขั้นต่ำก่อนอ่านแชทคนเดิมอีก (กันสแปม) */
  userCooldown: number;
  skipLinks: boolean;
  /** คำต้องห้าม (คั่นด้วย ,) — เจอแล้วไม่อ่านข้อความนั้น */
  blocked: string;
  maxQueue: number;
  /** เสียงจากเซิร์ฟเวอร์ (Google) — 'browser' = ใช้เสียงในเครื่อง */
  cloudVoice: string;
}

export const TTS_DEF: TtsCfg = {
  enabled: false,
  readChat: true, readGift: true, readFollow: false, readShare: false,
  chatMode: 'all', prefix: '!',
  minGift: 1,
  tmplChat: '{name} พูดว่า {text}', tmplGift: '{name} ส่ง {gift} ขอบคุณค่ะ', tmplFollow: 'ขอบคุณ {name} ที่กดติดตามค่ะ', tmplShare: 'ขอบคุณ {name} ที่แชร์ไลฟ์ค่ะ',
  rate: 1, pitch: 1, volume: 1,
  maxLen: 120, userCooldown: 0, skipLinks: true, blocked: '', maxQueue: 10,
  cloudVoice: 'th-TH-Neural2-C',
};

/** เสียงไทยของ Google ที่เลือกได้ */
export const CLOUD_VOICES: [string, string][] = [
  ['th-TH-Neural2-C', 'หญิง — ธรรมชาติ (Neural2)'],
  ['th-TH-Chirp3-HD-Achernar', 'หญิง — HD ใส ๆ'],
  ['th-TH-Chirp3-HD-Kore', 'หญิง — HD นุ่ม'],
  ['th-TH-Chirp3-HD-Puck', 'ชาย — HD สดใส'],
  ['th-TH-Chirp3-HD-Charon', 'ชาย — HD ทุ้ม'],
  ['th-TH-Standard-A', 'หญิง — มาตรฐาน'],
];

// เซิร์ฟเวอร์เปิดเสียง Google ไว้ไหม (เช็กครั้งเดียว)
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';
let cloud: boolean | null = null;
export const cloudReady = (): Promise<boolean> => (cloud !== null ? Promise.resolve(cloud) : fetch(`${API_BASE}/api/tts/status`).then((r) => r.json()).then((s: { enabled?: boolean }) => (cloud = !!s.enabled)).catch(() => (cloud = false)));
export const cloudOn = () => cloud === true;

export const withDefaults = (c: Partial<TtsCfg> | null | undefined): TtsCfg => ({ ...TTS_DEF, ...(c ?? {}) });

export interface TtsEvent { type: string; user?: { uniqueId?: string; nickname?: string }; comment?: string; giftName?: string; repeatCount?: number; value?: number }

const tmpl = (s: string, map: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k: string) => map[k] ?? '');

/** ทำข้อความให้อ่านลื่น: ตัดอีโมจิ/ลิงก์ · 555555 → ฮ่า ๆ · ตัวอักษรซ้ำยาว ๆ ให้สั้นลง */
export function clean(s: string, cfg: TtsCfg): string {
  let t = String(s ?? '');
  if (cfg.skipLinks) t = t.replace(/https?:\/\/\S+|www\.\S+/gi, '');
  t = t.replace(/\p{Extended_Pictographic}|️|‍/gu, '')
    .replace(/5{3,}/g, ' ฮ่า ๆ ')
    .replace(/(.)\1{3,}/gu, '$1$1$1')
    .replace(/\s+/g, ' ').trim();
  return t.slice(0, cfg.maxLen);
}

const lastByUser = new Map<string, number>();

/** อีเวนต์ → ประโยคที่จะอ่าน (null = ไม่อ่าน) */
export function lineFor(e: TtsEvent, cfg: TtsCfg): string | null {
  const name = clean(e.user?.nickname || e.user?.uniqueId || '', { ...cfg, maxLen: 30 }) || 'ใครบางคน';
  if (e.type === 'chat') {
    if (!cfg.readChat) return null;
    let text = e.comment ?? '';
    if (cfg.chatMode === 'prefix') { const p = cfg.prefix.trim(); if (!p || !text.startsWith(p)) return null; text = text.slice(p.length); }
    const bad = cfg.blocked.split(',').map((w) => w.trim().toLowerCase()).filter(Boolean);
    if (bad.some((w) => text.toLowerCase().includes(w))) return null;
    text = clean(text, cfg);
    if (!text) return null;
    const who = e.user?.uniqueId ?? name, now = Date.now();
    if (cfg.userCooldown > 0 && now - (lastByUser.get(who) ?? 0) < cfg.userCooldown * 1000) return null;
    lastByUser.set(who, now);
    return tmpl(cfg.tmplChat, { name, text });
  }
  if (e.type === 'gift') {
    if (!cfg.readGift || (e.value ?? 0) < cfg.minGift) return null;
    return tmpl(cfg.tmplGift, { name, gift: e.giftName || 'ของขวัญ', count: String(e.repeatCount ?? 1) });
  }
  if (e.type === 'follow') return cfg.readFollow ? tmpl(cfg.tmplFollow, { name }) : null;
  if (e.type === 'share') return cfg.readShare ? tmpl(cfg.tmplShare, { name }) : null;
  return null;
}

// ---------- เสียง (ต่อเครื่อง) ----------
const VOICE_KEY = 'vjl-tts-voice', HERE_KEY = 'vjl-tts-here';
const ls = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };
export const getVoiceName = () => ls.get(VOICE_KEY) ?? '';
export const setVoiceName = (v: string) => ls.set(VOICE_KEY, v);
/** อ่านที่เครื่องนี้ไหม (ค่าเริ่มต้น เปิด) — ปิดในมือถือ/เครื่องที่ไม่ได้ไลฟ์ */
export const getHere = () => ls.get(HERE_KEY) !== '0';
export const setHere = (v: boolean) => ls.set(HERE_KEY, v ? '1' : '0');

export function voices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  const all = speechSynthesis.getVoices();
  const th = all.filter((v) => v.lang.toLowerCase().startsWith('th'));
  return [...th, ...all.filter((v) => !th.includes(v))];
}
export const hasThaiVoice = () => voices().some((v) => v.lang.toLowerCase().startsWith('th'));
function pickVoice(): SpeechSynthesisVoice | null {
  const vs = voices(), want = getVoiceName();
  return vs.find((v) => v.name === want)
    ?? vs.find((v) => /th/i.test(v.lang) && /natural|online|premwadee/i.test(v.name)) // เสียงธรรมชาติก่อน
    ?? vs.find((v) => /th/i.test(v.lang)) ?? null;
}

// ---------- คิวพูด ----------
const queue: string[] = [];
let speaking = false;
const listeners = new Set<(text: string) => void>();
export const onSay = (fn: (text: string) => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

let cur: TtsCfg = TTS_DEF;
export const setCfg = (c: TtsCfg) => { cur = c; void cloudReady(); };
export const getCfg = () => cur;

const player = typeof Audio === 'undefined' ? null : new Audio();
function next() {
  if (speaking || !queue.length || typeof window === 'undefined') return;
  const text = queue.shift()!;
  speaking = true;
  listeners.forEach((f) => f(text));
  if (cloud && cur.cloudVoice !== 'browser' && player && text.trim()) return void speakCloud(text);
  speakBrowser(text);
}
/** เสียงจากเซิร์ฟเวอร์ (mp3) — ล้มเหลว → ใช้เสียงในเครื่องแทน */
async function speakCloud(text: string) {
  let url = '';
  const done = () => { if (url) URL.revokeObjectURL(url); speaking = false; next(); };
  try {
    const r = await fetch(`${API_BASE}/api/tts/say`, { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${getToken() ?? ''}` },
      body: JSON.stringify({ text, voice: cur.cloudVoice, rate: cur.rate, pitch: Math.round((cur.pitch - 1) * 20) }) });
    if (!r.ok) throw new Error(String(r.status));
    url = URL.createObjectURL(await r.blob());
    player!.src = url; player!.volume = cur.volume; player!.onended = done; player!.onerror = done;
    await player!.play();
  } catch { if (url) URL.revokeObjectURL(url); speakBrowser(text); }
}
function speakBrowser(text: string) {
  if (!window.speechSynthesis) { speaking = false; return next(); }
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice();
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'th-TH';
  u.rate = cur.rate; u.pitch = cur.pitch; u.volume = cur.volume;
  let ended = false;
  const done = () => { if (ended) return; ended = true; speaking = false; clearTimeout(guard); next(); };
  u.onend = done; u.onerror = done;
  const guard = setTimeout(done, 4000 + text.length * 250); // บางเครื่อง onend ไม่ยิง → กันคิวค้าง
  speechSynthesis.speak(u);
}

/** พูด (เข้าคิว) — force = ปุ่มทดลอง ข้ามคิว */
export function say(text: string, force = false) {
  if (!text) return;
  if (force) { stop(); }
  queue.push(text);
  if (queue.length > cur.maxQueue) queue.splice(0, queue.length - cur.maxQueue); // คนแชทเยอะ → ทิ้งข้อความเก่า
  next();
}
export function stop() { queue.length = 0; speaking = false; try { player?.pause(); speechSynthesis.cancel(); } catch { /* ignore */ } }
export const queued = () => queue.length;

// ---------- แท็บหลัก: เปิดหลายแท็บ อ่านแท็บเดียว ----------
const LEAD_KEY = 'vjl-tts-lead';
const tabId = () => (typeof window === 'undefined' ? '' : ((window as unknown as { __vjlTab?: string }).__vjlTab ??= Math.random().toString(36).slice(2, 10)));
/** เรียกถี่ ๆ (ทุก 3 วิ) — คืน true ถ้าแท็บนี้เป็นตัวอ่าน */
export function claimLead(): boolean {
  const me = tabId(), now = Date.now();
  let lead: { tab?: string; ts?: number } = {};
  try { lead = JSON.parse(ls.get(LEAD_KEY) ?? '{}'); } catch { /* ignore */ }
  if (!lead.tab || lead.tab === me || now - (lead.ts ?? 0) > 8000) { ls.set(LEAD_KEY, JSON.stringify({ tab: me, ts: now })); return true; }
  return false;
}
export function releaseLead() {
  try { const lead = JSON.parse(ls.get(LEAD_KEY) ?? '{}'); if (lead.tab === tabId()) localStorage.removeItem(LEAD_KEY); } catch { /* ignore */ }
}
