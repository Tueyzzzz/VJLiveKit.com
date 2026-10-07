'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Coins, Bell, Target, MessageCircle, Volume2, Sparkles, Trophy, UserPlus, Gift, Trees, Car, WandSparkles } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { PlanCards, usePlans } from '@/components/Pricing';
import { Button, Card, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { getToken } from '@/lib/api';
import { LangSwitch, useT } from '@/lib/i18n';

const FEATURES = [
  { icon: Gift, title: 'โหลของขวัญ & ตู้ปลา', img: '/overlay/themes/thumbs/gj-heart.webp', text: 'ของขวัญจริงตกลงโหล ตู้ปลา ลูกแก้ว โดมอวกาศ ของแพงชิ้นใหญ่ตามราคา' },
  { icon: Trees, title: 'ต้นไม้ & กระถาง', img: '/overlay/themes/thumbs/gd-sakura.webp', text: 'ของขวัญบานเป็นดอกไม้บนต้น เต็มแล้วร่วงกองพื้นแบบล้น ๆ' },
  { icon: Car, title: 'รถลากของขวัญ', img: '/overlay/themes/thumbs/car-convertible.webp', text: 'ผูกของขวัญลากท้ายรถแบบรถงานแต่ง กระเด้งตามถนน' },
  { icon: WandSparkles, title: 'ไพ่ทาโร่', img: '/overlay/tarot/m10.webp', text: 'ได้กิฟต์ → สุ่มไพ่ 1 / 3 / 7 ใบพร้อมคำทำนายให้ผู้ชม' },
  { icon: Coins, title: 'Coin Jar', img: '/overlay/themes/thumbs/cj-bear.webp', text: 'เครื่องจักรของขวัญ สายพานเลื่อนจริง กองเป็นภูเขา' },
  { icon: Bell, title: 'แจ้งเตือน', text: 'กิฟต์ ติดตาม แชร์ เด้งสวย พร้อมพลุ' },
  { icon: Target, title: 'แถบเป้าหมาย', img: '/overlay/hearts/thumb-melody.webp', text: 'ไลค์ ผู้ติดตาม เพชร กิฟต์ อัปเดตสด' },
  { icon: MessageCircle, title: 'แชทสด', text: 'แชทลอยบนจอ อ่านง่าย' },
  { icon: UserPlus, title: 'ผู้ติดตามล่าสุด', text: 'โชว์คนที่กดติดตามล่าสุด' },
  { icon: Trophy, title: 'Top Gifters & ลีก', img: '/overlay/thumbs/topgifters-a.webp', text: 'จัดอันดับคนส่งเพชร · โดมปลดล็อกลีก TikTok' },
  { icon: Volume2, title: 'อ่านแชทออกเสียง', img: '/menu/tts.webp', text: 'TTS ภาษาไทย อ่านแชทและกิฟต์' },
  { icon: Sparkles, title: 'Actions & Events', img: '/menu/actions.webp', text: 'ได้กิฟต์ X → เล่นเสียง/รูป/วิดีโอ Y อัตโนมัติ' },
];

const FAQ: [string, string][] = [
  ['VJLiveKit คืออะไร', 'VJLiveKit คือชุดวิดเจ็ตไลฟ์ TikTok ภาษาไทย ใช้วางบนจอไลฟ์ผ่าน OBS หรือ TikTok LIVE Studio เชื่อมกับไลฟ์จริงแบบเรียลไทม์ เช่น ของขวัญตกลงโหล อันดับคนส่งของขวัญ แจ้งเตือนกิฟต์ และไพ่ทาโร่'],
  ['ใช้กับ TikTok LIVE Studio ได้ไหม', 'ได้ คัดลอกลิงก์วิดเจ็ตไปเพิ่มเป็นแหล่งที่มาแบบลิงก์ใน TikTok LIVE Studio หรือ Browser Source ใน OBS รองรับทั้งไลฟ์แนวนอนและแนวตั้ง'],
  ['ต้องติดตั้งโปรแกรมไหม', 'ไม่ต้องติดตั้งอะไรเพิ่ม สมัคร ใส่ชื่อ TikTok แล้วคัดลอกลิงก์วิดเจ็ตไปใช้ได้ทันที'],
  ['ราคาเท่าไหร่', 'สมัครใหม่ใช้ฟรีทุกฟีเจอร์เดือนแรก หลังจากนั้นแพลน Pro 199 บาทต่อเดือน และแนะนำเพื่อนครบ 10 คนรับ Pro ฟรี 1 เดือน'],
  ['ลิงก์ต้องเปลี่ยนทุกครั้งที่ไลฟ์ไหม', 'ไม่ต้อง ลิงก์เดิมใช้ได้ตลอด ระบบจับไลฟ์ใหม่ให้เองทุกครั้งที่ขึ้นไลฟ์ และจำกองของขวัญกับอันดับไว้แม้รีเฟรช'],
];

const JSONLD = [
  {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'VJLiveKit', url: 'https://vjlivekit.com/',
    applicationCategory: 'MultimediaApplication', operatingSystem: 'Web, Windows, macOS',
    description: 'วิดเจ็ตไลฟ์ TikTok สำหรับ OBS และ TikTok LIVE Studio — โหลของขวัญ ตู้ปลา ต้นไม้ รถลาก Coin Jar อันดับ Top Gifters ลีก TikTok และไพ่ทาโร่',
    inLanguage: 'th', image: 'https://vjlivekit.com/og.png',
    sameAs: ['https://www.instagram.com/vjlivekit/', 'https://www.facebook.com/profile.php?id=61595273575386'],
    offers: { '@type': 'Offer', price: '199', priceCurrency: 'THB', description: 'ใช้ฟรีเดือนแรก จากนั้น 199 บาท/เดือน' },
  },
  {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  },
];

export default function Home() {
  const { user, loading } = useAuth();
  const t = useT();
  const { plans } = usePlans();
  const router = useRouter();
  // ล็อกอินค้างไว้ → เข้าหน้าแรกแล้วเด้งไป Dashboard เลย (ระหว่างเช็ก session ไม่โชว์หน้าแรกให้กระพริบ)
  const [hasSession, setHasSession] = useState(false);
  useEffect(() => { if (getToken()) setHasSession(true); }, []);
  useEffect(() => { if (user) router.replace('/dashboard/'); }, [user, router]);
  if (hasSession && (loading || user)) return <div className="flex min-h-dvh items-center justify-center"><Spinner /></div>;
  return (
    <div>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          <LangSwitch />
          <a href="#pricing" className="hidden px-3 text-sm text-muted hover:text-ink sm:inline">{t('ราคา')}</a>
          {user ? (
            <Link href="/dashboard/"><Button>{t('ไปที่ Dashboard')}</Button></Link>
          ) : (
            <>
              <Link href="/login/"><Button variant="ghost">{t('เข้าสู่ระบบ')}</Button></Link>
              <Link href="/register/"><Button>{t('สมัครฟรี')}</Button></Link>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 text-center sm:pt-20">
        <p className="mx-auto mb-4 w-fit rounded-full bg-pink-soft px-4 py-1 text-sm text-pink">{t('สำหรับสตรีมเมอร์ TikTok LIVE')}</p>
        <h1 className="font-display text-4xl leading-tight sm:text-6xl">
          {t('วิดเจ็ตไลฟ์ TikTok')}<br /><span className="text-gradient">{t('ครบ จบในที่เดียว')}</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-muted">
          {t('วิดเจ็ตสวยแบบเกม วางใน OBS / TikTok LIVE Studio ได้ทันที — ของขวัญจริงตกลงโหล ตู้ปลา ต้นไม้ รถลาก · อันดับ Top Gifters · ลีก · ไพ่ทาโร่ เชื่อมกับไลฟ์แบบเรียลไทม์ ตั้งค่าครั้งเดียวใช้ได้ตลอด')}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href={user ? '/dashboard/' : '/register/'}><Button className="px-6 py-3 text-base">{t('ใช้ฟรีเดือนแรก')}</Button></Link>
          <a href="/overlay/coinjar.html?demo=1" target="_blank" rel="noreferrer"><Button variant="secondary" className="px-6 py-3 text-base">{t('ดูเดโม')}</Button></a>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-20 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, text, ...f }) => (
          <Card key={title} className="overflow-hidden">
            {/* ภาพตัวอย่างจริงของวิดเจ็ต (ถ้ามี) — ไม่มีใช้ไอคอน */}
            <div className="-mx-5 -mt-5 mb-4 grid aspect-video place-items-center" style={{ background: 'radial-gradient(circle at 30% 20%, #3a2d52, #17121f 70%)' }}>
              {'img' in f && f.img
                ? <img src={(f.img.startsWith('/overlay') ? (process.env.NEXT_PUBLIC_API_BASE ?? '') : '') + f.img} alt={t(title)} loading="lazy" className="max-h-[85%] max-w-[90%] object-contain drop-shadow-lg" />
                : <div className="grid size-16 place-items-center rounded-2xl brand-gradient text-white shadow-lg"><Icon className="size-8" /></div>}
            </div>
            <h3 className="font-medium">{t(title)}</h3>
            <p className="mt-1 text-sm text-muted">{t(text)}</p>
          </Card>
        ))}
      </section>

      <section id="pricing" className="mx-auto max-w-3xl px-4 pb-24">
        <h2 className="mb-8 text-center font-display text-3xl">{t('แพลนและราคา')}</h2>
        {!plans ? <Spinner /> : (
          <PlanCards
            plans={plans}
            renderAction={(p) => (
              <Link href={user ? '/dashboard/billing/' : '/register/'}>
                <Button variant={p.priceCents > 0 ? 'primary' : 'secondary'} className="w-full">
                  {p.priceCents > 0 ? t('อัปเกรดเป็น Pro') : t('เริ่มใช้ฟรี')}
                </Button>
              </Link>
            )}
          />
        )}
      </section>

      <section id="faq" className="mx-auto max-w-3xl px-4 pb-24">
        <h2 className="mb-6 text-center font-display text-3xl">{t('คำถามที่พบบ่อย')}</h2>
        <div className="space-y-3">
          {FAQ.map(([q, a]) => (
            <details key={q} className="rounded-xl border border-line bg-white px-4 py-3">
              <summary className="cursor-pointer font-medium">{t(q)}</summary>
              <p className="mt-2 text-sm text-muted">{t(a)}</p>
            </details>
          ))}
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD) }} />

      <footer className="border-t border-line py-8 text-center text-xs text-muted">
        <a href="https://www.instagram.com/vjlivekit/" target="_blank" rel="noopener" className="mr-2 underline">Instagram</a> · <a href="https://www.facebook.com/profile.php?id=61595273575386" target="_blank" rel="noopener" className="mr-2 underline">Facebook</a> · <a href="/guides/" className="mr-2 underline">{t('คู่มือ')}</a> · <a href="/tikfinity-alternative/" className="mr-2 underline">{t('ทางเลือก TikFinity ภาษาไทย')}</a> · <a href="/vj-studio-alternative/" className="mr-2 underline">{t('ทางเลือก วีเจ.com')}</a> · © {new Date().getFullYear()} VJLiveKit · {t('งานพัฒนาอิสระ ไม่เกี่ยวข้องกับ TikTok อย่างเป็นทางการ')} · v{process.env.NEXT_PUBLIC_VERSION}
      </footer>
    </div>
  );
}
