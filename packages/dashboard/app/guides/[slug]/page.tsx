import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { GUIDES } from '@/lib/guides';

export const dynamicParams = false;
export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const g = GUIDES.find((x) => x.slug === slug);
  if (!g) return {};
  const url = `/guides/${g.slug}/`;
  return {
    title: g.title, description: g.description, alternates: { canonical: url },
    openGraph: { title: g.title, description: g.description, url, images: [{ url: '/og.png', width: 1200, height: 630 }] },
  };
}

/** คู่มือสาธารณะ 1 หน้า — ขั้นตอน + เคล็ดลับ + FAQ (มี JSON-LD HowTo/FAQPage ให้ Google) */
export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = GUIDES.find((x) => x.slug === slug);
  if (!g) notFound();
  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'HowTo', name: g.title, description: g.description, inLanguage: 'th',
      step: g.steps.map(([name, text], i) => ({ '@type': 'HowToStep', position: i + 1, name, text })) },
    { '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: g.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ];
  return (
    <div>
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <Logo />
        <Link href="/register/" className="rounded-xl bg-pink px-4 py-2 text-sm font-medium text-white">ใช้ฟรีเดือนแรก</Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-20">
        <p className="text-sm text-muted"><Link href="/guides/" className="underline">คู่มือ</Link> › {g.title}</p>
        <h1 className="mt-3 font-display text-3xl leading-snug sm:text-4xl">{g.title}</h1>
        <p className="mt-4 text-muted">{g.intro}</p>

        <h2 className="mt-10 text-xl font-semibold">ขั้นตอน</h2>
        <ol className="mt-4 space-y-3">
          {g.steps.map(([t, d], i) => (
            <li key={t} className="flex gap-4 rounded-xl border border-line bg-white p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-pink font-semibold text-white">{i + 1}</span>
              <div><h3 className="font-medium">{t}</h3><p className="mt-1 text-sm text-muted">{d}</p></div>
            </li>
          ))}
        </ol>

        {g.tips && (
          <>
            <h2 className="mt-10 text-xl font-semibold">เคล็ดลับ</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{g.tips.map((t) => <li key={t}>{t}</li>)}</ul>
          </>
        )}

        <h2 className="mt-10 text-xl font-semibold">คำถามที่พบบ่อย</h2>
        <div className="mt-3 space-y-3">
          {g.faq.map(([q, a]) => (
            <details key={q} className="rounded-xl border border-line bg-white px-4 py-3">
              <summary className="cursor-pointer font-medium">{q}</summary>
              <p className="mt-2 text-sm text-muted">{a}</p>
            </details>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-line bg-white p-6 text-center">
          <p className="font-medium">ลองใช้ฟรีเดือนแรก ไม่ต้องใส่บัตร</p>
          <Link href="/register/" className="mt-3 inline-block rounded-xl bg-pink px-6 py-3 font-medium text-white">สมัครใช้ฟรี</Link>
        </div>

        <h2 className="mt-12 text-lg font-semibold">คู่มืออื่น ๆ</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {GUIDES.filter((x) => x.slug !== g.slug).map((x) => <li key={x.slug}><Link href={`/guides/${x.slug}/`} className="underline">{x.title}</Link></li>)}
        </ul>
        <p className="mt-12 text-xs text-muted">VJLiveKit เป็นบริการอิสระ ไม่มีส่วนเกี่ยวข้องกับ TikTok อย่างเป็นทางการ</p>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />
    </div>
  );
}
