import { createHash, randomBytes, scrypt as _scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

const scrypt = promisify(_scrypt);

/** แฮชรหัสผ่านด้วย scrypt (รูปแบบ: salt:hash ฐานสิบหก) */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${buf.toString('hex')}`;
}

/** ตรวจรหัสผ่านแบบ timing-safe */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const keyBuf = Buffer.from(key, 'hex');
  const buf = (await scrypt(password, salt, 64)) as Buffer;
  return keyBuf.length === buf.length && timingSafeEqual(keyBuf, buf);
}

export interface SessionClaims { userId: string; email: string; role: string; }

export function signSession(claims: SessionClaims, expiresIn: '1d' | '30d' | '90d' = '30d'): string {
  return jwt.sign(claims, config.jwtSecret, { expiresIn });
}

export function verifySession(token: string): SessionClaims | null {
  try { return jwt.verify(token, config.jwtSecret) as SessionClaims; }
  catch { return null; }
}

/** ลิงก์ตั้งรหัสใหม่: ผูกกับรหัสผ่านปัจจุบัน (เปลี่ยนรหัสแล้วลิงก์เดิมใช้ไม่ได้ = ใช้ได้ครั้งเดียว) อายุ 30 นาที */
export const resetFingerprint = (hash: string | null) => createHash('sha256').update('pwreset:' + (hash ?? 'none')).digest('hex').slice(0, 20);
export function signPasswordReset(userId: string, passwordHash: string | null): string {
  return jwt.sign({ uid: userId, ph: resetFingerprint(passwordHash), typ: 'pwreset' }, config.jwtSecret, { expiresIn: '30m' });
}
export function verifyPasswordReset(token: string): { uid: string; ph: string } | null {
  try { const c = jwt.verify(token, config.jwtSecret) as { uid?: string; ph?: string; typ?: string }; return c.typ === 'pwreset' && c.uid && c.ph ? { uid: c.uid, ph: c.ph } : null; }
  catch { return null; }
}
