import { randomBytes, scrypt as _scrypt, timingSafeEqual } from 'node:crypto';
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

export function signSession(claims: SessionClaims): string {
  return jwt.sign(claims, config.jwtSecret, { expiresIn: '30d' });
}

export function verifySession(token: string): SessionClaims | null {
  try { return jwt.verify(token, config.jwtSecret) as SessionClaims; }
  catch { return null; }
}
