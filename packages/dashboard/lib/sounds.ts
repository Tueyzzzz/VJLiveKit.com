/** เสียงที่ใช้ร่วมกัน: เสียงสำเร็จรูป (overlay/js/sfx.js) + ไฟล์ที่อัปโหลด — เล่นในเบราว์เซอร์ของวีเจ */

import { translate } from './i18n';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

/** ชื่อแสดงเป็นภาษาไทย — แปลตอนแสดงผลด้วย t(name) */
export const SFX: [string, string][] = [['chime', '🔔 กริ๊ง'], ['coin', '🪙 เหรียญ'], ['levelup', '⬆️ เลเวลอัป'], ['fanfare', '🎺 ฟันแฟร์'], ['magic', '✨ เวทมนตร์'], ['pop', '🫧 ป๊อป'], ['whoosh', '💨 วู้ช'], ['drum', '🥁 ตึ่งโป๊ะ'], ['boing', '🌀 ดึ๋ง'], ['heart', '💗 หัวใจ'], ['applause', '👏 ปรบมือ'], ['punch', '🥊 ต่อยน่ารัก'], ['boom', '💥 บูม! (Boom)'], ['airhorn', '📯 แตรลม (Airhorn)'], ['sadtrombone', '🎺 แป่วว (Sad trombone)'], ['crickets', '🦗 จิ้งหรีด (เงียบกริบ)'], ['scratch', '💿 ขูดแผ่น (Record scratch)'], ['bonk', '🔨 โป๊ก! (Bonk)'], ['correct', '✅ ติ๊งต่อง (ถูกต้อง)'], ['wrong', '❌ บิ๊บ (ผิด!)'], ['drumroll', '🥁 ตีกลองรัว'], ['suspense', '😱 ตึ่ง ตึ่ง ตึ๊ง (ลุ้น)'], ['tada', '🎉 ทาด๊า!'], ['pew', '🔫 ปิ้ว (เลเซอร์)'], ['kaching', '💰 กริ๊งเงิน (Ka-ching)'], ['slideup', '📈 หวีดขึ้น (Slide whistle)'], ['slidedown', '📉 หวีดลง (ร่วง)'], ['alarm', '🚨 ไซเรน']];
/** ความยาวโดยประมาณของเสียงสำเร็จรูป (ms) — ใช้ต่อคิว */
const SFX_MS: Record<string, number> = { chime: 900, coin: 500, levelup: 600, fanfare: 1800, magic: 1000, pop: 200, whoosh: 650, drum: 800, boing: 500, heart: 1000, applause: 1700, punch: 1000, boom: 1700, airhorn: 1300, sadtrombone: 2400, crickets: 2600, scratch: 500, bonk: 300, correct: 700, wrong: 600, drumroll: 2200, suspense: 2200, tada: 1200, pew: 300, kaching: 800, slideup: 700, slidedown: 900, alarm: 1300 };

export interface Upload { id: string; name: string; size: number; url: string }
export const readAsDataUrl = (f: File) => new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => bad(new Error(translate('อ่านไฟล์ไม่ได้'))); r.readAsDataURL(f); });

let sfxLoad: Promise<void> | null = null;
function loadSfx(): Promise<void> {
  return (sfxLoad ??= new Promise((ok, bad) => {
    const s = document.createElement('script'); s.src = `${API_BASE}/overlay/js/sfx.js`;
    s.onload = () => ok(); s.onerror = () => { sfxLoad = null; bad(new Error('sfx')); };
    document.head.appendChild(s);
  }));
}

/** เล่นเสียงหนึ่งครั้ง → resolve เมื่อเล่นจบ (ไว้ต่อคิว) */
export async function playSound(a: { sound?: string; url?: string; volume?: number }): Promise<void> {
  const vol = Math.max(0, Math.min(1.5, a.volume ?? 1));
  if (a.sound) {
    try { await loadSfx(); } catch { return; }
    (window as unknown as { VJLSfx?: { play: (id: string, v?: number) => boolean } }).VJLSfx?.play(a.sound, vol);
    await new Promise((r) => setTimeout(r, SFX_MS[a.sound!] ?? 800));
    return;
  }
  if (!a.url) return;
  await new Promise<void>((done) => {
    const au = new Audio(a.url); au.volume = Math.min(1, vol);
    const end = () => done(); au.onended = end; au.onerror = end;
    au.play().catch(end);
    setTimeout(end, 60_000); // กันไฟล์ยาวค้างคิว
  });
}

/** ตั้งค่าการเล่นเสียง (เก็บในเบราว์เซอร์เครื่องที่เปิดเว็บ เพราะเสียงดังที่เครื่องนี้) */
export interface SoundPrefs { simultaneous: boolean; maxQueue: number }
const PREF_KEY = 'vjl-sound-prefs';
export function getSoundPrefs(): SoundPrefs {
  try { return { simultaneous: false, maxQueue: 20, ...(JSON.parse(localStorage.getItem(PREF_KEY) || '{}') as Partial<SoundPrefs>) }; } catch { return { simultaneous: false, maxQueue: 20 }; }
}
export function setSoundPrefs(p: SoundPrefs): void { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* ignore */ } }

/** คิวเสียง: เล่นซ้อนกันได้ หรือเล่นทีละเสียงตามลำดับ (ไม่เกินความยาวคิวที่ตั้ง) */
const queue: (() => Promise<void>)[] = [];
let running = false;
export function enqueueSound(a: { sound?: string; url?: string; volume?: number }): void {
  const p = getSoundPrefs();
  if (p.simultaneous) { void playSound(a); return; }
  if (queue.length >= p.maxQueue) return;
  queue.push(() => playSound(a));
  if (running) return;
  running = true;
  void (async () => { while (queue.length) await queue.shift()!(); running = false; })();
}
