'use client';

import { useState, type FormEvent } from 'react';
import { Alert, Button, Card, Field } from './ui';
import { PasswordInput } from './PasswordInput';
import { api } from '@/lib/api';

/** เปลี่ยนรหัสผ่าน (ต้องใส่รหัสเดิม) */
export function ChangePassword() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget, form = new FormData(formEl);
    const current = String(form.get('current') ?? ''), next = String(form.get('next') ?? ''), confirm = String(form.get('confirm') ?? '');
    setMsg(null);
    if (next.length < 8) return setMsg({ tone: 'error', text: 'รหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร' });
    if (next !== confirm) return setMsg({ tone: 'error', text: 'ยืนยันรหัสผ่านใหม่ไม่ตรงกัน' });
    setBusy(true);
    try {
      await api('/api/auth/password', { method: 'POST', body: { current, next } });
      formEl.reset();
      setMsg({ tone: 'success', text: 'เปลี่ยนรหัสผ่านแล้ว' });
    } catch (err) {
      setMsg({ tone: 'error', text: (err as Error).message });
    } finally { setBusy(false); }
  }

  return (
    <Card>
      <h2 className="mb-3 font-medium">เปลี่ยนรหัสผ่าน</h2>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="รหัสผ่านปัจจุบัน"><PasswordInput name="current" required autoComplete="current-password" /></Field>
        <Field label="รหัสผ่านใหม่" hint="อย่างน้อย 8 ตัวอักษร"><PasswordInput name="next" required minLength={8} autoComplete="new-password" /></Field>
        <Field label="ยืนยันรหัสผ่านใหม่"><PasswordInput name="confirm" required minLength={8} autoComplete="new-password" /></Field>
        {msg && <Alert tone={msg.tone === 'success' ? 'success' : undefined}>{msg.text}</Alert>}
        <Button type="submit" loading={busy}>เปลี่ยนรหัสผ่าน</Button>
      </form>
    </Card>
  );
}
