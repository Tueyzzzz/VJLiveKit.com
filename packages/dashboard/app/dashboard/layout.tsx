'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LayoutDashboard, LayoutTemplate, Zap, CreditCard, LogOut, Gift, Shield, BookOpen, Wallet, Menu, X, ScrollText } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Speaker } from '@/components/Speaker';
import { Badge, Spinner, cx } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { api, planLabel } from '@/lib/api';

const NAV = [
  { href: '/dashboard/', label: 'ภาพรวม', icon: LayoutDashboard },
  { href: '/dashboard/widgets/', label: 'วิดเจ็ต & ลิงก์ OBS', icon: LayoutTemplate },
  { href: '/dashboard/actions/', label: 'Actions & Events', icon: Zap },
  { href: '/dashboard/widgets/settings/?type=fxmenu', label: 'เมนูของขวัญ', icon: ScrollText },
  { href: '/dashboard/donate/', label: 'โดเนทขึ้นจอ', icon: Wallet, soon: true }, // กำลังพัฒนา — เทาไว้ก่อน
  { href: '/dashboard/billing/', label: 'แพลน & การชำระเงิน', icon: CreditCard },
  { href: '/dashboard/referral/', label: 'แนะนำเพื่อน รับฟรี', icon: Gift },
  { href: '/dashboard/guide/', label: 'คู่มือการใช้งาน', icon: BookOpen },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, entitlements, isAdmin, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [notice, setNotice] = useState('');
  const [menu, setMenu] = useState(false); // มือถือ: เมนูพับ
  useEffect(() => setMenu(false), [pathname]);
  useEffect(() => { api<{ announcement: string }>('/api/settings/public').then((r) => setNotice(r.announcement)).catch(() => {}); }, []);
  useEffect(() => { if (!loading && !user) router.replace(`/login/?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); }, [loading, user, router]);

  if (loading || !user) return <Spinner />;

  return (
    <div className="min-h-dvh md:flex">
      <aside className="sticky top-0 z-40 border-b border-line bg-white md:h-dvh md:w-64 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-5 py-3 md:py-4">
          <Logo href="/dashboard/" />
          {/* มือถือ: ปุ่มเมนู (เดิมเป็นแถบเลื่อนข้าง มองไม่เห็นเมนูครบ) */}
          <button onClick={() => setMenu((m) => !m)} aria-label="เมนู" aria-expanded={menu}
            className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm md:hidden">
            {menu ? <X className="size-4" /> : <Menu className="size-4" />} เมนู
          </button>
        </div>
        <nav className={cx('grid-cols-2 gap-1 px-3 pb-3 md:flex md:flex-col md:pb-0', menu ? 'grid' : 'hidden')}>
          {[...NAV, ...(isAdmin ? [{ href: '/dashboard/admin/', label: 'หลังบ้าน (แอดมิน)', icon: Shield }] : [])].map(({ href, label, icon: Icon, ...rest }) => {
            if ('soon' in rest && rest.soon && !isAdmin) return (
              <span key={href} title="กำลังพัฒนา เร็ว ๆ นี้" className="flex min-h-11 shrink-0 cursor-not-allowed flex-wrap items-center gap-x-2.5 rounded-xl px-3 py-2 text-sm text-gray-300">
                <Icon className="size-4" /> {label} <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-400">กำลังพัฒนา</span>
              </span>
            );
            // ลิงก์ที่มี ?type= (เช่น เมนูของขวัญ) → ไฮไลต์เมื่ออยู่หน้าตั้งค่าของวิดเจ็ตนั้น
            const [hp, hq] = href.split('?');
            const active = hq ? pathname.replace(/\/$/, '') === hp.replace(/\/$/, '') && typeof window !== 'undefined' && window.location.search.includes(hq) : pathname === href || pathname === href.replace(/\/$/, '');
            return (
              <Link key={href} href={href}
                className={cx('flex min-h-11 shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition',
                  active ? 'bg-pink-soft font-medium text-pink' : 'text-muted hover:bg-violet-soft hover:text-ink')}>
                <Icon className="size-4" /> {label}
              </Link>
            );
          })}
        </nav>
        <div className={cx('px-3 pb-3 md:block md:pt-2', menu ? 'block' : 'hidden')}><Speaker /></div>
        <div className="hidden px-5 py-6 md:absolute md:bottom-0 md:block md:w-64">
          <div className="mb-3 truncate text-sm">{user.displayName ?? user.email}</div>
          <div className="mb-4"><Badge tone={entitlements?.plan === 'free' ? 'gray' : 'pink'}>{planLabel(entitlements)}</Badge></div>
          <button onClick={() => { logout(); router.replace('/'); }} className="flex items-center gap-2 text-sm text-muted hover:text-ink">
            <LogOut className="size-4" /> ออกจากระบบ
          </button>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
        {notice && <div className="mb-6 rounded-2xl bg-pink-soft px-4 py-3 text-sm text-ink">📢 {notice}</div>}
        {children}
        <button onClick={() => { logout(); router.replace('/'); }} className="mt-10 flex items-center gap-2 text-sm text-muted hover:text-ink md:hidden">
          <LogOut className="size-4" /> ออกจากระบบ
        </button>
      </main>
    </div>
  );
}
