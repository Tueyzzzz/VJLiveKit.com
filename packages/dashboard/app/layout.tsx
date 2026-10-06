import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/lib/auth';
import './globals.css';
import { Pixels } from '@/components/Pixels';
import { LiveLink } from '@/components/Speaker';

const SITE = 'https://vjlivekit.com';
const TITLE = 'VJLiveKit — วิดเจ็ตไลฟ์ TikTok สำหรับ OBS & TikTok LIVE Studio';
const DESC = 'วิดเจ็ตไลฟ์ TikTok ภาษาไทย ของขวัญจริงตกลงโหล ตู้ปลา ต้นไม้ รถลาก Coin Jar · อันดับ Top Gifters · ลีก TikTok · แจ้งเตือนกิฟต์ · ไพ่ทาโร่ · อ่านแชทออกเสียง ใช้กับ OBS และ TikTok LIVE Studio ได้ทันที ใช้ฟรีเดือนแรก';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: TITLE, template: '%s · VJLiveKit' },
  description: DESC,
  keywords: ['วิดเจ็ตไลฟ์ TikTok', 'TikTok LIVE overlay', 'OBS TikTok', 'TikTok LIVE Studio', 'Coin Jar TikTok', 'โหลของขวัญ TikTok', 'Top Gifters', 'แจ้งเตือนของขวัญ TikTok', 'ลีก TikTok', 'ไพ่ทาโร่ไลฟ์', 'สตรีมเมอร์ TikTok', 'TikFinity ภาษาไทย', 'วีเจ.com', 'VJ Studio', 'VJ ไลฟ์สด'],
  applicationName: 'VJLiveKit',
  alternates: { canonical: '/' },
  icons: { icon: '/favicon.svg' },
  openGraph: {
    type: 'website', locale: 'th_TH', url: SITE, siteName: 'VJLiveKit', title: TITLE, description: DESC,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'VJLiveKit วิดเจ็ตไลฟ์ TikTok' }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC, images: ['/og.png'] },
  robots: { index: true, follow: true },
  verification: { google: 'N6KgsEtxCGvYorh9FuZ32OObpolT4t9ylVY3W4_T6qQ' },
};

export const viewport: Viewport = { themeColor: '#ff93c0' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600&family=Itim&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-dvh">
        <AuthProvider>{children}<LiveLink /></AuthProvider>
        <Pixels />
      </body>
    </html>
  );
}
