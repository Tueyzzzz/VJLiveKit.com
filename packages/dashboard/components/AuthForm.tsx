'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Logo } from './Logo';
import { Alert, Button, Card, Field, Input } from './ui';
import { PasswordInput } from './PasswordInput';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { trackSignup } from '@/lib/track';
import { useT } from '@/lib/i18n';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const { user, login } = useAuth();
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);
  const [forgot, setForgot] = useState(false);

  // หลังล็อกอิน → กลับไปหน้าที่เปิดค้างไว้ (เฉพาะหน้าในแดชบอร์ด)
  const nextPath = () => { const n = new URLSearchParams(window.location.search).get('next') ?? ''; return n.startsWith('/dashboard/') ? n : '/dashboard/'; };
  useEffect(() => { if (user) router.replace(nextPath()); }, [user, router]);
  // ลิงก์แนะนำ ?ref=... → จำไว้ (เผื่อเพื่อนกดไปหน้าอื่นก่อนสมัคร)
  useEffect(() => { const r = new URLSearchParams(window.location.search).get('ref'); if (r) try { localStorage.setItem('vjl_ref', r); } catch { /* ignore */ } }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    setBusy(true);
    try {
      const body = {
        email: String(form.get('email') ?? ''),
        password: String(form.get('password') ?? ''),
        ...(mode === 'register' && form.get('displayName') ? { displayName: String(form.get('displayName')) } : {}),
        ...(mode === 'login' ? { remember } : {}),
        ...(mode === 'register' ? (() => { try { const r = localStorage.getItem('vjl_ref'); return r ? { ref: r } : {}; } catch { return {}; } })() : {}),
      };
      const res = await api<{ token: string }>(`/api/auth/${mode}`, { method: 'POST', body });
      if (mode === 'register') trackSignup();
      await login(res.token, mode === 'login' ? remember : true);
      router.replace(nextPath());
    } catch (err) {
      setError(err instanceof ApiError && err.status === 400 && mode === 'register'
        ? t('กรุณากรอกอีเมลให้ถูกต้อง และรหัสผ่านอย่างน้อย 8 ตัวอักษร')
        : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const isLogin = mode === 'login';
  if (isLogin && forgot) return <ForgotPassword onBack={() => setForgot(false)} />;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-6"><Logo /></div>
      <Card className="w-full max-w-sm p-6">
        <h1 className="mb-5 font-display text-2xl">{isLogin ? t('เข้าสู่ระบบ') : t('สมัครสมาชิก')}</h1>
        <form onSubmit={onSubmit} className="space-y-4" method="post" autoComplete="on">
          {!isLogin && (
            <Field label={t('ชื่อที่แสดง')}>
              <Input name="displayName" autoComplete="nickname" placeholder={t('เช่น น้องมิมิ')} />
            </Field>
          )}
          <Field label={t('อีเมล')}>
            <Input name="email" id="email" type="email" required autoComplete="username" inputMode="email" placeholder="you@example.com" />
          </Field>
          <Field label={t('รหัสผ่าน')} hint={isLogin ? undefined : t('อย่างน้อย 8 ตัวอักษร')}>
            <PasswordInput name="password" required minLength={8} autoComplete={isLogin ? 'current-password' : 'new-password'} />
          </Field>
          {isLogin && <div className="-mt-2 text-right"><button type="button" onClick={() => setForgot(true)} className="text-sm text-pink hover:underline">{t('ลืมรหัสผ่าน?')}</button></div>}
          {isLogin && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-pink" />
              {t('จำฉันไว้ในเครื่องนี้')} <span className="text-xs">{t('(ไม่ติ๊ก = ปิดเบราว์เซอร์แล้วออกจากระบบ)')}</span>
            </label>
          )}
          {error && <Alert>{error}</Alert>}
          <Button type="submit" loading={busy} className="w-full">{isLogin ? t('เข้าสู่ระบบ') : t('สร้างบัญชี')}</Button>
        </form>
        <p className="mt-5 text-center text-sm text-muted">
          {isLogin ? <>{t('ยังไม่มีบัญชี?')} <Link href="/register/" className="text-pink hover:underline">{t('สมัครฟรี')}</Link></>
            : <>{t('มีบัญชีแล้ว?')} <Link href="/login/" className="text-pink hover:underline">{t('เข้าสู่ระบบ')}</Link></>}
        </p>
      </Card>
    </div>
  );
}

/** ลืมรหัสผ่าน: ส่งคำขอถึงแอดมิน → แอดมินตั้งรหัสชั่วคราวให้แล้วติดต่อกลับทางช่องทางที่กรอก */
function ForgotPassword({ onBack }: { onBack: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null); setBusy(true);
    try {
      await api('/api/auth/forgot', { method: 'POST', body: { email: String(form.get('email') ?? ''), contact: String(form.get('contact') ?? '') } });
      setSent(true);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-6"><Logo /></div>
      <Card className="w-full max-w-sm p-6">
        <h1 className="mb-2 font-display text-2xl">{t('ลืมรหัสผ่าน')}</h1>
        {sent ? (
          <>
            <Alert tone="success">{t('ส่งคำขอแล้ว ✓ ทีมงานจะตั้งรหัสผ่านชั่วคราวให้ แล้วติดต่อกลับทางช่องทางที่ให้ไว้ (ปกติภายในวันเดียวกัน) — เข้าได้แล้วเปลี่ยนรหัสใหม่ได้ที่หน้าโปรไฟล์')}</Alert>
            <Button variant="secondary" className="mt-4 w-full" onClick={onBack}>{t('กลับไปหน้าเข้าสู่ระบบ')}</Button>
          </>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <p className="text-sm text-muted">{t('กรอกอีเมลที่ใช้สมัคร และช่องทางให้ทีมงานติดต่อกลับ เราจะตั้งรหัสผ่านชั่วคราวให้')}</p>
            <Field label={t('อีเมลที่ใช้สมัคร')}>
              <Input name="email" type="email" required autoComplete="username" inputMode="email" placeholder="you@example.com" />
            </Field>
            <Field label={t('ช่องทางติดต่อกลับ')} hint={t('เช่น LINE ID, เบอร์โทร, Facebook หรือชื่อ TikTok')}>
              <Input name="contact" required minLength={3} maxLength={200} placeholder={t('LINE: mimi123')} />
            </Field>
            {error && <Alert>{error}</Alert>}
            <Button type="submit" loading={busy} className="w-full">{t('ส่งคำขอรีเซ็ตรหัสผ่าน')}</Button>
            <button type="button" onClick={onBack} className="w-full text-center text-sm text-muted hover:text-pink">{t('← กลับไปหน้าเข้าสู่ระบบ')}</button>
          </form>
        )}
      </Card>
    </div>
  );
}
