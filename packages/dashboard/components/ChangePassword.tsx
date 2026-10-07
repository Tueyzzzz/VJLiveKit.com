'use client';

import { useState, type FormEvent } from 'react';
import { Alert, Button, Card, Field } from './ui';
import { PasswordInput } from './PasswordInput';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';

/** เปลี่ยนรหัสผ่าน (ต้องใส่รหัสเดิม) · inline = อยู่ในการ์ดโปรไฟล์ กดแล้วค่อยกางฟอร์ม */
export function ChangePassword({ inline = false }: { inline?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(!inline);
  const t = useT();
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget, form = new FormData(formEl);
    const current = String(form.get('current') ?? ''), next = String(form.get('next') ?? ''), confirm = String(form.get('confirm') ?? '');
    setMsg(null);
    if (next.length < 8) return setMsg({ tone: 'error', text: t('รหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร') });
    if (next !== confirm) return setMsg({ tone: 'error', text: t('ยืนยันรหัสผ่านใหม่ไม่ตรงกัน') });
    setBusy(true);
    try {
      await api('/api/auth/password', { method: 'POST', body: { current, next } });
      formEl.reset();
      setMsg({ tone: 'success', text: t('เปลี่ยนรหัสผ่านแล้ว') });
    } catch (err) {
      setMsg({ tone: 'error', text: (err as Error).message });
    } finally { setBusy(false); }
  }

  if (!open) return (
    <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-violet hover:text-pink hover:underline">🔒 {t('เปลี่ยนรหัสผ่าน')}</button>
  );
  const form = (
      <form onSubmit={onSubmit} className={inline ? 'grid gap-3 sm:grid-cols-3' : 'space-y-3'}>
        <Field label={t('รหัสผ่านปัจจุบัน')}><PasswordInput name="current" required autoComplete="current-password" /></Field>
        <Field label={t('รหัสผ่านใหม่')} hint={t('อย่างน้อย 8 ตัวอักษร')}><PasswordInput name="next" required minLength={8} autoComplete="new-password" /></Field>
        <Field label={t('ยืนยันรหัสผ่านใหม่')}><PasswordInput name="confirm" required minLength={8} autoComplete="new-password" /></Field>
        {msg && <div className={inline ? 'sm:col-span-3' : ''}><Alert tone={msg.tone === 'success' ? 'success' : undefined}>{msg.text}</Alert></div>}
        <div className={inline ? 'flex gap-2 sm:col-span-3' : ''}>
          <Button type="submit" loading={busy}>{t('เปลี่ยนรหัสผ่าน')}</Button>
          {inline && <Button type="button" variant="ghost" onClick={() => { setOpen(false); setMsg(null); }}>{t('ยกเลิก')}</Button>}
        </div>
      </form>
  );
  if (inline) return <div className="space-y-3 rounded-xl bg-canvas p-4"><h3 className="text-sm font-medium">🔒 {t('เปลี่ยนรหัสผ่าน')}</h3>{form}</div>;
  return <Card><h2 className="mb-3 font-medium">{t('เปลี่ยนรหัสผ่าน')}</h2>{form}</Card>;
}
