'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useT } from '@/lib/i18n';

/** แบ่งหน้ารายการยาว ๆ (ตาราง/ลิสต์) · รายการเปลี่ยนจนหน้าปัจจุบันเกิน → กลับหน้าสุดท้ายที่มีอยู่ */
export function usePaged<T>(list: T[] | null | undefined, size = 20) {
  const all = list ?? [];
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(all.length / size));
  useEffect(() => { if (page > pages - 1) setPage(pages - 1); }, [page, pages]);
  const p = Math.min(page, pages - 1);
  return { items: all.slice(p * size, p * size + size), page: p, pages, total: all.length, size, setPage };
}

/** แถบเปลี่ยนหน้า: ← ก่อนหน้า · หน้า x / y (รายการ a–b จาก n) · ถัดไป → (ซ่อนเองถ้ามีหน้าเดียว) */
export function Pager({ page, pages, total, size, setPage }: { page: number; pages: number; total: number; size: number; setPage: (p: number) => void }) {
  const t = useT();
  if (pages <= 1) return null;
  const from = page * size + 1, to = Math.min(total, (page + 1) * size);
  const btn = 'inline-flex min-h-9 items-center gap-1 rounded-full border border-line bg-white px-3 text-sm text-ink transition hover:border-pink/50 hover:text-pink disabled:pointer-events-none disabled:opacity-40';
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-xs text-muted sm:text-sm">
      <span>{t('{a}–{b} จาก {n}', { a: from, b: to, n: total.toLocaleString() })}</span>
      <div className="flex items-center gap-1.5">
        <button className={btn} disabled={page === 0} onClick={() => setPage(page - 1)} aria-label={t('หน้าก่อนหน้า')}><ChevronLeft className="size-4" /> {t('ก่อนหน้า')}</button>
        <span className="px-1.5 tabular-nums">{t('หน้า {p}/{n}', { p: page + 1, n: pages })}</span>
        <button className={btn} disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label={t('หน้าถัดไป')}>{t('ถัดไป')} <ChevronRight className="size-4" /></button>
      </div>
    </div>
  );
}
