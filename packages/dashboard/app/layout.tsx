import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/lib/auth';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'VJLiveKit — ชุดเครื่องมือไลฟ์ครบ จบในที่เดียว', template: '%s · VJLiveKit' },
  description: 'วิดเจ็ต TikTok LIVE สำหรับ OBS: Coin Jar, แจ้งเตือนกิฟต์, เป้าหมาย, แชท, อ่านแชทออกเสียง และ Actions & Events',
  icons: { icon: '/favicon.svg' },
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
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
