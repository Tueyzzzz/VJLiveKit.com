import fs from 'node:fs';
import path from 'node:path';
import type { TikTokEvent } from './types.js';

/**
 * กองของขวัญสะสม (ถาวร) ต่อชื่อ TikTok — บันทึกลงดิสก์ทุกชิ้น
 * เดิมจำแค่ในเครื่องที่เปิดวิดเจ็ต + ในหน่วยความจำของห้อง (ล้างทุกครั้งที่ต่อ TikTok ใหม่) → ปิดเว็บนาน ๆ / เปลี่ยนเครื่อง / โปรแกรมไลฟ์ไม่จำ = ของหาย
 * ตอนนี้วิดเจ็ตเปิดใหม่เมื่อไหร่ก็ดึงกองนี้กลับมาได้ครบ (กด "ล้าง" ในแดชบอร์ด = วิดเจ็ตกรองของก่อน resetAt ทิ้งเอง)
 * ช่วง deploy มีสองโปรเซสเขียนพร้อมกันได้ → ตอนบันทึกอ่านไฟล์มารวมก่อนเสมอ (ไม่ทับของอีกฝั่ง)
 */
const DIR = path.join(process.env.SNAPSHOT_DIR ? path.dirname(process.env.SNAPSHOT_DIR) : path.resolve(process.cwd(), '../../data'), 'collect');
const CAP = 1500;
const mem = new Map<string, TikTokEvent[]>();
const dirty = new Set<string>();
let timer: NodeJS.Timeout | null = null;

const fileOf = (u: string) => path.join(DIR, u.replace(/[^\w.-]/g, '_').slice(0, 64) + '.json');
const keyOf = (e: TikTokEvent) => [e.ts ?? '', e.user?.uniqueId || e.user?.nickname || '', e.giftId ?? e.giftName ?? '', e.repeatCount ?? 1].join('|');
const norm = (u: string) => u.trim().toLowerCase().replace(/^@/, '');

function readFile(u: string): TikTokEvent[] {
  try { const v = JSON.parse(fs.readFileSync(fileOf(u), 'utf8')); return Array.isArray(v) ? v : []; } catch { return []; }
}
function merge(a: TikTokEvent[], b: TikTokEvent[]): TikTokEvent[] {
  const seen = new Set<string>(), out: TikTokEvent[] = [];
  for (const e of [...a, ...b]) { const k = keyOf(e); if (!seen.has(k)) { seen.add(k); out.push(e); } }
  return out.sort((x, y) => (x.ts ?? 0) - (y.ts ?? 0)).slice(-CAP);
}
function load(u: string): TikTokEvent[] {
  let list = mem.get(u);
  if (!list) { list = readFile(u); mem.set(u, list); }
  return list;
}

export function flushCollect(): void {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!dirty.size) return;
  try { fs.mkdirSync(DIR, { recursive: true }); } catch { /* ignore */ }
  for (const u of dirty) {
    try {
      const list = merge(readFile(u), mem.get(u) ?? []);
      mem.set(u, list);
      const f = fileOf(u), tmp = f + '.' + process.pid + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(list)); fs.renameSync(tmp, f);
    } catch (err) { console.error('[collect] save failed', u, err); }
  }
  dirty.clear();
}

/** บันทึกของขวัญ 1 ครั้ง (คอมโบจบแล้ว) */
export function recordCollect(username: string, ev: TikTokEvent): void {
  const u = norm(username); if (!u) return;
  const list = load(u);
  list.push(ev); if (list.length > CAP) list.splice(0, list.length - CAP);
  dirty.add(u);
  if (!timer) timer = setTimeout(flushCollect, 1500);
}

/** กองของขวัญทั้งหมดของชื่อนี้ (เก่า → ใหม่) รวมกับของในห้องตอนนี้ ไม่ซ้ำ */
export function collectFor(username: string, live: TikTokEvent[] = []): TikTokEvent[] {
  const u = norm(username); if (!u) return live;
  const list = merge(merge(readFile(u), load(u)), live); // อ่านไฟล์ใหม่ทุกครั้ง: ช่วง deploy อีกโปรเซสอาจเพิ่งบันทึกของเพิ่ม
  mem.set(u, list);
  return list;
}
