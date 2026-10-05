'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, Circle } from 'lucide-react';
import { Alert, Badge, Button, Card, Field, Input, PageHeader } from '@/components/ui';
import { ChangePassword } from '@/components/ChangePassword';
import { api, planLabel, type Me } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function OverviewPage() {
  const { user, entitlements, refresh } = useAuth();
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
      setMsg({ tone: 'success', text: 'บันทึกแล้ว' });
    } catch (err) {
      setMsg({ tone: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const steps = [
    { done: !!user.tiktokUsername, text: 'ตั้งชื่อ TikTok ที่จะไลฟ์', href: null },
    { done: false, text: 'สร้างลิงก์ overlay แล้ววางใน OBS (Browser Source)', href: '/dashboard/widgets/' },
    { done: false, text: 'ตั้งกฎ Actions: ได้กิฟต์ → เล่นเสียง/รูป', href: '/dashboard/actions/' },
  ];

  return (
    <div>
      <PageHeader title={`สวัสดี ${user.displayName ?? ''} 👋`} description="ตั้งค่าครั้งเดียว วิดเจ็ตทุกตัวจะเชื่อมกับไลฟ์ของคุณอัตโนมัติ" />

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <h2 className="mb-4 font-medium">โปรไฟล์</h2>
          <form onSubmit={onSave} className="space-y-4">
            <Field label="ชื่อ TikTok (username)" hint="ชื่อหลัง @ ในลิงก์โปรไฟล์ เช่น tiktok.com/@mimi_live → mimi_live">
              <div className="flex">
                <span className="grid place-items-center rounded-l-xl border border-r-0 border-line bg-canvas px-3 text-sm text-muted">@</span>
                <Input name="tiktokUsername" defaultValue={user.tiktokUsername ?? ''} placeholder="your_tiktok" className="rounded-l-none" pattern="@?[A-Za-z0-9._]{2,24}" />
              </div>
            </Field>
            <Field label="ชื่อที่แสดง">
              <Input name="displayName" defaultValue={user.displayName ?? ''} maxLength={60} />
            </Field>
            {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
            <Button type="submit" loading={busy}>บันทึก</Button>
          </form>
        </Card>

        <div className="space-y-5 lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="font-medium">แพลนของคุณ</h2>
              <Badge tone={entitlements?.plan === 'free' ? 'gray' : 'pink'}>{planLabel(entitlements)}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted">
              ใช้ได้ {entitlements?.widgets.length ?? 0} วิดเจ็ต · กฎ Actions {entitlements?.maxActionRules} ข้อ
            </p>
            {entitlements?.plan === 'trial' && (
              <p className="mt-2 text-sm">ช่วงทดลองฟรีใช้ได้ทุกฟีเจอร์ถึง {new Date(entitlements.trialEndsAt!).toLocaleDateString('th-TH', { dateStyle: 'long' })} — หลังจากนั้น 199 บาท/เดือน</p>
            )}
            {entitlements?.plan !== 'pro' && (
              <Link href="/dashboard/billing/" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-pink hover:underline">
                {entitlements?.plan === 'trial' ? 'สมัคร Pro ไว้เลย (ยังไม่เก็บเงินจนหมดช่วงฟรี)' : 'อัปเกรดเป็น Pro'} <ArrowRight className="size-4" />
              </Link>
            )}
          </Card>
          <Card>
            <h2 className="mb-3 font-medium">เริ่มต้นใช้งาน</h2>
            <ol className="space-y-3 text-sm">
              {steps.map((s) => (
                <li key={s.text} className="flex items-start gap-2">
                  {s.done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-mint" /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted" />}
                  {s.href ? <Link href={s.href} className="hover:text-pink">{s.text}</Link> : <span>{s.text}</span>}
                </li>
              ))}
            </ol>
          </Card>
          <ChangePassword />
        </div>
      </div>
    </div>
  );
}
