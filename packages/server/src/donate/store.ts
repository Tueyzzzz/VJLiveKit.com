import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * เก็บรายการโดเนทเป็นไฟล์ JSON ต่อผู้ใช้ (ในโฟลเดอร์ data เดียวกับ snapshot ไลฟ์ — volume ถาวร)
 * เงินโอนเข้าพร้อมเพย์ของวีเจโดยตรง ที่นี่เก็บแค่ประวัติ + สลิป (ไว้ให้วีเจตรวจเอง)
 */
const ROOT = path.join(process.env.SNAPSHOT_DIR ? path.dirname(process.env.SNAPSHOT_DIR) : path.resolve(process.cwd(), '../../data'), 'donations');
const SLIPS = path.join(ROOT, 'slips');
const REFS = path.join(ROOT, 'transrefs.json');

export type DonationStatus = 'pending' | 'verified' | 'rejected';
export interface Donation {
  id: string;
  name: string;
  message: string;
  amount: number;        // บาท (ยอดจริงจากสลิปถ้าตรวจอัตโนมัติ)
  status: DonationStatus;
  auto: boolean;         // ตรวจผ่าน EasySlip
  transRef?: string;
  note?: string;         // เหตุผลที่ตรวจไม่ผ่าน/รอตรวจ
  createdAt: string;
  hasSlip: boolean;
}

const fileOf = (userId: string) => path.join(ROOT, userId.replace(/[^a-zA-Z0-9_-]/g, '') + '.json');

function read(userId: string): Donation[] {
  try { return JSON.parse(fs.readFileSync(fileOf(userId), 'utf8')) as Donation[]; } catch { return []; }
}
function write(userId: string, list: Donation[]): void {
  fs.mkdirSync(ROOT, { recursive: true });
  const f = fileOf(userId), tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(list.slice(0, 2000)));
  fs.renameSync(tmp, f);
}

export function listDonations(userId: string): Donation[] { return read(userId); }

export function addDonation(userId: string, d: Omit<Donation, 'id' | 'createdAt' | 'hasSlip'>, slip?: Buffer): Donation {
  const item: Donation = { ...d, id: crypto.randomBytes(9).toString('base64url'), createdAt: new Date().toISOString(), hasSlip: !!slip };
  if (slip) { fs.mkdirSync(SLIPS, { recursive: true }); fs.writeFileSync(path.join(SLIPS, item.id + '.jpg'), slip); }
  write(userId, [item, ...read(userId)]);
  return item;
}

export function updateDonation(userId: string, id: string, patch: Partial<Donation>): Donation | null {
  const list = read(userId), i = list.findIndex((d) => d.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i]!, ...patch };
  write(userId, list);
  return list[i]!;
}

export function slipPath(id: string): string | null {
  const p = path.join(SLIPS, id.replace(/[^a-zA-Z0-9_-]/g, '') + '.jpg');
  return fs.existsSync(p) ? p : null;
}

/** กันสลิปเดิมส่งซ้ำ (เลขอ้างอิงธุรกรรมจากสลิป) */
let refs: Set<string> | null = null;
function loadRefs(): Set<string> {
  if (!refs) { try { refs = new Set(JSON.parse(fs.readFileSync(REFS, 'utf8')) as string[]); } catch { refs = new Set(); } }
  return refs;
}
export function isUsedRef(ref: string): boolean { return loadRefs().has(ref); }
export function markRef(ref: string): void {
  const s = loadRefs(); s.add(ref);
  fs.mkdirSync(ROOT, { recursive: true });
  fs.writeFileSync(REFS, JSON.stringify([...s].slice(-50000)));
}
