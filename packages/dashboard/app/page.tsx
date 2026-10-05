'use client';

import Link from 'next/link';
import { Coins, Bell, Target, MessageCircle, Volume2, Sparkles, Trophy, UserPlus } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { PlanCards, usePlans } from '@/components/Pricing';
import { Button, Card, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';

const FEATURES = [
  { icon: Coins, title: 'Coin Jar', text: 'โหลเหรียญฟิสิกส์จริง เหรียญตกตามมูลค่ากิฟต์' },
  { icon: Bell, title: 'แจ้งเตือน', text: 'กิฟต์ ติดตาม แชร์ เด้งสวย พร้อมพลุ' },
  { icon: Target, title: 'แถบเป้าหมาย', text: 'ไลค์ ผู้ติดตาม เพชร กิฟต์ อัปเดตสด' },
  { icon: MessageCircle, title: 'แชทสด', text: 'แชทลอยบนจอ อ่านง่าย' },
  { icon: UserPlus, title: 'ผู้ติดตามล่าสุด', text: 'โชว์คนที่กดติดตามล่าสุด' },
  { icon: Trophy, title: 'Top Gifters', text: 'จัดอันดับคนส่งเพชรสูงสุดในไลฟ์' },
  { icon: Volume2, title: 'อ่านแชทออกเสียง', text: 'TTS ภาษาไทย อ่านแชทและกิฟต์' },
  { icon: Sparkles, title: 'Actions & Events', text: 'ได้กิฟต์ X → เล่นเสียง/รูป/วิดีโอ Y อัตโนมัติ' },
];

export default function Home() {
  const { user } = useAuth();
  const { plans } = usePlans();
  return (
    <div>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          <a href="#pricing" className="hidden px-3 text-sm text-muted hover:text-ink sm:inline">ราคา</a>
          {user ? (
            <Link href="/dashboard/"><Button>ไปที่ Dashboard</Button></Link>
          ) : (
            <>
              <Link href="/login/"><Button variant="ghost">เข้าสู่ระบบ</Button></Link>
              <Link href="/register/"><Button>สมัครฟรี</Button></Link>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 text-center sm:pt-20">
        <p className="mx-auto mb-4 w-fit rounded-full bg-pink-soft px-4 py-1 text-sm text-pink">สำหรับสตรีมเมอร์ TikTok LIVE</p>
        <h1 className="font-display text-4xl leading-tight sm:text-6xl">
          ชุดเครื่องมือไลฟ์ครบ<br /><span className="text-gradient">จบในที่เดียว</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-muted">
          วิดเจ็ตสวย ๆ วางใน OBS / TikTok LIVE Studio ได้ทันที เชื่อมกับไลฟ์จริงแบบเรียลไทม์ ตั้งค่าครั้งเดียวใช้ได้ตลอด
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href={user ? '/dashboard/' : '/register/'}><Button className="px-6 py-3 text-base">เริ่มใช้ฟรี</Button></Link>
          <a href="/overlay/coinjar.html?demo=1" target="_blank" rel="noreferrer"><Button variant="secondary" className="px-6 py-3 text-base">ดูเดโม</Button></a>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-20 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <Card key={title}>
            <div className="mb-3 grid size-10 place-items-center rounded-xl brand-gradient text-white"><Icon className="size-5" /></div>
            <h3 className="font-medium">{title}</h3>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </Card>
        ))}
      </section>

      <section id="pricing" className="mx-auto max-w-3xl px-4 pb-24">
        <h2 className="mb-8 text-center font-display text-3xl">แพลนและราคา</h2>
        {!plans ? <Spinner /> : (
          <PlanCards
            plans={plans}
            renderAction={(p) => (
              <Link href={user ? '/dashboard/billing/' : '/register/'}>
                <Button variant={p.priceCents > 0 ? 'primary' : 'secondary'} className="w-full">
                  {p.priceCents > 0 ? 'อัปเกรดเป็น Pro' : 'เริ่มใช้ฟรี'}
                </Button>
              </Link>
            )}
          />
        )}
      </section>

      <footer className="border-t border-line py-8 text-center text-xs text-muted">
        © {new Date().getFullYear()} VJLiveKit · งานพัฒนาอิสระ ไม่เกี่ยวข้องกับ TikTok อย่างเป็นทางการ
      </footer>
    </div>
  );
}
