import fs from 'node:fs';
import path from 'node:path';

/**
 * Error log ถาวร — ไม่หายตอน deploy (เก็บในโฟลเดอร์ data ที่ mount ไว้)
 * - ไฟล์ละวัน: data/errors/YYYY-MM-DD.jsonl (หนึ่งบรรทัด = หนึ่ง error)
 * - เก็บ 3 วัน ลบเก่าเอง · จำกัดวันละ 20MB กันดิสก์เต็มถ้ามีอะไรวนพัง
 * - src: server (API/crash/console.error) · tiktok (การเชื่อมต่อไลฟ์) · overlay (วิดเจ็ต) · dashboard
 */
const ROOT = process.env.SNAPSHOT_DIR ? path.dirname(process.env.SNAPSHOT_DIR) : path.resolve(process.cwd(), '../../data');
const DIR = path.join(ROOT, 'errors');
const KEEP_DAYS = 3, MAX_DAY_BYTES = 20 * 1024 * 1024;

export type ErrSrc = 'server' | 'tiktok' | 'overlay' | 'dashboard';
export type ErrEntry = {
  ts: number; src: ErrSrc; msg: string; stack?: string; where?: string; // where = route / วิดเจ็ต / หน้า
  user?: string; ver?: string; ua?: string; ip?: string; extra?: string;
};

const day = (ts: number) => new Date(ts + 7 * 3600_000).toISOString().slice(0, 10); // วันตามเวลาไทย
const cut = (s: unknown, n: number) => (s == null ? undefined : String(s).slice(0, n));
let ready = false, dayBytes = 0, curDay = '';

function ensure(): boolean {
  if (ready) return true;
  try { fs.mkdirSync(DIR, { recursive: true }); ready = true; } catch { /* ดิสก์อ่านอย่างเดียว → ไม่บันทึก */ }
  return ready;
}

/** บันทึก error หนึ่งรายการ (ไม่โยน error ต่อ ไม่ว่าจะเกิดอะไร) */
/** สถานะปกติ ไม่ใช่ error (คนยังไม่ไลฟ์ / ไลฟ์จบ / ชื่อผิด) — ระบบลองต่อใหม่เองอยู่แล้ว ไม่ต้องเก็บ */
const NORMAL = /isn't online|not online|user_?not_?found|live has ended|stream ?end|room ?id.*(not found|missing)|failed to retrieve room ?id/i;

export function recordError(e: Omit<ErrEntry, 'ts'> & { ts?: number }): void {
  try {
    if (NORMAL.test(e.msg ?? '') || (e.src === 'tiktok' || e.src === 'server') && NORMAL.test(e.stack ?? '')) return;
    if (!ensure()) return;
    const ts = e.ts ?? Date.now(), d = day(ts);
    if (d !== curDay) { curDay = d; try { dayBytes = fs.statSync(path.join(DIR, d + '.jsonl')).size; } catch { dayBytes = 0; } }
    if (dayBytes > MAX_DAY_BYTES) return;
    const row: ErrEntry = { ts, src: e.src, msg: cut(e.msg, 500) || '(no message)', stack: cut(e.stack, 2000), where: cut(e.where, 200),
      user: cut(e.user, 80), ver: cut(e.ver, 40), ua: cut(e.ua, 200), ip: cut(e.ip, 64), extra: cut(e.extra, 500) };
    const line = JSON.stringify(row) + '\n';
    dayBytes += line.length;
    fs.appendFile(path.join(DIR, d + '.jsonl'), line, () => {});
  } catch { /* ignore */ }
}

/** ลบไฟล์เก่ากว่า 3 วัน */
export function pruneErrors(): void {
  try {
    if (!ensure()) return;
    const keep = day(Date.now() - (KEEP_DAYS - 1) * 86_400_000);
    for (const f of fs.readdirSync(DIR)) if (f.endsWith('.jsonl') && f.slice(0, 10) < keep) fs.rmSync(path.join(DIR, f), { force: true });
  } catch { /* ignore */ }
}

/** อ่าน error ย้อนหลัง n วัน (ใหม่สุดก่อน) */
export function readErrors(days: number): ErrEntry[] {
  if (!ensure()) return [];
  const out: ErrEntry[] = [];
  for (let i = 0; i < Math.min(KEEP_DAYS, Math.max(1, days)); i++) {
    const f = path.join(DIR, day(Date.now() - i * 86_400_000) + '.jsonl');
    let txt = '';
    try { txt = fs.readFileSync(f, 'utf8'); } catch { continue; }
    for (const l of txt.split('\n')) { if (!l) continue; try { const r = JSON.parse(l) as ErrEntry; if (!NORMAL.test(r.msg)) out.push(r); } catch { /* บรรทัดเสีย */ } }
  }
  return out.sort((a, b) => b.ts - a.ts);
}

/** ตัวเลข/ไอดีในข้อความ → ให้ error เรื่องเดียวกันจัดกลุ่มรวมกันได้ */
export const errKey = (e: ErrEntry) => `${e.src}|${e.where?.split('?')[0] ?? ''}|${e.msg.replace(/\d+/g, '#').replace(/https?:\/\/\S+/g, '<url>').slice(0, 160)}`;

let installed = false;
/** ดัก crash ทั้งโปรเซส + console.error → บันทึกด้วย · ลบไฟล์เก่าวันละครั้ง */
export function installErrorCapture(): void {
  if (installed) return; installed = true;
  process.on('uncaughtException', (err) => recordError({ src: 'server', msg: `uncaughtException: ${err?.message ?? err}`, stack: err?.stack }));
  process.on('unhandledRejection', (r: any) => recordError({ src: 'server', msg: `unhandledRejection: ${r?.message ?? r}`, stack: r?.stack }));
  const orig = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    orig(...args);
    const err = args.find((a) => a instanceof Error) as Error | undefined;
    const msg = args.map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })())).join(' ');
    recordError({ src: 'server', msg, stack: err?.stack, where: 'console.error' });
  };
  pruneErrors();
  setInterval(pruneErrors, 6 * 3600_000).unref();
}
