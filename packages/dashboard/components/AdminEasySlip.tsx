'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Alert, Badge, Button, Card, Field, Input, cx } from './ui';

type Provider = 'easyslip' | 'slipok';
interface St { provider: Provider; key: string; branch: string; fromEnv: boolean; enabled: boolean }

/** หลังบ้าน: ระบบตรวจสลิปโดเนทอัตโนมัติ — เลือก EasySlip (API v2) หรือ SlipOK · คีย์จริงไม่ถูกส่งกลับมาแสดง */
export function AdminEasySlip() {
  const [st, setSt] = useState<St | null>(null);
  const [provider, setProvider] = useState<Provider>('easyslip');
  const [key, setKey] = useState('');
  const [branch, setBranch] = useState('');
  const [busy, setBusy] = useState<'' | 'save' | 'test'>('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const apply = (r: St) => { setSt(r); setProvider(r.provider); setKey(r.key); setBranch(r.branch); };
  useEffect(() => { api<St>('/api/admin/easyslip').then(apply).catch(() => {}); }, []);

  async function save() {
    setBusy('save'); setMsg(null);
    try { apply(await api<St>('/api/admin/easyslip', { method: 'PUT', body: { provider, key, branch } })); setMsg({ tone: 'success', text: 'บันทึกแล้ว ✓ กด “ทดสอบ” เพื่อเช็กคีย์และโควตา' }); }
    catch (e) { setMsg({ tone: 'error', text: (e as Error).message }); } finally { setBusy(''); }
  }
  async function test() {
    setBusy('test'); setMsg(null);
    try {
      const r = await api<{ ok: boolean; error?: string; info?: Record<string, unknown> }>('/api/admin/easyslip/test', { method: 'POST' });
      setMsg(r.ok ? { tone: 'success', text: 'ใช้ได้ ✓ ' + (r.info ? JSON.stringify(r.info).slice(0, 300) : '') } : { tone: 'error', text: r.error ?? 'ใช้ไม่ได้' });
    } catch (e) { setMsg({ tone: 'error', text: (e as Error).message }); } finally { setBusy(''); }
  }

  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-medium">🧾 ตรวจสลิปโดเนทอัตโนมัติ</h2>
        {st && <Badge tone={st.enabled ? 'mint' : 'gray'}>{st.enabled ? `เปิดใช้งาน (${st.provider === 'slipok' ? 'SlipOK' : 'EasySlip'})` : 'ปิดอยู่'}</Badge>}
      </div>
      <p className="mt-1 text-sm text-muted">สลิปถูกต้อง (ยอดจริง · เข้าบัญชีวีเจ · ไม่ซ้ำ) ขึ้นจอทันที ไม่ต้องกดยืนยันเอง · ถ้าระบบตรวจขัดข้อง โดเนทไม่หาย จะรอวีเจกดยืนยันแทน</p>
      <div className="mt-4 grid max-w-lg grid-cols-2 gap-2">
        {(['easyslip', 'slipok'] as const).map((p) => (
          <button key={p} type="button" onClick={() => setProvider(p)}
            className={cx('rounded-xl border-2 px-3 py-2 text-left text-sm transition', provider === p ? 'border-pink bg-pink-soft/50' : 'border-line bg-white hover:border-pink/40')}>
            <div className="font-semibold">{p === 'slipok' ? 'SlipOK' : 'EasySlip'}</div>
            <div className="text-xs text-muted">{p === 'slipok' ? 'ฟรี 100 สลิป/เดือน · slipok.com' : 'API v2 · developer.easyslip.com'}</div>
          </button>
        ))}
      </div>
      {st?.fromEnv && provider === 'easyslip' && <div className="mt-3"><Alert tone="info">ตอนนี้ใช้คีย์ EasySlip จากไฟล์ตั้งค่าเซิร์ฟเวอร์ (EASYSLIP_API_KEY) — ใส่คีย์ที่นี่จะใช้แทน</Alert></div>}
      <div className="mt-4 space-y-3 sm:max-w-lg">
        {provider === 'slipok' && (
          <Field label="Branch ID" hint="ดูได้ในหน้าจัดการร้าน SlipOK (เลขสาขา ใช้ในลิงก์ API)">
            <Input autoComplete="off" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="เช่น 12345" />
          </Field>
        )}
        <Field label="API Key"><Input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="วางคีย์ที่นี่" /></Field>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void save()} loading={busy === 'save'}>บันทึก</Button>
          <Button variant="secondary" onClick={() => void test()} loading={busy === 'test'}>ทดสอบ</Button>
        </div>
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      </div>
    </Card>
  );
}
