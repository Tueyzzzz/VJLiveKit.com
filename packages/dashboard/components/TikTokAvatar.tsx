'use client';

import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

/** รูปโปรไฟล์ TikTok จากชื่อผู้ใช้ (ดึงผ่านเซิร์ฟเวอร์เรา) · โหลดไม่ได้ → วงกลมตัวอักษรแรก */
export function TikTokAvatar({ username, size = 40, className = '' }: { username?: string | null; size?: number; className?: string }) {
  const u = (username ?? '').replace(/^@/, '').trim().toLowerCase();
  const valid = /^[a-z0-9._]{2,24}$/.test(u);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [u]);
  const style = { width: size, height: size };
  if (!valid || failed) {
    return (
      <span style={{ ...style, fontSize: size * 0.42 }} className={`grid shrink-0 place-items-center rounded-full bg-pink-soft font-semibold text-pink ${className}`}>
        {valid ? u[0]!.toUpperCase() : '@'}
      </span>
    );
  }
  return <img src={`${API_BASE}/api/tiktok/avatar/${u}`} alt={`@${u}`} style={style} onError={() => setFailed(true)}
    className={`shrink-0 rounded-full bg-pink-soft object-cover ring-2 ring-white ${className}`} />;
}
