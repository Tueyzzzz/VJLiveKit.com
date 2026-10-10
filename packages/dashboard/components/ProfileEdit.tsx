'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { Alert, Button, Field, Input } from '@/components/ui';
import { ChangePassword } from '@/components/ChangePassword';
import { TikTokAvatar } from '@/components/TikTokAvatar';
import { api, type Me } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';

/** ฟอร์มโปรไฟล์: ชื่อ TikTok + ชื่อที่แสดง + เปลี่ยนรหัสผ่าน */
export function ProfileForm({ onSaved }: { onSaved?: () => void }) {
  const { user, refresh } = useAuth();
  const t = useT();
  const [tk, setTk] = useState<string | null>(null); // ชื่อที่กำลังพิมพ์ → ดูรูปโปรไฟล์ก่อนบันทึก
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const tiktok = String(form.get('tiktokUsername') ?? '').trim();
    const displayName = String(form.get('displayName') ?? '').trim();
    setBusy(true);
    setMsg(null);
    try {
      await api<{ user: Me }>('/api/auth/me', {
        method: 'PATCH',
        body: { tiktokUsername: tiktok || null, ...(displayName ? { displayName } : {}) },
      });
      await refresh();
      setMsg({ tone: 'success', text: t('บันทึกแล้ว') });
      onSaved?.();
    } catch (err) {
      setMsg({ tone: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form onSubmit={onSave} className="grid gap-4">
        <Field label={t('ชื่อ TikTok (username)')} hint={t('ชื่อหลัง @ ในลิงก์โปรไฟล์ เช่น tiktok.com/@mimi_live → mimi_live')}>
          <div className="flex items-center gap-3">
            <TikTokAvatar username={tk ?? user.tiktokUsername} size={44} />
            <div className="flex min-w-0 flex-1">
              <span className="grid place-items-center rounded-l-xl border border-r-0 border-line bg-canvas px-3 text-sm text-muted">@</span>
              <Input name="tiktokUsername" defaultValue={user.tiktokUsername ?? ''} placeholder="your_tiktok" className="min-w-0 rounded-l-none" pattern="@?[A-Za-z0-9._]{2,24}"
                onBlur={(e) => setTk(e.target.value)} />
            </div>
          </div>
        </Field>
        <Field label={t('ชื่อที่แสดง')}>
          <Input name="displayName" defaultValue={user.displayName ?? ''} maxLength={60} />
        </Field>
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <div><Button type="submit" loading={busy}>{t('บันทึก')}</Button></div>
      </form>
      <div className="mt-4 border-t border-line pt-4"><ChangePassword inline /></div>
    </>
  );
}

/** หน้าต่างแก้ไขโปรไฟล์ (เปิดจากไอคอนดินสอข้างการ์ดผู้ใช้) — มือถือเป็นแผ่นเลื่อนขึ้นจากล่าง */
export function ProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    const o = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = o; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={t('แก้ไขโปรไฟล์')}>
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-medium">{t('แก้ไขโปรไฟล์')}</h2>
          <button type="button" onClick={onClose} aria-label={t('ปิด')} className="rounded-full p-1.5 text-muted hover:bg-canvas hover:text-ink"><X className="size-5" /></button>
        </div>
        <ProfileForm />
      </div>
    </div>
  );
}
