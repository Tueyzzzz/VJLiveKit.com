'use client';

/**
 * เว็บ 2 ภาษา (ไทยเป็นค่าเริ่มต้น / English)
 * เขียนข้อความเป็นภาษาไทยตามปกติ แล้วครอบด้วย t('ข้อความ') — ภาษาอังกฤษมาจากพจนานุกรม lib/i18n/en-*.ts
 * ไม่มีคำแปล = แสดงภาษาไทยเดิม (ไม่พัง) · ตัวแปรในข้อความใช้ {ชื่อ} เช่น t('เหลือ {n} วัน', { n: 3 })
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { EN_CORE } from './i18n/en-core';
import { EN_ACTIONS } from './i18n/en-actions';
import { EN_WIDGETS } from './i18n/en-widgets';

export type Lang = 'th' | 'en';
const KEY = 'vjl-lang';
const EN: Record<string, string> = { ...EN_CORE, ...EN_ACTIONS, ...EN_WIDGETS };

let current: Lang = 'th';
/** ภาษาปัจจุบัน — ใช้ได้นอก React (เช่น ข้อความ error จาก API) */
export const getLang = (): Lang => current;

function fill(s: string, vars?: Record<string, string | number>): string {
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}
/** แปลข้อความ (ภาษาไทย → อังกฤษ เมื่อเลือก EN) */
export function translate(th: string, vars?: Record<string, string | number>): string {
  return fill(current === 'en' ? EN[th] ?? EN[th.trim()] ?? th : th, vars);
}

type T = typeof translate;
const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: T }>({ lang: 'th', setLang: () => {}, t: translate });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('th');
  useEffect(() => {
    let l: Lang = 'th';
    try { if (localStorage.getItem(KEY) === 'en') l = 'en'; } catch { /* ignore */ }
    current = l; setLangState(l); document.documentElement.lang = l;
  }, []);
  const setLang = useCallback((l: Lang) => {
    current = l; setLangState(l); document.documentElement.lang = l;
    try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  }, []);
  // t เปลี่ยน identity ตามภาษา → คอมโพเนนต์ที่ใช้ useT() วาดใหม่
  const t = useCallback<T>((s, v) => translate(s, v), [lang]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useT = (): T => useContext(Ctx).t;
export const useLang = () => { const c = useContext(Ctx); return [c.lang, c.setLang] as const; };

/** ปุ่มสลับภาษา TH / EN */
export function LangSwitch({ className = '' }: { className?: string }) {
  const [lang, setLang] = useLang();
  return (
    <div className={`inline-flex overflow-hidden rounded-full border border-line text-xs ${className}`} role="group" aria-label="Language">
      {(['th', 'en'] as const).map((l) => (
        <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l}
          className={`px-2.5 py-1 font-medium transition ${lang === l ? 'bg-pink text-white' : 'bg-white text-muted hover:text-ink'}`}>
          {l === 'th' ? 'ไทย' : 'EN'}
        </button>
      ))}
    </div>
  );
}
