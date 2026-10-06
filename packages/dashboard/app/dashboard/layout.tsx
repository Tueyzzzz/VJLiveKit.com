'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LayoutDashboard, LayoutTemplate, Zap, CreditCard, LogOut, Gift, Shield, BookOpen, Wallet } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Speaker } from '@/components/Speaker';
import { Badge, Spinner, cx } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { planLabel } from '@/lib/api';

const NAV = [
  { href: '/dashboard/', label: 'ภาพรวม', icon: LayoutDashboard },
  { href: '/dashboard/widgets/', label: 'วิดเจ็ต & ลิงก์ OBS', icon: LayoutTemplate },
  { href: '/dashboard/actions/', label: 'Actions & Events', icon: Zap },
  { href: '/dashboard/donate/', label: 'โดเนทขึ้นจอ', icon: Wallet },
  { href: '/dashboard/billing/', label: 'แพลน & การชำระเงิน', icon: CreditCard },
  { href: '/dashboard/referral/', label: 'แนะนำเพื่อน รับฟรี', icon: Gift },
  { href: '/dashboard/guide/', label: 'คู่มือการใช้งาน', icon: BookOpen },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, entitlements, isAdmin, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => { if (!loading && !user) router.replace(`/login/?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); }, [loading, user, router]);

  if (loading || !user) return <Spinner />;

  return (
    <div className="min-h-dvh md:flex">
      <aside className="border-b border-line bg-white md:sticky md:top-0 md:h-dvh md:w-64 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-5 py-4">
          <Logo href="/dashboard/" />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {[...NAV, ...(isAdmin ? [{ href: '/dashboard/admin/', label: 'หลังบ้าน (แอดมิน)', icon: Shield }] : [])].map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname === href.replace(/\/$/, '');
            return (
              <Link key={href} href={href}
                className={cx('flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition',
                  active ? 'bg-pink-soft font-medium text-pink' : 'text-muted hover:bg-violet-soft hover:text-ink')}>
                <Icon className="size-4" /> {label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 pb-3 md:pt-2"><Speaker /></div>
        <div className="hidden px-5 py-6 md:absolute md:bottom-0 md:block md:w-64">
          <div className="mb-3 truncate text-sm">{user.displayName ?? user.email}</div>
          <div className="mb-4"><Badge tone={entitlements?.plan === 'free' ? 'gray' : 'pink'}>{planLabel(entitlements)}</Badge></div>
          <button onClick={() => { logout(); router.replace('/'); }} className="flex items-center gap-2 text-sm text-muted hover:text-ink">
            <LogOut className="size-4" /> ออกจากระบบ
          </button>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
        {children}
        <button onClick={() => { logout(); router.replace('/'); }} className="mt-10 flex items-center gap-2 text-sm text-muted hover:text-ink md:hidden">
          <LogOut className="size-4" /> ออกจากระบบ
        </button>
      </main>
    </div>
  );
}
