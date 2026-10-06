import fs from 'node:fs';
import path from 'node:path';

/**
 * ค่าตั้งระบบที่แอดมินแก้ได้จากหน้า "ตั้งค่าระบบ" (ไม่ต้อง deploy ใหม่)
 * เก็บใน data/settings.json · ค่าที่ไม่ได้ตั้ง = ใช้ค่าเริ่มต้นด้านล่าง
 */
export interface SystemSettings {
  /** วันทดลองฟรีหลังสมัคร (ใช้ได้ทุกอย่างเท่า Pro) */
  trialDays: number;
  /** วิดเจ็ตทำงานเฉพาะตอนวีเจเปิดเว็บไว้ (แบบ TikFinity) */
  presenceLock: boolean;
  /** ปิดเว็บแล้วรอกี่วินาทีก่อนพักวิดเจ็ต (กันรีเฟรช/เปลี่ยนหน้าแล้วจอดับ) */
  presenceGraceSec: number;
  /** แพลนฟรี: จำนวนกฎ Actions สูงสุด */
  freeMaxRules: number;
  /** แพลนฟรี: จำนวนชุดลิงก์สูงสุด */
  freeMaxTokens: number;
  /** อัปโหลดเสียง: ขนาดสูงสุดต่อไฟล์ (MB) */
  soundMaxMB: number;
  /** อัปโหลดเสียง: จำนวนไฟล์สูงสุดต่อคน */
  soundMaxFiles: number;
  /** โดเนท: ขั้นต่ำเริ่มต้น (บาท) */
  donateDefaultMin: number;
  /** ป้าย vjlivekit.com บนจอ (ฟรี/ทดลอง): โผล่ทุกกี่นาที */
  brandEveryMin: number;
  /** ประกาศบนแดชบอร์ดทุกคน (เว้นว่าง = ไม่แสดง) */
  announcement: string;
}

export const DEFAULTS: SystemSettings = {
  trialDays: 30, presenceLock: true, presenceGraceSec: 90,
  freeMaxRules: 3, freeMaxTokens: 2,
  soundMaxMB: 5, soundMaxFiles: 30,
  donateDefaultMin: 10, brandEveryMin: 10, announcement: '',
};

/** ขอบเขตที่อนุญาต [min, max] — กันตั้งค่าผิดจนระบบพัง */
export const LIMITS: Record<string, [number, number]> = {
  trialDays: [0, 365], presenceGraceSec: [10, 1800], freeMaxRules: [0, 100], freeMaxTokens: [1, 20],
  soundMaxMB: [1, 20], soundMaxFiles: [1, 200], donateDefaultMin: [1, 10_000], brandEveryMin: [1, 120],
};

const FILE = path.join(process.env.SNAPSHOT_DIR ? path.dirname(process.env.SNAPSHOT_DIR) : path.resolve(process.cwd(), '../../data'), 'settings.json');
let current: SystemSettings = { ...DEFAULTS };
try { current = sanitize({ ...DEFAULTS, ...(JSON.parse(fs.readFileSync(FILE, 'utf8')) as Partial<SystemSettings>) }); } catch { /* ยังไม่มีไฟล์ */ }

function sanitize(s: Partial<SystemSettings>): SystemSettings {
  const out = { ...DEFAULTS } as unknown as Record<string, unknown>;
  for (const [k, def] of Object.entries(DEFAULTS)) {
    const v = (s as Record<string, unknown>)[k];
    if (typeof def === 'number') {
      const n = Number(v), [lo, hi] = LIMITS[k] ?? [0, Number.MAX_SAFE_INTEGER];
      out[k] = Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : def;
    } else if (typeof def === 'boolean') out[k] = typeof v === 'boolean' ? v : def;
    else out[k] = typeof v === 'string' ? v.slice(0, 300) : def;
  }
  return out as unknown as SystemSettings;
}

export const settings = (): SystemSettings => current;

export function updateSettings(patch: Partial<SystemSettings>): SystemSettings {
  current = sanitize({ ...current, ...patch });
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(current, null, 2));
  return current;
}
