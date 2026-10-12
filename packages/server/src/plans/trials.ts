import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../db/prisma.js';
import { settings } from '../settings/index.js';

/**
 * ทดลองฟรีนับ "ต่อ TikTok ID" ไม่ใช่ต่อบัญชี — สมัครบัญชีใหม่แต่ใช้ TikTok เดิม ได้แค่วันที่เหลือของ TikTok นั้น
 * เก็บใน data/trials.json: { "<tiktok ตัวเล็ก ไม่มี @>": { firstAt: ISO } }
 * firstAt = วันแรกที่ TikTok นี้เริ่มใช้ทดลอง (= วันสมัครของบัญชีแรกที่ผูก TikTok นี้)
 */
const DAY = 86_400_000;
const FILE = path.join(process.env.SNAPSHOT_DIR ? path.dirname(process.env.SNAPSHOT_DIR) : path.resolve(process.cwd(), '../../data'), 'trials.json');
interface TrialRec { firstAt: string }
let history: Record<string, TrialRec> = {};
try { history = JSON.parse(fs.readFileSync(FILE, 'utf8')) as Record<string, TrialRec>; } catch { /* ยังไม่มีไฟล์ */ }
const save = () => { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(history)); } catch { /* เขียนไม่ได้ก็ยังใช้ค่าในหน่วยความจำ */ } };

export const normTiktok = (t: string | null | undefined): string => (t ?? '').trim().replace(/^@/, '').toLowerCase();

/** บันทึก/ดึงวันเริ่มทดลองของ TikTok นี้ (เก็บวันที่เก่าสุดเสมอ) */
function firstStartOf(tiktok: string, accountCreatedAt: Date): Date {
  const rec = history[tiktok];
  const t = rec ? new Date(rec.firstAt).getTime() : NaN;
  if (!Number.isFinite(t) || accountCreatedAt.getTime() < t) {
    history[tiktok] = { firstAt: accountCreatedAt.toISOString() };
    save();
    return accountCreatedAt;
  }
  return new Date(t);
}

/** วันเริ่มนับทดลองของผู้ใช้: มี TikTok = วันแรกของ TikTok นั้น · ยังไม่ผูก = วันสมัครบัญชี */
export function trialStartOf(createdAt: Date, tiktokUsername?: string | null): Date {
  const tk = normTiktok(tiktokUsername);
  return tk ? firstStartOf(tk, createdAt) : createdAt;
}

/** วันหมดช่วงทดลอง (จำนวนวันแอดมินปรับได้ที่หน้าตั้งค่าระบบ) */
export function trialEndOf(createdAt: Date, tiktokUsername?: string | null): Date {
  return new Date(trialStartOf(createdAt, tiktokUsername).getTime() + settings().trialDays * DAY);
}

/** สรุปการใช้ทดลองของ TikTok (แสดงในหน้า billing / admin) */
export function trialInfo(createdAt: Date, tiktokUsername?: string | null): { tiktok: string | null; startedAt: string; usedDays: number; totalDays: number; leftDays: number } {
  const start = trialStartOf(createdAt, tiktokUsername).getTime(), total = settings().trialDays;
  const used = Math.min(total, Math.max(0, Math.floor((Date.now() - start) / DAY)));
  const left = Math.max(0, Math.ceil((start + total * DAY - Date.now()) / DAY));
  return { tiktok: normTiktok(tiktokUsername) || null, startedAt: new Date(start).toISOString(), usedDays: used, totalDays: total, leftDays: left };
}

/** ตอนสตาร์ท: เติมประวัติจากผู้ใช้เดิม (วันสมัครที่เก่าสุดต่อ TikTok) — ไม่ลดวันของใครที่มี TikTok ไม่ซ้ำ */
export async function seedTrialHistory(): Promise<void> {
  const rows = await prisma.user.findMany({ where: { tiktokUsername: { not: null } }, select: { tiktokUsername: true, createdAt: true } });
  let changed = false;
  for (const r of rows) {
    const tk = normTiktok(r.tiktokUsername);
    if (!tk) continue;
    const cur = history[tk] ? new Date(history[tk]!.firstAt).getTime() : Infinity;
    if (r.createdAt.getTime() < cur) { history[tk] = { firstAt: r.createdAt.toISOString() }; changed = true; }
  }
  if (changed) save();
}
