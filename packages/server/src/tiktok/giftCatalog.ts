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

/** รายการทั้งหมด เรียงตามราคา */
export function listGifts(): GiftInfo[] {
  return [...gifts.values()].sort((a, b) => a.diamonds - b.diamonds || a.name.localeCompare(b.name));
}
