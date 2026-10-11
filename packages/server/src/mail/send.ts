import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

/**
 * ตั้งค่าเมลเซิร์ฟเวอร์ (แอดมินแก้ได้ในหน้า Admin ไม่ต้อง deploy ใหม่) — เก็บใน data/mail.json
 * provider: smtp (เช่น Gmail + App Password) หรือ resend (API key) · ไม่ตั้งในหน้า Admin = ใช้ RESEND_API_KEY จาก env ถ้ามี
 */
export interface MailConfig {
  provider: 'off' | 'smtp' | 'resend';
  from: string;
  smtpHost: string; smtpPort: number; smtpSecure: boolean; smtpUser: string; smtpPass: string;
  resendKey: string;
}
const DEFAULT: MailConfig = { provider: 'off', from: config.mailFrom, smtpHost: '', smtpPort: 587, smtpSecure: false, smtpUser: '', smtpPass: '', resendKey: '' };
const FILE = path.join(process.env.SNAPSHOT_DIR ? path.dirname(process.env.SNAPSHOT_DIR) : path.resolve(process.cwd(), '../../data'), 'mail.json');

let current: MailConfig = { ...DEFAULT };
try { current = { ...DEFAULT, ...(JSON.parse(fs.readFileSync(FILE, 'utf8')) as Partial<MailConfig>) }; } catch { /* ยังไม่มีไฟล์ */ }
let transport: nodemailer.Transporter | null = null;

export function getMailConfig(): MailConfig { return current; }
export function saveMailConfig(next: MailConfig): void {
  current = next; transport = null;
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(next), { mode: 0o600 });
}

/** ใช้งานได้จริงไหม (หน้า Admin เลือก หรือมี RESEND_API_KEY ใน env) */
export const mailEnabled = () => (current.provider === 'smtp' && !!current.smtpHost) || (current.provider === 'resend' && !!current.resendKey) || (current.provider === 'off' && !!config.resendKey);

/** ส่งอีเมล · คืน { ok, error } (error ใช้แสดงในหน้า Admin ตอนกดทดสอบ) */
export async function sendMailDetailed(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const c = current;
  try {
    if (c.provider === 'smtp' && c.smtpHost) {
      transport ??= nodemailer.createTransport({ host: c.smtpHost, port: c.smtpPort, secure: c.smtpSecure, auth: c.smtpUser ? { user: c.smtpUser, pass: c.smtpPass } : undefined, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000 });
      await transport.sendMail({ from: c.from || c.smtpUser, to, subject, html });
      return { ok: true };
    }
    const key = c.provider === 'resend' ? c.resendKey : c.provider === 'off' ? config.resendKey : '';
    if (!key) return { ok: false, error: c.provider === 'smtp' ? 'ยังไม่ได้ใส่ SMTP Host' : 'ยังไม่ได้ตั้งค่าเมลเซิร์ฟเวอร์ — เลือกผู้ให้บริการเป็น SMTP แล้วกดบันทึก' };
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: c.from || config.mailFrom, to: [to], subject, html }),
      signal: AbortSignal.timeout(10_000),
    });
    return r.ok ? { ok: true } : { ok: false, error: `Resend ${r.status}: ${(await r.text().catch(() => '')).slice(0, 300)}` };
  } catch (e) {
    transport = null; // ต่อใหม่ครั้งหน้า (ไม่ค้าง connection เสีย)
    const m = (e as Error).message || String(e);
    // ต่อพอร์ตเมลไม่ได้เลย = ผู้ให้บริการเซิร์ฟเวอร์ (เช่น Vultr) บล็อก SMTP ขาออก → บอกทางแก้ชัด ๆ
    if (/timeout|ETIMEDOUT|ECONNREFUSED|EHOSTUNREACH|ENETUNREACH/i.test(m) && c.provider === 'smtp')
      return { ok: false, error: `ต่อเมลเซิร์ฟเวอร์ ${c.smtpHost}:${c.smtpPort} ไม่ได้ (${m}) — เซิร์ฟเวอร์อาจถูกผู้ให้บริการบล็อกพอร์ตส่งเมล: ขอ Vultr เปิดพอร์ต SMTP หรือเปลี่ยนไปใช้ Resend` };
    if (/Invalid login|535|534/i.test(m)) return { ok: false, error: `ล็อกอิน Gmail ไม่ผ่าน (${m}) — ตรวจอีเมลผู้ใช้และ App Password 16 ตัว` };
    return { ok: false, error: m };
  }
}

export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const r = await sendMailDetailed(to, subject, html);
  if (!r.ok) console.error('sendMail failed:', r.error);
  return r.ok;
}
