import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export interface OverlayTokenPayload {
  userId: string;
  username: string; // ชื่อ TikTok ที่จะเชื่อมไลฟ์
  plan?: string;    // "free" | "pro" — ใช้ gate ฟีเจอร์พรีเมียม
}

/** สร้าง token สำหรับใส่ใน URL overlay (OBS) */
export function signOverlayToken(payload: OverlayTokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: `${config.overlayTokenTtlDays}d` });
}

/** ตรวจสอบ token — คืน payload ถ้าถูกต้อง, null ถ้าไม่ */
export function verifyOverlayToken(token: string): OverlayTokenPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as OverlayTokenPayload;
  } catch {
    return null;
  }
}
