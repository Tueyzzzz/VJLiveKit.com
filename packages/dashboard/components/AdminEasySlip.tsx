'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Alert, Badge, Button, Card, Field, Input } from './ui';

/** หลังบ้าน: คีย์ EasySlip (ตรวจสลิปโดเนทอัตโนมัติ · API v2) — คีย์จริงไม่ถูกส่งกลับมาแสดง */
export function AdminEasySlip() {
  const [st, setSt] = useState<{ key: string; fromEnv: boolean; enabled: boolean } | null>(null);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState<'' | 'save' | 'test'>('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  useEffect(() => { api<{ key: string; fromEnv: boolean; enabled: boolean }>('/api/admin/easyslip').then((r) => { setSt(r); setKey(r.key); }).catch(() => {}); }, []);

  async function save() {
    setBusy('save'); setMsg(null);
    try { const r = await api<{ key: string; fromEnv: boolean; enabled: boolean }>('/api/admin/easyslip', { method: 'PUT', body: { key } }); setSt(r); setKey(r.key); setMsg({ tone: 'success', text: 'บันทึกแล้ว ✓ กด “ทดสอบ” เพื่อเช็กคีย์' }); }
    catch (e) { setMsg({ tone: 'error', text: (e as Error).message }); } finally { setBusy(''); }
  }
  async function test() {
    setBusy('test'); setMsg(null);
    try {
      const r = await api<{ ok: boolean; error?: string; info?: Record<string, unknown> }>('/api/admin/easyslip/test', { method: 'POST' });
      setMsg(r.ok ? { tone: 'success', text: 'คีย์ใช้ได้ ✓ ' + (r.info ? JSON.stringify(r.info).slice(0, 300) : '') } : { tone: 'error', text: r.error ?? 'ใช้ไม่ได้' });
    } catch (e) { setMsg({ tone: 'error', text: (e as Error).message }); } finally { setBusy(''); }
  }

  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-medium">🧾 ตรวจสลิปโดเนทอัตโนมัติ (EasySlip)</h2>
        {st && <Badge tone={st.enabled ? 'mint' : 'gray'}>{st.enabled ? 'เปิดใช้งาน' : 'ปิดอยู่'}</Badge>}
      </div>
      <p className="mt-1 text-sm text-muted">ใส่ API Key จาก <a href="https://developer.easyslip.com" target="_blank" rel="noopener" className="text-pink underline">developer.easyslip.com</a> — สลิปถูกต้อง (ยอดจริง · เข้าบัญชีวีเจ · ไม่ซ้ำ) ขึ้นจอทันที ไม่ต้องกดยืนยันเอง · ถ้าตั้ง IP whitelist ไว้ ให้ใส่ IP เซิร์ฟเวอร์ VJLiveKit ด้วย</p>
      {st?.fromEnv && <div className="mt-3"><Alert tone="info">ตอนนี้ใช้คีย์จากไฟล์ตั้งค่าเซิร์ฟเวอร์ (EASYSLIP_API_KEY) — ใส่คีย์ที่นี่จะใช้แทน</Alert></div>}
      <div className="mt-4 space-y-3 sm:max-w-lg">
        <Field label="API Key"><Input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="วางคีย์ที่นี่" /></Field>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void save()} loading={busy === 'save'}>บันทึก</Button>
          <Button variant="secondary" onClick={() => void test()} loading={busy === 'test'} disabled={!st?.enabled && !key}>ทดสอบ</Button>
        </div>
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      </div>
    </Card>
  );
}
