import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { GUIDES } from '@/lib/guides';

export const metadata: Metadata = {
  title: 'คู่มือวิดเจ็ตไลฟ์ TikTok สำหรับวีเจ',
  description: 'รวมคู่มือภาษาไทย: ใส่วิดเจ็ตใน TikTok LIVE Studio, ทำ Coin Jar โหลของขวัญ, โชว์ลีก TikTok บนจอ และเทคนิคเพิ่มของขวัญในไลฟ์',
  alternates: { canonical: '/guides/' },
};

export default function Guides() {
  return (
    <div>
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <Logo />
        <Link href="/register/" className="rounded-xl bg-pink px-4 py-2 text-sm font-medium text-white">ใช้ฟรีเดือนแรก</Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-20">
        <h1 className="mt-6 font-display text-3xl sm:text-4xl">คู่มือวิดเจ็ตไลฟ์ TikTok</h1>
        <p className="mt-3 text-muted">ทีละขั้น ภาษาไทย สำหรับวีเจและสตรีมเมอร์</p>
        <div className="mt-8 space-y-3">
          {GUIDES.map((g) => (
            <Link key={g.slug} href={`/guides/${g.slug}/`} className="block rounded-xl border border-line bg-white p-5 hover:border-pink">
              <h2 className="font-semibold">{g.title}</h2>
              <p className="mt-1 text-sm text-muted">{g.description}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
