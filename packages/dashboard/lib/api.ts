/** ตัวช่วยเรียก API ของ @vjlivekit/server (same-origin ใน production) */

import { translate } from './i18n';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';
const TOKEN_KEY = 'vjl_token';

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token: string | null, remember = true): void {
  try {
    localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY);
    if (token) (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
  } catch { /* storage ถูกบล็อก */ }
}

/** ข้อความ error จากเซิร์ฟเวอร์ที่มีตัวเลข/ชื่อแพลนอยู่ข้างใน → แปลงเป็นคีย์คงที่ก่อนแปล */
const ERR_PATTERNS: [RegExp, string, string[]][] = [
  [/^แพลน (\S+) สร้างกฎได้สูงสุด (\d+) ข้อ — อัปเกรดเป็น Pro เพื่อเพิ่ม$/, 'แพลน {plan} สร้างกฎได้สูงสุด {n} ข้อ — อัปเกรดเป็น Pro เพื่อเพิ่ม', ['plan', 'n']],
  [/^แพลน (\S+) สร้างลิงก์ได้สูงสุด (\d+) ชุด — ลบอันเก่าหรืออัปเกรด$/, 'แพลน {plan} สร้างลิงก์ได้สูงสุด {n} ชุด — ลบอันเก่าหรืออัปเกรด', ['plan', 'n']],
  [/^ไฟล์ใหญ่เกิน ([\d.]+)MB — ตัดให้สั้นลง หรือแปลงเป็น mp3$/, 'ไฟล์ใหญ่เกิน {n}MB — ตัดให้สั้นลง หรือแปลงเป็น mp3', ['n']],
  [/^อัปโหลดได้สูงสุด (\d+) ไฟล์ — ลบไฟล์เก่าก่อน$/, 'อัปโหลดได้สูงสุด {n} ไฟล์ — ลบไฟล์เก่าก่อน', ['n']],
  [/^โดเนทขั้นต่ำ ([\d.,]+) บาท$/, 'โดเนทขั้นต่ำ {n} บาท', ['n']],
];
function translateError(msg: string): string {
  for (const [re, key, names] of ERR_PATTERNS) {
    const m = msg.match(re);
    if (m) return translate(key, Object.fromEntries(names.map((n, i) => [n, m[i + 1]])));
  }
  return translate(msg);
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly data: Record<string, unknown> = {}) { super(message); }
  get upgrade(): boolean { return this.data.upgrade === true; }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(translate('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'), 0);
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    if (res.status === 401 && token) setToken(null);
    throw new ApiError(typeof data.error === 'string' ? translateError(data.error) : translate('เกิดข้อผิดพลาด ({status})', { status: res.status }), res.status, data);
  }
  return data as T;
}

// ---------- ชนิดข้อมูลจาก API ----------
export interface Entitlements {
  plan: string;
  widgets: string[];
  maxActionRules: number;
  maxTokens: number;
  noWatermark: boolean;
  /** อยู่ในช่วงทดลองฟรีเดือนแรก (plan = "trial") */
  trialEndsAt?: string;
}

/** จำนวนวันที่เหลือของช่วงทดลองฟรี (ไม่อยู่ในช่วงทดลอง = null) */
export function trialDaysLeft(e: Entitlements | null | undefined): number | null {
  if (!e?.trialEndsAt) return null;
  return Math.max(0, Math.ceil((new Date(e.trialEndsAt).getTime() - Date.now()) / 86_400_000));
}
/** ป้ายแพลนสั้น ๆ */
export function planLabel(e: Entitlements | null | undefined): string {
  if (e?.plan === 'pro') return 'Pro';
  const d = trialDaysLeft(e);
  return d !== null ? translate('ทดลองฟรี · เหลือ {n} วัน', { n: d }) : 'Free';
}
export interface Me {
  id: string;
  email: string;
  displayName: string | null;
  tiktokUsername: string | null;
  role: string;
  createdAt: string;
  subscription: {
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    provider: string | null;
    plan: { code: string; name: string };
  } | null;
}
export interface WidgetUrl { type: string; url: string; locked: boolean }
export interface OverlayTokenRow { id: string; label: string | null; createdAt: string; urls: WidgetUrl[] }
export interface Plan { code: string; name: string; priceCents: number; currency: string; features: Omit<Entitlements, 'plan'> }

export type TriggerEvent = 'gift' | 'follow' | 'share' | 'like' | 'chat';
export type ActionType = 'sound' | 'image' | 'video' | 'text' | 'tarot' | 'effect' | 'sign' | 'glove';
export type TarotTopic = 'general' | 'love' | 'self' | 'money';
export type TarotDeck = 'full' | 'major' | 'wands' | 'cups' | 'swords' | 'pentacles';
export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: { event: TriggerEvent; giftName?: string; minDiamonds?: number; keyword?: string };
  action: { type: ActionType; url?: string; sound?: string; text?: string; durationMs?: number; cards?: number; deck?: TarotDeck; topic?: TarotTopic; effect?: 'butterflies'; count?: number; repeat?: number; volume?: number; key?: string; signStyle?: 'led' | 'neon' | 'bulb' | 'cute' | 'pixel' | 'y2k' | 'glass' | 'surreal' | 'boho' | 'victorian' | 'graffiti' | 'future'; signMode?: 'scroll' | 'static' | 'blink' | 'pulse'; signPos?: 'top' | 'center' | 'bottom'; color?: string };
  createdAt: string;
}
export interface PaymentRow { id: string; amountCents: number; currency: string; status: string; createdAt: string; rawPayload: { hosted_invoice_url?: string; number?: string } | null }

export function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(cents / 100);
  } catch {
    return `${(cents / 100).toLocaleString()} ${currency.toUpperCase()}`;
  }
}
