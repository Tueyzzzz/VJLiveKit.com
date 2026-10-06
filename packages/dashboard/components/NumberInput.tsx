'use client';

import { useEffect, useState } from 'react';
import { Input } from './ui';

/** แป้นพิมพ์ไทย: ปุ่มแถวตัวเลขพิมพ์ออกมาเป็นอักษรไทย → แปลงกลับเป็นตัวเลข (รวมเลขไทย ๐–๙) */
const THAI_KEYS: Record<string, string> = { 'ๅ': '1', '/': '2', '-': '3', 'ภ': '4', 'ถ': '5', 'ุ': '6', 'ึ': '7', 'ค': '8', 'ต': '9', 'จ': '0' };
export function toDigits(raw: string, allowDecimal = false, allowNegative = false): string {
  let out = '';
  for (const ch of raw) {
    if (allowNegative && ch === '-' && out === '') { out = '-'; continue; } // ติดลบ (เฉพาะตัวแรก)
    const c = ch >= '๐' && ch <= '๙' ? String(ch.charCodeAt(0) - 0x0e50) : THAI_KEYS[ch] ?? ch;
    if (/[0-9]/.test(c) || (allowDecimal && c === '.' && !out.includes('.'))) out += c;
  }
  return out;
}

/**
 * ช่องตัวเลขที่พิมพ์ได้ทุกแป้นพิมพ์ (แทน type="number" ที่พิมพ์ตอนแป้นไทยไม่ได้)
 * ลบจนว่างได้ระหว่างพิมพ์ · ออกจากช่องแล้วยังว่าง → กลับเป็นค่าต่ำสุด/0
 */
export function NumberInput({ value, onChange, min, max, step, placeholder, className }: {
  value: number | string | undefined; onChange: (n: number) => void; min?: number; max?: number; step?: number; placeholder?: string; className?: string;
}) {
  const allowDecimal = !!step && step % 1 !== 0;
  const [text, setText] = useState(value === undefined || value === null ? '' : String(value));
  useEffect(() => { const v = value === undefined || value === null ? '' : String(value); if (Number(v) !== Number(text) || (v === '' && text !== '')) setText(v); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
  return (
    <Input type="text" inputMode={allowDecimal ? 'decimal' : 'numeric'} value={text} placeholder={placeholder} className={className}
      onChange={(e) => { const t = toDigits(e.target.value, allowDecimal, (min ?? 0) < 0); setText(t); if (t !== '' && t !== '.' && t !== '-') onChange(Number(t)); }}
      onBlur={() => { if (text === '' || text === '.' || text === '-') { const n = clamp(min ?? 0); setText(String(n)); onChange(n); } else { const n = clamp(Number(text)); if (String(n) !== text) setText(String(n)); onChange(n); } }}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault(); const n = clamp((Number(text) || 0) + (e.key === 'ArrowUp' ? 1 : -1) * (step ?? 1)); setText(String(n)); onChange(n);
      }} />
  );
}
