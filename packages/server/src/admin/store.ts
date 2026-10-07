import fs from 'node:fs';
import path from 'node:path';

/**
 * ข้อมูลหลังบ้านที่ไม่ต้องอยู่ในฐานข้อมูล (ไม่ต้อง migrate): บัญชีที่ถูกระงับ + บันทึกการกระทำของแอดมิน
 * เก็บใน data/admin.json (volume ถาวร)
 */
const FILE = path.join(process.env.SNAPSHOT_DIR ? path.dirname(process.env.SNAPSHOT_DIR) : path.resolve(process.cwd(), '../../data'), 'admin.json');
export interface AuditEntry { at: string; admin: string; action: string; target?: string; detail?: string }
interface Store { suspended: Record<string, { at: string; reason: string }>; audit: AuditEntry[] }

let store: Store = { suspended: {}, audit: [] };
try { store = { suspended: {}, audit: [], ...(JSON.parse(fs.readFileSync(FILE, 'utf8')) as Partial<Store>) }; } catch { /* ยังไม่มีไฟล์ */ }
const save = () => {
  store.audit = store.audit.slice(-2000);
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(store));
};

export const isSuspended = (userId: string): boolean => !!store.suspended[userId];
export const suspendedInfo = (userId: string) => store.suspended[userId] ?? null;
export function setSuspended(userId: string, on: boolean, reason = ''): void {
  if (on) store.suspended[userId] = { at: new Date().toISOString(), reason: reason.slice(0, 200) };
  else delete store.suspended[userId];
  save();
}

export function audit(admin: string, action: string, target?: string, detail?: string): void {
  store.audit.push({ at: new Date().toISOString(), admin, action, target, detail: detail?.slice(0, 300) });
  save();
}
export const listAudit = (): AuditEntry[] => store.audit.slice().reverse();
