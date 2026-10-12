'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';

/** เบราว์เซอร์ในแอป (TikTok / IG / FB / LINE) — แนบรูปสลิป/คัดลอกได้ไม่ดี → ชวนเปิดใน Chrome/Safari */
function inApp(ua: string) { return /musical_ly|BytedanceWebview|TikTok|trill|Instagram|FBAN|FBAV|Line\//i.test(ua); }

/** หน้าต่างแนะนำให้เปิดในเบราว์เซอร์จริง (แบบ ezdn) — กดใช้ต่อในแอปได้เสมอ ไม่บังคับ */
export function OpenInBrowser() {
  const t = useT();
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [os, setOs] = useState<'ios' | 'android' | 'other'>('other');
  useEffect(() => {
    const ua = navigator.userAgent;
    if (!inApp(ua)) return;
    try { if (sessionStorage.getItem('vjl-inapp-ok')) return; } catch { /* ignore */ }
    setOs(/iPhone|iPad|iPod/i.test(ua) ? 'ios' : /Android/i.test(ua) ? 'android' : 'other');
    setShow(true);
  }, []);
  if (!show) return null;
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const noProto = url.replace(/^https?:\/\//, '');
  const links: { name: string; icon: string; href: string }[] = os === 'android'
    ? [
      { name: 'Chrome', icon: '/browsers/chrome.svg', href: `intent://${noProto}#Intent;scheme=https;package=com.android.chrome;end` },
      { name: 'Firefox', icon: '/browsers/firefox.svg', href: `intent://${noProto}#Intent;scheme=https;package=org.mozilla.firefox;end` },
      { name: 'Edge', icon: '/browsers/edge.svg', href: `intent://${noProto}#Intent;scheme=https;package=com.microsoft.emmx;end` },
      { name: t('เบราว์เซอร์อื่น'), icon: '/browsers/web.svg', href: `intent://${noProto}#Intent;scheme=https;end` },
    ]
    : [
      { name: 'Safari', icon: '/browsers/safari.svg', href: `x-safari-${url}` },
      { name: 'Chrome', icon: '/browsers/chrome.svg', href: `googlechromes://${noProto}` },
      { name: 'Firefox', icon: '/browsers/firefox.svg', href: `firefox://open-url?url=${encodeURIComponent(url)}` },
      { name: 'Edge', icon: '/browsers/edge.svg', href: `microsoft-edge-${url}` },
    ];
  const copy = async () => { try { await navigator.clipboard.writeText(url); } catch { window.prompt(t('คัดลอกลิงก์นี้'), url); return; } setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const stay = () => { try { sessionStorage.setItem('vjl-inapp-ok', '1'); } catch { /* ignore */ } setShow(false); };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#2b1a3a]/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="bg-gradient-to-r from-pink to-violet px-5 py-4 text-white">
          <div className="text-lg font-bold">{t('เปิดในเบราว์เซอร์ จะโดเนทลื่นกว่า ✨')}</div>
          <div className="text-xs opacity-90">{t('เบราว์เซอร์ในแอป TikTok แนบสลิป/คัดลอกเลขบัญชีได้ไม่ค่อยดี')}</div>
        </div>
        <div className="space-y-3 p-5">
          <button type="button" onClick={copy} className="flex w-full items-center gap-2 rounded-2xl border border-line bg-canvas px-3 py-2.5 text-left text-sm">
            <span className="min-w-0 flex-1 truncate text-muted">{url}</span>
            <span className="shrink-0 font-semibold text-pink">{copied ? t('คัดลอกแล้ว ✓') : t('📋 คัดลอก')}</span>
          </button>
          <div className="grid grid-cols-2 gap-2">
            {links.map((l) => (
              <a key={l.name} href={l.href} className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-line bg-white py-3 text-sm font-medium transition hover:border-pink/50">
                <img src={l.icon} alt="" className="size-9" /> {l.name}
              </a>
            ))}
          </div>
          <p className="rounded-xl bg-pink-soft/60 px-3 py-2 text-xs text-ink">{os === 'ios' ? t('ถ้ากดแล้วไม่เปิด: แตะ ••• มุมขวาบน → “เปิดในเบราว์เซอร์”') : t('ถ้ากดแล้วไม่เปิด: แตะ ••• มุมขวาบน → “เปิดในเบราว์เซอร์” หรือคัดลอกลิงก์ไปวาง')}</p>
          <button type="button" onClick={stay} className="block w-full text-center text-xs text-muted underline">{t('ใช้ต่อในแอปนี้')}</button>
        </div>
      </div>
    </div>
  );
}
