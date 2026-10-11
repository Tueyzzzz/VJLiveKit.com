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
      transport ??= nodemailer.createTransport({ host: c.smtpHost, port: c.smtpPort, secure: c.smtpSecure, auth: c.smtpUser ? { user: c.smtpUser, pass: c.smtpPass } : undefined, connectionTimeout: 10_000 });
      await transport.sendMail({ from: c.from || c.smtpUser, to, subject, html });
      return { ok: true };
    }
    const key = c.provider === 'resend' ? c.resendKey : c.provider === 'off' ? config.resendKey : '';
    if (!key) return { ok: false, error: 'ยังไม่ได้ตั้งค่าเมลเซิร์ฟเวอร์' };
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: c.from || config.mailFrom, to: [to], subject, html }),
      signal: AbortSignal.timeout(10_000),
    });
    return r.ok ? { ok: true } : { ok: false, error: `Resend ${r.status}: ${(await r.text().catch(() => '')).slice(0, 300)}` };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const r = await sendMailDetailed(to, subject, html);
  if (!r.ok) console.error('sendMail failed:', r.error);
  return r.ok;
}
