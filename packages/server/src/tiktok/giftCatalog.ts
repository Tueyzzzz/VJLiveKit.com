import fs from 'node:fs';
import path from 'node:path';

/**
 * คลังของขวัญ (ชื่อ · รูป · ราคา) — เก็บจากของขวัญจริงที่ส่งในไลฟ์ของทุกคน ใช้ทำดรอปดาวน์เลือกกิฟต์ใน Dashboard
 * เริ่มต้นมีของขวัญยอดนิยม (ยังไม่มีรูป จนกว่าจะมีคนส่งจริงครั้งแรก)
 */
export interface GiftInfo { name: string; id?: number; image?: string; diamonds: number; seen: number }

const FILE = path.join(process.env.SNAPSHOT_DIR ? path.dirname(process.env.SNAPSHOT_DIR) : path.resolve(process.cwd(), '../../data'), 'gifts.json');
const SEED: [string, number][] = [
  ['Rose', 1], ['TikTok', 1], ['GG', 1], ['Ice Cream Cone', 1], ['Heart Me', 1], ['Finger Heart', 5], ['Rosa', 10],
  ['Perfume', 20], ['Doughnut', 30], ['Paper Crane', 99], ['Hand Hearts', 100], ['Confetti', 100], ['Corgi', 299],
  ['Money Gun', 500], ['Swan', 699], ['Train', 899], ['Galaxy', 1000], ['Fireworks', 1088], ['Sports Car', 7000],
  ['Interstellar', 10000], ['Falcon', 10999], ['Lion', 29999], ['Universe', 34999], ['TikTok Universe', 44999],
];

const gifts = new Map<string, GiftInfo>();
for (const [name, diamonds] of SEED) gifts.set(name.toLowerCase(), { name, diamonds, seen: 0 });
try {
  const saved = JSON.parse(fs.readFileSync(FILE, 'utf8')) as GiftInfo[];
  for (const g of saved) gifts.set(g.name.toLowerCase(), g);
} catch { /* ยังไม่มีไฟล์ */ }

let dirty = false;
setInterval(() => {
  if (!dirty) return; dirty = false;
  fs.promises.mkdir(path.dirname(FILE), { recursive: true })
    .then(() => fs.promises.writeFile(FILE, JSON.stringify([...gifts.values()])))
    .catch((err) => console.error('[gifts] save failed', err));
}, 30_000).unref();

/** บันทึกของขวัญที่เพิ่งเห็นในไลฟ์ */
export function recordGift(name: string, id: number | undefined, image: string | undefined, diamonds: number): void {
  if (!name) return;
  const key = name.toLowerCase(), cur = gifts.get(key);
  const img = image && /^https:\/\//.test(image) ? image : undefined;
  if (cur) {
    cur.seen++;
    if (img && cur.image !== img) { cur.image = img; dirty = true; }
    if (diamonds > 0 && cur.diamonds !== diamonds) { cur.diamonds = diamonds; dirty = true; }
    if (id && !cur.id) { cur.id = id; dirty = true; }
    if (cur.seen % 20 === 1) dirty = true;
  } else {
    gifts.set(key, { name, id, image: img, diamonds, seen: 1 }); dirty = true;
  }
}

/**
 * ดึงรายการของขวัญทั้งหมด (ชื่อ · รูปจริง · ราคา) จาก TikTok ผ่านห้องไลฟ์ที่เพิ่งเชื่อมต่อ
 * ทำไม่เกินทุก 6 ชม. — ทำให้ดรอปดาวน์มีของขวัญครบพร้อมรูป โดยไม่ต้องรอให้มีคนส่งจริงก่อน
 */
let lastFetch = 0;
export function refreshFromRoom(fetchGifts: () => Promise<unknown>): void {
  if (Date.now() - lastFetch < 6 * 3_600_000) return;
  lastFetch = Date.now();
  fetchGifts().then((list) => {
    if (!Array.isArray(list)) return;
    let n = 0;
    for (const raw of list as Record<string, unknown>[]) {
      const g = raw as { name?: string; id?: number; diamond_count?: number; diamondCount?: number; image?: { url_list?: string[]; urlList?: string[] }; icon?: { url_list?: string[]; urlList?: string[] } };
      const diamonds = Number(g.diamond_count ?? g.diamondCount ?? 0);
      const img = g.image?.url_list?.[0] ?? g.image?.urlList?.[0] ?? g.icon?.url_list?.[0] ?? g.icon?.urlList?.[0];
      if (!g.name || diamonds <= 0) continue;
      const key = g.name.toLowerCase(), cur = gifts.get(key);
      const image = img && /^https:\/\//.test(img) ? img : cur?.image;
      gifts.set(key, { name: cur?.name ?? g.name, id: g.id ?? cur?.id, image, diamonds, seen: cur?.seen ?? 0 });
      n++;
    }
    if (n) { dirty = true; console.log(`[gifts] catalog refreshed: ${n} gifts`); }
  }).catch((err) => { lastFetch = Date.now() - 5.5 * 3_600_000; console.warn('[gifts] fetch list failed', (err as Error)?.message); }); // พลาด → ลองใหม่ในอีก ~30 นาที
}

/** รายการทั้งหมด เรียงตามราคา */
export function listGifts(): GiftInfo[] {
  return [...gifts.values()].sort((a, b) => a.diamonds - b.diamonds || a.name.localeCompare(b.name));
}
