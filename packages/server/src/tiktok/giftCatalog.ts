import fs from 'node:fs';
import path from 'node:path';
import { GIFT_SEED } from './gift-seed.js';

/**
 * คลังของขวัญ (ชื่อ · รูป · ราคา) — เก็บจากของขวัญจริงที่ส่งในไลฟ์ของทุกคน ใช้ทำดรอปดาวน์เลือกกิฟต์ใน Dashboard
 * เริ่มต้นจากรายการของขวัญ TikTok ครบ ~640 ตัวพร้อมรูปจริง (gift-seed.ts) แล้วอัปเดตจากไลฟ์จริงเรื่อย ๆ
 */
export interface GiftInfo { name: string; id?: number; image?: string; diamonds: number; seen: number; th?: string }

const FILE = path.join(process.env.SNAPSHOT_DIR ? path.dirname(process.env.SNAPSHOT_DIR) : path.resolve(process.cwd(), '../../data'), 'gifts.json');

const gifts = new Map<string, GiftInfo>();
for (const g of GIFT_SEED) gifts.set(g.name.toLowerCase(), { ...g, seen: 0 });
try {
  const saved = JSON.parse(fs.readFileSync(FILE, 'utf8')) as GiftInfo[];
  // ข้อมูลที่เคยเห็นจากไลฟ์จริงทับค่าตั้งต้น (แต่เก็บชื่อไทย/รูปจาก seed ไว้ถ้าไฟล์เก่ายังไม่มี)
  for (const g of saved) { const k = g.name.toLowerCase(), s = gifts.get(k); gifts.set(k, { ...s, ...g, image: g.image ?? s?.image, th: g.th ?? s?.th }); }
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
  return [...gifts.values()].filter((g) => g.image || g.seen > 0).sort((a, b) => a.diamonds - b.diamonds || a.name.localeCompare(b.name));
}
