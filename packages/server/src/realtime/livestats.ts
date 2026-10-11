import fs from 'node:fs';
import path from 'node:path';
import type { TikTokEvent } from '../tiktok/types.js';

/**
 * สถิติไลฟ์รายนาที (หน้า "สถิติไลฟ์" ของสตรีมเมอร์) — นับแบบ passive จากอีเวนต์ที่ห้องส่งออกมาแล้ว ไม่แตะเส้นทางของขวัญ
 * 1 ไฟล์ต่อ 1 ไลฟ์: data/livestats/<roomId>.json · เขียนแบบรวมของเดิม (merge) + rename ทับ — ช่วง deploy ที่มี 2 เซิร์ฟเวอร์พร้อมกันจะไม่ทับกันหาย
 */
export const LIVESTATS_DIR = path.join(process.env.SNAPSHOT_DIR ? path.dirname(process.env.SNAPSHOT_DIR) : path.resolve(process.cwd(), '../../data'), 'livestats');
const MAX_SAMPLES = 720;
const MINUTE = 60_000;
const IDLE_MS = 3 * MINUTE; // ไม่มีอีเวนต์เลย 3 นาที = ถือว่าไม่ได้ต่ออยู่ (หยุดเก็บตัวอย่าง)

export interface LiveSample { t: number; viewers: number; likes: number; diamonds: number; joins: number; follows: number; shares: number; chats: number; giftsCount: number }
export interface LiveTotals { uniqueJoiners: number; follows: number; shares: number; chats: number }
export interface LiveStatsFile { roomId: string; username: string; samples: LiveSample[]; totals: LiveTotals }

interface Cur { viewers: number; likes: number; diamonds: number }
interface Active {
  roomId: string; username: string; lastEventAt: number;
  cur: Cur; // ค่าสะสมล่าสุดของห้อง (คนดู/ไลค์/เพชร)
  minute: { joins: number; follows: number; shares: number; chats: number; giftsCount: number };
  joiners: Set<string>; // ในหน่วยความจำเท่านั้น
  base: LiveTotals; // ยอดจากไฟล์ตอนเริ่มเห็นไลฟ์นี้ในโปรเซสนี้ (ต่อจากรีสตาร์ท)
  counts: { follows: number; shares: number; chats: number };
  pending: LiveSample[]; // ตัวอย่างที่ยังไม่ลงดิสก์
  dirty: boolean;
}

const active = new Map<string, Active>();
const safeId = (roomId: string): string => roomId.replace(/[^0-9A-Za-z_-]/g, '');
const fileOf = (roomId: string): string => path.join(LIVESTATS_DIR, `${safeId(roomId)}.json`);
const emptyTotals = (): LiveTotals => ({ uniqueJoiners: 0, follows: 0, shares: 0, chats: 0 });

export function readLiveStats(roomId: string): LiveStatsFile | null {
  if (!safeId(roomId)) return null;
  try { return JSON.parse(fs.readFileSync(fileOf(roomId), 'utf8')) as LiveStatsFile; } catch { return null; }
}

function getActive(roomId: string, username: string): Active {
  let a = active.get(roomId);
  if (!a) {
    const prev = readLiveStats(roomId);
    a = {
      roomId, username, lastEventAt: Date.now(), cur: { viewers: 0, likes: 0, diamonds: 0 },
      minute: { joins: 0, follows: 0, shares: 0, chats: 0, giftsCount: 0 }, joiners: new Set(),
      base: { ...emptyTotals(), ...(prev?.totals ?? {}) }, counts: { follows: 0, shares: 0, chats: 0 }, pending: [], dirty: false,
    };
    active.set(roomId, a);
  }
  a.username = username;
  return a;
}

/** เรียกทุกอีเวนต์ของห้องจริง (ไม่ใช่เดโม) — นับอย่างเดียว ไม่โยน error */
export function noteLiveEvent(roomId: string, username: string, e: TikTokEvent, stats: { viewerCount?: number; likeCount?: number; diamondCount?: number }): void {
  try {
    const a = getActive(roomId, username);
    a.lastEventAt = Date.now();
    a.cur = { viewers: stats.viewerCount ?? a.cur.viewers, likes: Math.max(a.cur.likes, stats.likeCount ?? 0), diamonds: Math.max(a.cur.diamonds, stats.diamondCount ?? 0) };
    switch (e.type) {
      case 'member': {
        a.minute.joins++;
        const id = e.user?.userId || e.user?.uniqueId;
        if (id && a.joiners.size < 200_000) a.joiners.add(String(id));
        break;
      }
      case 'follow': a.minute.follows++; a.counts.follows++; break;
      case 'share': a.minute.shares++; a.counts.shares++; break;
      case 'chat': a.minute.chats++; a.counts.chats++; break;
      case 'gift': if (!e.streaking) a.minute.giftsCount += Number(e.repeatCount) || 1; break;
    }
    a.dirty = true;
  } catch { /* สถิติห้ามทำห้องพัง */ }
}

function totalsOf(a: Active): LiveTotals {
  return {
    uniqueJoiners: a.base.uniqueJoiners + a.joiners.size,
    follows: a.base.follows + a.counts.follows,
    shares: a.base.shares + a.counts.shares,
    chats: a.base.chats + a.counts.chats,
  };
}

/** รวมตัวอย่างตามนาที — นาทีเดียวกันจาก 2 โปรเซส เอาค่ามากกว่า */
function mergeSamples(a: LiveSample[], b: LiveSample[]): LiveSample[] {
  const m = new Map<number, LiveSample>();
  for (const s of [...a, ...b]) {
    const o = m.get(s.t);
    if (!o) { m.set(s.t, { ...s }); continue; }
    for (const k of Object.keys(s) as (keyof LiveSample)[]) o[k] = Math.max(o[k], s[k]);
  }
  return [...m.values()].sort((x, y) => x.t - y.t).slice(-MAX_SAMPLES);
}

function writeOne(a: Active): void {
  if (!a.dirty && !a.pending.length) return;
  const prev = readLiveStats(a.roomId);
  const mine = totalsOf(a);
  const pt = { ...emptyTotals(), ...(prev?.totals ?? {}) };
  const out: LiveStatsFile = {
    roomId: a.roomId, username: a.username,
    samples: mergeSamples(prev?.samples ?? [], a.pending),
    totals: { uniqueJoiners: Math.max(pt.uniqueJoiners, mine.uniqueJoiners), follows: Math.max(pt.follows, mine.follows), shares: Math.max(pt.shares, mine.shares), chats: Math.max(pt.chats, mine.chats) },
  };
  fs.mkdirSync(LIVESTATS_DIR, { recursive: true });
  const tmp = `${fileOf(a.roomId)}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(out));
  fs.renameSync(tmp, fileOf(a.roomId));
  a.pending = []; a.dirty = false;
}

/** เก็บตัวอย่าง 1 นาที (เรียกทุกนาที) */
export function sampleLiveStats(now = Date.now()): void {
  const t = Math.floor(now / MINUTE) * MINUTE;
  for (const [id, a] of active) {
    if (now - a.lastEventAt > IDLE_MS) {
      try { writeOne(a); } catch (err) { console.error('[livestats] save failed', err); }
      if (now - a.lastEventAt > 10 * MINUTE) active.delete(id);
      continue;
    }
    a.pending.push({ t, ...a.cur, ...a.minute });
    a.minute = { joins: 0, follows: 0, shares: 0, chats: 0, giftsCount: 0 };
    a.dirty = true;
  }
}

/** ลงดิสก์ทุกห้องที่มีข้อมูลใหม่ (เรียกตอนปิดเซิร์ฟเวอร์ได้) */
export function flushLiveStats(): void {
  for (const a of active.values()) {
    try { writeOne(a); } catch (err) { console.error('[livestats] save failed', err); }
  }
}

setInterval(() => { sampleLiveStats(); flushLiveStats(); }, MINUTE).unref();
