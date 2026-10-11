'use client';

import { useEffect, useState } from 'react';
import { Mail, Send } from 'lucide-react';
import { Alert, Button, Card, Field, Input, Select, Spinner } from './ui';
import { api } from '@/lib/api';

interface MailCfg { provider: 'off' | 'smtp' | 'resend'; from: string; smtpHost: string; smtpPort: number; smtpSecure: boolean; smtpUser: string; smtpPass: string; resendKey: string; enabled?: boolean }

/** ตั้งค่าเมลเซิร์ฟเวอร์ (ใช้ส่งลิงก์ลืมรหัสผ่าน) — SMTP เช่น Gmail + App Password หรือ Resend API key */
export function AdminMail() {
  const [cfg, setCfg] = useState<MailCfg | null>(null);
  const [busy, setBusy] = useState<'' | 'save' | 'test'>('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [to, setTo] = useState('');
  useEffect(() => { api<{ mail: MailCfg }>('/api/admin/mail').then((r) => setCfg(r.mail)).catch((e) => setMsg({ tone: 'error', text: (e as Error).message })); }, []);
  if (!cfg) return msg ? <Alert>{msg.text}</Alert> : <Spinner />;
  const set = (p: Partial<MailCfg>) => setCfg({ ...cfg, ...p });

  async function save() {
    setBusy('save'); setMsg(null);
    try { const r = await api<{ mail: MailCfg }>('/api/admin/mail', { method: 'PUT', body: cfg }); setCfg(r.mail); setMsg({ tone: 'success', text: 'บันทึกแล้ว ✓ มีผลทันที' }); }
    catch (e) { setMsg({ tone: 'error', text: (e as Error).message }); } finally { setBusy(''); }
  }
  async function test() {
    setBusy('test'); setMsg(null);
    try {
      const r = await api<{ ok: boolean; error?: string }>('/api/admin/mail/test', { method: 'POST', body: to ? { to } : {} });
      setMsg(r.ok ? { tone: 'success', text: `ส่งอีเมลทดสอบแล้ว ✓ ไปที่ ${to || 'อีเมลแอดมิน'} (ไม่เจอ ลองดูในสแปม)` } : { tone: 'error', text: `ส่งไม่สำเร็จ: ${r.error ?? ''}` });
    } catch (e) { setMsg({ tone: 'error', text: (e as Error).message }); } finally { setBusy(''); }
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Mail className="size-5 text-pink" /><h2 className="font-semibold">เมลเซิร์ฟเวอร์</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs ${cfg.enabled ? 'bg-mint-soft text-mint' : 'bg-gray-100 text-gray-500'}`}>{cfg.enabled ? '● ใช้งานอยู่' : '○ ยังไม่เปิด'}</span>
      </div>
      <p className="text-sm text-muted">ใช้ส่งลิงก์ "ลืมรหัสผ่าน" ให้ลูกค้า · ยังไม่เปิด = คำขอจะเข้ามาที่แชทลูกค้าให้แอดมินรีเซ็ตเอง</p>

      <Field label="ผู้ให้บริการ">
        <Select value={cfg.provider} onChange={(e) => set({ provider: e.target.value as MailCfg['provider'] })}>
          <option value="off">ปิด (ใช้ค่า RESEND_API_KEY ในเซิร์ฟเวอร์ถ้ามี)</option>
          <option value="smtp">SMTP (เช่น Gmail, Outlook, โฮสต์อีเมลของโดเมน)</option>
          <option value="resend">Resend (API key)</option>
        </Select>
      </Field>
      <Field label="ชื่อและอีเมลผู้ส่ง" hint='เช่น VJLiveKit <no-reply@vjlivekit.com> · Gmail ต้องเป็นอีเมลเดียวกับบัญชีที่ล็อกอิน'>
        <Input value={cfg.from} onChange={(e) => set({ from: e.target.value })} placeholder="VJLiveKit <you@gmail.com>" />
      </Field>

      {cfg.provider === 'smtp' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="SMTP Host"><Input value={cfg.smtpHost} onChange={(e) => set({ smtpHost: e.target.value })} placeholder="smtp.gmail.com" /></Field>
          <Field label="Port" hint="587 (STARTTLS) หรือ 465 (SSL)"><Input type="number" inputMode="numeric" value={cfg.smtpPort} onChange={(e) => set({ smtpPort: Number(e.target.value) || 587, smtpSecure: Number(e.target.value) === 465 })} /></Field>
          <Field label="ชื่อผู้ใช้ (อีเมล)"><Input value={cfg.smtpUser} onChange={(e) => set({ smtpUser: e.target.value })} placeholder="you@gmail.com" autoComplete="off" /></Field>
          <Field label="รหัสผ่าน / App Password" hint="Gmail: บัญชี Google → ความปลอดภัย → รหัสผ่านสำหรับแอป (ต้องเปิดยืนยัน 2 ขั้นตอน)"><Input type="password" value={cfg.smtpPass} onChange={(e) => set({ smtpPass: e.target.value })} autoComplete="new-password" /></Field>
          <label className="flex items-center gap-2 text-sm text-muted sm:col-span-2"><input type="checkbox" className="size-4 accent-pink" checked={cfg.smtpSecure} onChange={(e) => set({ smtpSecure: e.target.checked })} /> ใช้ SSL ตั้งแต่ต้น (พอร์ต 465)</label>
        </div>
      )}
      {cfg.provider === 'resend' && (
        <Field label="Resend API key" hint="resend.com → API Keys · ต้องยืนยันโดเมนผู้ส่งใน Resend ก่อน"><Input type="password" value={cfg.resendKey} onChange={(e) => set({ resendKey: e.target.value })} placeholder="re_..." autoComplete="new-password" /></Field>
      )}

      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="flex flex-wrap items-end gap-2">
        <Button loading={busy === 'save'} onClick={save}>บันทึก</Button>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <Input className="min-w-0 flex-1" value={to} onChange={(e) => setTo(e.target.value)} placeholder="ส่งทดสอบไปที่… (เว้นว่าง = อีเมลแอดมิน)" inputMode="email" />
          <Button variant="secondary" loading={busy === 'test'} onClick={test}><Send className="size-4" /> ส่งอีเมลทดสอบ</Button>
        </div>
      </div>
      <p className="text-xs text-muted">กดบันทึกก่อน แล้วค่อยกดส่งอีเมลทดสอบ</p>
    </Card>
  );
}
