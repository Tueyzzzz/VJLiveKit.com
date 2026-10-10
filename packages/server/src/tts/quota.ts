import fs from 'node:fs';
import path from 'node:path';

/**
 * คุมโควตาฟรีรายเดือนของ Google Cloud TTS — ไม่ให้เกินจนเสียเงิน
 * นับเฉพาะตัวอักษรที่ส่งไป Google จริง (ข้อความในแคชไม่นับ) · ใช้ได้ 90% ของโควตาฟรี เผื่อเดือนของ Google (เวลาแปซิฟิก) ต่างจากเรา
 *  - เสียงพรีเมียม (Neural2 / WaveNet / Chirp HD) เต็ม → สลับเป็นเสียงมาตรฐานเอง
 *  - เสียงมาตรฐานเต็ม → ปิดเสียง Google เดือนนั้น (หน้าเว็บ/overlay ถอยไปใช้เสียงในเครื่องเอง)
 * เก็บใน data/tts-usage.json (อ่านก่อนเขียนทุกครั้ง — ช่วง deploy มีแอป 2 ตัวพร้อมกัน ตัวเลขไม่ทับกัน)
 */
type Tier = 'std' | 'neural' | 'hd';
const FREE: Record<Tier, number> = { std: 4_000_000, neural: 1_000_000, hd: 1_000_000 };
const SAFE = 0.9;
export const FALLBACK_VOICE = 'th-TH-Standard-A';

const DIR = process.env.SNAPSHOT_DIR ? path.dirname(process.env.SNAPSHOT_DIR) : path.resolve(process.cwd(), '../../data');
const FILE = path.join(DIR, 'tts-usage.json');

const tierOf = (voice: string): Tier => (/Chirp|Studio|Journey/i.test(voice) ? 'hd' : /Neural2|Wavenet|Polyglot|News/i.test(voice) ? 'neural' : 'std');
const month = () => new Date().toISOString().slice(0, 7);

type Usage = { month: string; std: number; neural: number; hd: number };
function load(): Usage {
  try {
    const u = JSON.parse(fs.readFileSync(FILE, 'utf8')) as Usage;
    if (u.month === month()) return { month: u.month, std: u.std || 0, neural: u.neural || 0, hd: u.hd || 0 };
  } catch { /* ยังไม่มีไฟล์ */ }
  return { month: month(), std: 0, neural: 0, hd: 0 };
}
const room = (u: Usage, t: Tier, chars: number) => u[t] + chars <= FREE[t] * SAFE;

/** เลือกเสียงที่ยังอยู่ในโควตาฟรี — null = เต็มทุกแบบแล้ว (ให้ client ใช้เสียงในเครื่อง) */
export function pickVoice(voice: string, chars: number): string | null {
  const u = load();
  if (room(u, tierOf(voice), chars)) return voice;
  if (room(u, 'std', chars)) return voice.startsWith('th-') ? FALLBACK_VOICE : voice.split('-').slice(0, 2).join('-') + '-Standard-A';
  return null;
}

/** บันทึกตัวอักษรที่ส่งไป Google จริง */
export function record(voice: string, chars: number): void {
  const u = load();
  u[tierOf(voice)] += chars;
  try { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(u)); } catch { /* ignore */ }
}

/** ยังมีโควตาเสียงมาตรฐานเหลือไหม (หน้า status) */
export const hasQuota = (): boolean => room(load(), 'std', 1);

export function usage() {
  const u = load();
  return (['std', 'neural', 'hd'] as Tier[]).map((t) => ({ tier: t, used: u[t], free: FREE[t], limit: Math.floor(FREE[t] * SAFE), pct: Math.round((u[t] / (FREE[t] * SAFE)) * 100) }));
}
