'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/** Google AdSense (Auto ads) — โหลดเฉพาะหน้าสาธารณะ (หน้าแรก บทความ ราคา) · ไม่โชว์ในแดชบอร์ด/หน้าล็อกอิน (ลูกค้าจ่ายเงินแล้วไม่ควรเห็นโฆษณา) */
const CLIENT = 'ca-pub-3733857601096784';
const NO_ADS = ['/dashboard', '/login', '/register', '/reset-password', '/billing', '/donate'];

export function AdSense() {
  const path = usePathname() || '/';
  useEffect(() => {
    if (NO_ADS.some((p) => path.startsWith(p))) return;
    if (document.getElementById('adsbygoogle-js')) return;
    const s = document.createElement('script');
    s.id = 'adsbygoogle-js'; s.async = true; s.crossOrigin = 'anonymous';
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`;
    document.head.appendChild(s);
  }, [path]);
  return null;
}
