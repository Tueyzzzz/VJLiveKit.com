import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export interface OverlayTokenPayload {
  /** id ของแถว OverlayToken — ใช้ตรวจว่าถูกเพิกถอน (revoke) หรือยัง */
  tid: string;
  userId: string;
}

/**
 * สร้าง token สำหรับใส่ใน URL overlay (OBS)
 * ใช้ iat = เวลาสร้างแถว token -> เซ็นซ้ำกี่ครั้งก็ได้ URL เดิม (คัดลอกใหม่จาก Dashboard ได้)
 */
export function signOverlayToken(payload: OverlayTokenPayload, issuedAt: Date): string {
  const iat = Math.floor(issuedAt.getTime() / 1000);
  return jwt.sign({ tid: payload.tid, userId: payload.userId, iat }, config.jwtSecret, { expiresIn: `${config.overlayTokenTtlDays}d` });
}

/** ตรวจสอบ token — คืน payload ถ้าถูกต้อง, null ถ้าไม่ */
export function verifyOverlayToken(token: string): OverlayTokenPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as OverlayTokenPayload;
  } catch {
    return null;
  }
}
