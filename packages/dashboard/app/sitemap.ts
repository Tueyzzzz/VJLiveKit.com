import type { MetadataRoute } from 'next';
import { GUIDES } from '@/lib/guides';

export const dynamic = 'force-static';

const BASE = 'https://vjlivekit.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/tikfinity-alternative/`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/vj-studio-alternative/`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/guides/`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    ...GUIDES.map((g) => ({ url: `${BASE}/guides/${g.slug}/`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.8 })),
    { url: `${BASE}/register/`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/login/`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
