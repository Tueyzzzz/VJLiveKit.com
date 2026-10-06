import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

/** ให้ Google เก็บเฉพาะหน้าสาธารณะ — ไม่เก็บ Dashboard / overlay / API */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/dashboard/', '/overlay/', '/api/', '/billing/'] }],
    sitemap: 'https://vjlivekit.com/sitemap.xml',
    host: 'https://vjlivekit.com',
  };
}
