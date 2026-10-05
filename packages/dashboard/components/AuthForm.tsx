'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Logo } from './Logo';
import { Alert, Button, Card, Field, Input } from './ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const { user, login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) router.replace('/dashboard/'); }, [user, router]);

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
      };
      const res = await api<{ token: string }>(`/api/auth/${mode}`, { method: 'POST', body });
      await login(res.token);
      router.replace('/dashboard/');
    } catch (err) {
      setError(err instanceof ApiError && err.status === 400 && mode === 'register'
        ? 'กรุณากรอกอีเมลให้ถูกต้อง และรหัสผ่านอย่างน้อย 8 ตัวอักษร'
        : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const isLogin = mode === 'login';
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-6"><Logo /></div>
      <Card className="w-full max-w-sm p-6">
        <h1 className="mb-5 font-display text-2xl">{isLogin ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          {!isLogin && (
            <Field label="ชื่อที่แสดง">
              <Input name="displayName" autoComplete="nickname" placeholder="เช่น น้องมิมิ" />
            </Field>
          )}
          <Field label="อีเมล">
            <Input name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
          </Field>
          <Field label="รหัสผ่าน" hint={isLogin ? undefined : 'อย่างน้อย 8 ตัวอักษร'}>
            <Input name="password" type="password" required minLength={8} autoComplete={isLogin ? 'current-password' : 'new-password'} />
          </Field>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" loading={busy} className="w-full">{isLogin ? 'เข้าสู่ระบบ' : 'สร้างบัญชี'}</Button>
        </form>
        <p className="mt-5 text-center text-sm text-muted">
          {isLogin ? <>ยังไม่มีบัญชี? <Link href="/register/" className="text-pink hover:underline">สมัครฟรี</Link></>
            : <>มีบัญชีแล้ว? <Link href="/login/" className="text-pink hover:underline">เข้าสู่ระบบ</Link></>}
        </p>
      </Card>
    </div>
  );
}
