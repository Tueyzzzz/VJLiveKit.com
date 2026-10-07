'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogOut, Shield, Menu, X } from 'lucide-react';
import { NAV } from '@/lib/nav';
import { useSupportUnread } from '@/components/SupportChat';
import { Logo } from '@/components/Logo';
import { Speaker } from '@/components/Speaker';
import { TikTokAvatar } from '@/components/TikTokAvatar';
import { NotificationBell } from '@/components/NotificationBell';
import { LiveStatusBar } from '@/components/LiveStatusBar';
import { Badge, Spinner, cx } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { api, planLabel } from '@/lib/api';
import { LangSwitch, useT } from '@/lib/i18n';

/** รูปประจำเมนู (VJ ทำกิจกรรมตามเมนู) — โหลดไม่ได้ถอยไปใช้ไอคอนเส้น */
function NavImg({ img, Icon, active, dim }: { img?: string; Icon: React.ComponentType<{ className?: string }>; active?: boolean; dim?: boolean }) {
  const [bad, setBad] = useState(false);
  if (!img || bad) return <Icon className="size-4" />;
  return <img src={`/menu/${img}.webp`} alt="" width={36} height={36} loading="lazy" onError={() => setBad(true)}
    className={cx('-my-1.5 size-9 shrink-0 object-contain transition-transform', active ? 'scale-110 drop-shadow' : '', dim ? 'opacity-40 grayscale' : '')} />;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, entitlements, isAdmin, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const t = useT();
  const sup = useSupportUnread();

  const [notice, setNotice] = useState('');
  const [menu, setMenu] = useState(false); // มือถือ: เมนูพับ
  useEffect(() => setMenu(false), [pathname]);
  useEffect(() => { api<{ announcement: string }>('/api/settings/public').then((r) => setNotice(r.announcement)).catch(() => {}); }, []);
  useEffect(() => { if (!loading && !user) router.replace(`/login/?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); }, [loading, user, router]);

  if (loading || !user) return <Spinner />;

  return (
    <div className="min-h-dvh md:flex">
      <aside className="sticky top-0 z-40 border-b border-line bg-white md:flex md:h-dvh md:w-64 md:shrink-0 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-5 py-3 md:py-4">
          <Logo href="/dashboard/" />
          {/* มือถือ: ปุ่มเมนู (เดิมเป็นแถบเลื่อนข้าง มองไม่เห็นเมนูครบ) */}
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button onClick={() => setMenu((m) => !m)} aria-label={t('เมนู')} aria-expanded={menu}
            className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm md:hidden">
            {menu ? <X className="size-4" /> : <Menu className="size-4" />} {t('เมนู')}
          </button>
          </div>
        </div>
        <nav className={cx('grid-cols-2 gap-1 px-3 pb-3 md:flex md:flex-col md:pb-0', menu ? 'grid' : 'hidden')}>
          {[...NAV, ...(isAdmin ? [{ href: '/dashboard/admin/', label: 'หลังบ้าน (แอดมิน)', img: 'admin', icon: Shield }] : [])].map(({ href, label, icon: Icon, img, ...rest }) => {
            if ('soon' in rest && rest.soon && !isAdmin) return (
              <span key={href} title={t('กำลังพัฒนา เร็ว ๆ นี้')} className="flex min-h-11 shrink-0 cursor-not-allowed flex-wrap items-center gap-x-2.5 rounded-xl px-3 py-2 text-sm text-gray-300">
                <NavImg img={img} Icon={Icon} dim /> {t(label)} <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-400">{t('กำลังพัฒนา')}</span>
              </span>
            );
            // ลิงก์ที่มี ?type= (เช่น เมนูของขวัญ) → ไฮไลต์เมื่ออยู่หน้าตั้งค่าของวิดเจ็ตนั้น
            const [hp, hq] = href.split('?');
            const active = hq ? pathname.replace(/\/$/, '') === hp.replace(/\/$/, '') && typeof window !== 'undefined' && window.location.search.includes(hq) : pathname === href || pathname === href.replace(/\/$/, '');
            return (
              <Link key={href} href={href}
                className={cx('flex min-h-11 shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition',
                  active ? 'bg-pink-soft font-medium text-pink' : 'text-muted hover:bg-violet-soft hover:text-ink')}>
                <NavImg img={img} Icon={Icon} active={active} /> {t(label)}
                {(href === '/dashboard/support/' ? sup.unread : href === '/dashboard/admin/' ? sup.admin : 0) > 0 && (
                  <span className="ml-auto rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">{href === '/dashboard/support/' ? sup.unread : sup.admin}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className={cx('px-3 pb-3 md:block md:pt-2', menu ? 'block' : 'hidden')}><Speaker /></div>
        <div className={cx('px-5 pb-3 md:hidden', menu ? 'block' : 'hidden')}><LangSwitch /></div>
        {/* การ์ดผู้ใช้มุมล่าง: รูป+ชื่อ+แพลน → ภาษา / ออกจากระบบ → เลขเวอร์ชัน */}
        <div className="hidden px-3 pb-4 pt-4 md:mt-auto md:block">
          <div className="rounded-2xl border border-line bg-gradient-to-br from-pink-soft/60 to-white p-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <TikTokAvatar username={user.tiktokUsername} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{user.displayName ?? user.email}</div>
                {user.tiktokUsername && <div className="truncate text-xs text-muted">@{user.tiktokUsername}</div>}
              </div>
            </div>
            <div className="mt-2.5"><Badge tone={entitlements?.plan === 'free' ? 'gray' : 'pink'}>{planLabel(entitlements)}</Badge></div>
            <div className="mt-3 flex items-center justify-between border-t border-line/70 pt-3">
              <LangSwitch />
              <button onClick={() => { logout(); router.replace('/'); }} title={t('ออกจากระบบ')} aria-label={t('ออกจากระบบ')}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-muted transition hover:bg-white hover:text-ink">
                <LogOut className="size-3.5" /> {t('ออกจากระบบ')}
              </button>
            </div>
          </div>
          <div className="mt-2 text-center text-[10px] text-muted/60" title={process.env.NEXT_PUBLIC_BUILD_ID}>v{process.env.NEXT_PUBLIC_VERSION}</div>
        </div>
        <div className={cx('px-5 pb-3 text-[10px] text-muted/70 md:hidden', menu ? 'block' : 'hidden')}>v{process.env.NEXT_PUBLIC_VERSION}</div>
      </aside>
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
        {notice && <div className="mb-6 rounded-2xl bg-pink-soft px-4 py-3 text-sm text-ink">📢 {notice}</div>}
        <LiveStatusBar />
        {children}
        <button onClick={() => { logout(); router.replace('/'); }} className="mt-10 flex items-center gap-2 text-sm text-muted hover:text-ink md:hidden">
          <LogOut className="size-4" /> {t('ออกจากระบบ')}
        </button>
      </main>
    </div>
  );
}
