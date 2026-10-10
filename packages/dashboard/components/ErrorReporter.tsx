'use client';

import { useEffect } from 'react';
import { API_BASE, getToken } from '@/lib/api';

/** ส่ง error ของหน้าเว็บกลับเซิร์ฟเวอร์ (แอดมินดูในหลังบ้าน) · จำกัด 15 ครั้ง/การโหลด, เรื่องเดียวกันไม่เกิน 2 ครั้ง */
export function ErrorReporter() {
  useEffect(() => {
    if (/^(localhost|127\.|\[::1\])/.test(location.hostname)) return;
    const seen = new Map<string, number>();
    let n = 0;
    const report = (msg: unknown, stack?: unknown, at = '') => {
      const m = String(msg || 'error');
      // หลัง deploy ไฟล์ JS ชุดเก่าถูกแทนที่ → หน้าที่เปิดค้างไว้โหลดไม่เจอ → โหลดหน้าใหม่เอง (กันวน: ไม่เกิน 1 ครั้งใน 30 วิ) ไม่ต้องบันทึก
      if (/ChunkLoadError|Failed to load chunk|Loading chunk .* failed|Importing a module script failed|Failed to fetch dynamically imported module/i.test(m + ' ' + String(stack ?? ''))) {
        try {
          const last = Number(sessionStorage.getItem('vjl-chunk-reload') || 0);
          if (Date.now() - last > 30_000) { sessionStorage.setItem('vjl-chunk-reload', String(Date.now())); location.reload(); return; }
        } catch { location.reload(); return; }
      }
      if (m === 'Script error.' || /ResizeObserver loop/.test(m) || n >= 15) return;
      const k = m.slice(0, 120), c = seen.get(k) ?? 0;
      if (c >= 2) return;
      seen.set(k, c + 1); n++;
      const body = JSON.stringify({ src: 'dashboard', msg: m.slice(0, 1500), stack: stack ? String(stack).slice(0, 3000) : undefined, where: location.pathname + (at ? ' ' + at : '') });
      try { fetch(`${API_BASE}/api/log/client`, { method: 'POST', headers: { 'content-type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) }, body, keepalive: true }).catch(() => {}); } catch { /* ไม่เป็นไร */ }
    };
    const onErr = (e: ErrorEvent) => report(e.error?.name === 'ChunkLoadError' ? `ChunkLoadError: ${e.message}` : e.message, e.error?.stack, e.filename ? `${e.filename.split('/').pop()?.split('?')[0]}:${e.lineno}` : '');
    const onRej = (e: PromiseRejectionEvent) => {
      const r = e.reason as { message?: string; stack?: string; status?: number } | undefined;
      if (r && typeof r.status === 'number' && r.status < 500) return; // 401/403/404 จาก API เป็นเรื่องปกติ
      report(`unhandledrejection: ${(r as { name?: string })?.name === 'ChunkLoadError' ? 'ChunkLoadError ' : ''}${r?.message ?? r}`, r?.stack);
    };
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);
    return () => { window.removeEventListener('error', onErr); window.removeEventListener('unhandledrejection', onRej); };
  }, []);
  return null;
}
