import { config } from '../config/index.js';

/** ส่งอีเมลผ่าน Resend HTTP API (ไม่ต้องลงไลบรารีเพิ่ม) · คืน false ถ้ายังไม่ได้ตั้งค่าหรือส่งไม่สำเร็จ */
export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  if (!config.resendKey) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${config.resendKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: config.mailFrom, to: [to], subject, html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) console.error('sendMail failed', r.status, await r.text().catch(() => ''));
    return r.ok;
  } catch (e) { console.error('sendMail error', e); return false; }
}

export const mailEnabled = () => !!config.resendKey;
