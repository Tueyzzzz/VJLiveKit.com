'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useT } from '@/lib/i18n';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';
const MINE = process.env.NEXT_PUBLIC_BUILD_ID ?? '';

/**
 * อัปเดตเว็บเองไม่ต้องกด F5: เช็กเวอร์ชันกับเซิร์ฟเวอร์ทุก 2 นาที + ตอนกลับมาที่แท็บ
 * มีเวอร์ชันใหม่ → โหลดใหม่ทันทีถ้าแท็บไม่ได้เปิดดูอยู่ / ตอนเปลี่ยนหน้า (ไม่ทำให้ฟอร์มที่กำลังพิมพ์หาย)
 * และโชว์แถบเล็ก ๆ ให้กดโหลดเลย
 */
export function AutoUpdate() {
  const [stale, setStale] = useState(false);
  const staleRef = useRef(false);
  const pathname = usePathname();
  const first = useRef(true);
  const t = useT();

  useEffect(() => {
    if (!MINE) return;
    const check = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/version`, { cache: 'no-store' });
        const { dashboard } = (await r.json()) as { dashboard?: string };
        if (dashboard && dashboard !== MINE) {
          staleRef.current = true; setStale(true);
          if (document.visibilityState === 'hidden') location.reload(); // ไม่มีใครดูอยู่ → โหลดใหม่ได้เลย
        }
      } catch { /* ออฟไลน์ชั่วคราว */ }
    };
    const onVis = () => { if (document.visibilityState === 'visible') void check(); else if (staleRef.current) location.reload(); };
    void check();
    const t = setInterval(check, 120_000);
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  // เปลี่ยนหน้าในเว็บ + มีเวอร์ชันใหม่ → โหลดหน้าที่จะไปแบบเต็ม (ได้ของใหม่ทันที)
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (staleRef.current) location.reload();
  }, [pathname]);

  if (!stale) return null;
  return (
    <button onClick={() => location.reload()}
      className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-white shadow-lg">
      {t('✨ มีเวอร์ชันใหม่ — แตะเพื่ออัปเดต')}
    </button>
  );
}
