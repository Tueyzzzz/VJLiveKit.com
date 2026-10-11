'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Logo } from '@/components/Logo';
import { Alert, Button, Card, Field } from '@/components/ui';
import { PasswordInput } from '@/components/PasswordInput';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';

/** ตั้งรหัสผ่านใหม่จากลิงก์ในอีเมล (?token=...) → ตั้งเสร็จเข้าสู่ระบบให้เลย */
export function ResetPasswordForm() {
  const t = useT();
  const router = useRouter();
  const { login } = useAuth();
  const token = useSearchParams().get('token') ?? '';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get('password') ?? ''), confirm = String(form.get('confirm') ?? '');
    if (password !== confirm) { setError(t('รหัสผ่านทั้งสองช่องไม่ตรงกัน')); return; }
    setError(null); setBusy(true);
    try {
      const r = await api<{ token: string }>('/api/auth/reset', { method: 'POST', body: { token, password } });
      await login(r.token, true);
      router.replace('/dashboard/');
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-6"><Logo /></div>
      <Card className="w-full max-w-sm p-6">
        <h1 className="mb-5 font-display text-2xl">{t('ตั้งรหัสผ่านใหม่')}</h1>
        {!token ? (
          <Alert>{t('ลิงก์ไม่ครบ — เปิดลิงก์จากอีเมลอีกครั้ง หรือขอลิงก์ใหม่ที่หน้าเข้าสู่ระบบ')}</Alert>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label={t('รหัสผ่านใหม่')} hint={t('อย่างน้อย 8 ตัวอักษร')}>
              <PasswordInput name="password" required minLength={8} autoComplete="new-password" />
            </Field>
            <Field label={t('ยืนยันรหัสผ่านใหม่')}>
              <PasswordInput name="confirm" required minLength={8} autoComplete="new-password" />
            </Field>
            {error && <Alert>{error}</Alert>}
            <Button type="submit" loading={busy} className="w-full">{t('บันทึกรหัสผ่านใหม่')}</Button>
          </form>
        )}
        <p className="mt-5 text-center text-sm text-muted"><Link href="/login/" className="text-pink hover:underline">{t('← กลับไปหน้าเข้าสู่ระบบ')}</Link></p>
      </Card>
    </div>
  );
}
