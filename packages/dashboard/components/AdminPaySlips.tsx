'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { BANKS, bankLogo, fmtAccount } from '@/lib/banks';
import { Alert, Badge, Button, Card, Field, Input, Select, Spinner } from './ui';

interface Account { promptpay: string; bank: string; bankAccount: string; bankHolder: string }
interface SlipRow {
  id: string; providerRef: string; amountCents: number; status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'; createdAt: string;
  rawPayload: { slipId?: string; planCode?: string; planName?: string; priceCents?: number; slipAmount?: number; ref?: string; auto?: boolean; note?: string; periodEnd?: string } | null;
  user: { id: string; email: string; tiktokUsername: string | null };
}

/** หลังบ้าน: บัญชีรับเงินค่าแพลน (โอน + แนบสลิป) — พร้อมเพย์ / บัญชีธนาคาร · ลูกค้าเห็นข้อมูลนี้ในหน้าชำระเงิน */
export function AdminPayAccount() {
  const [f, setF] = useState<Account | null>(null);
  const [st, setSt] = useState<{ enabled: boolean; autoVerify: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  useEffect(() => { api<{ account: Account; enabled: boolean; autoVerify: boolean }>('/api/admin/payaccount').then((r) => { setF(r.account); setSt(r); }).catch((e) => setMsg({ tone: 'error', text: (e as Error).message })); }, []);

  async function save() {
    if (!f) return;
    setBusy(true); setMsg(null);
    try {
      const r = await api<{ account: Account; enabled: boolean; autoVerify: boolean }>('/api/admin/payaccount', { method: 'PUT', body: f });
      setF(r.account); setSt(r); setMsg({ tone: 'success', text: r.enabled ? 'บันทึกแล้ว ✓ ลูกค้าเลือกแพลนแล้วจะขึ้นหน้าโอน + แนบสลิป' : 'บันทึกแล้ว — ยังไม่มีบัญชีรับเงิน ลูกค้าจะถูกส่งไปแชทแทน' });
    } catch (e) { setMsg({ tone: 'error', text: (e as Error).message }); } finally { setBusy(false); }
  }

  const set = (k: keyof Account, v: string) => setF((x) => (x ? { ...x, [k]: v } : x));
  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-medium">🏦 บัญชีรับเงินค่าแพลน (โอน + สลิป)</h2>
        {st && <Badge tone={st.enabled ? 'mint' : 'gray'}>{st.enabled ? 'เปิดรับโอน' : 'ปิดอยู่'}</Badge>}
        {st && <Badge tone={st.autoVerify ? 'violet' : 'gray'}>{st.autoVerify ? 'ตรวจสลิปอัตโนมัติ' : 'ตรวจสลิปเอง (ยังไม่ใส่คีย์)'}</Badge>}
      </div>
      <p className="mt-1 text-sm text-muted">ใช้ตอนยังไม่เปิดตัดบัตร Stripe — ลูกค้าสแกน QR พร้อมเพย์ (ยอดตรงราคาแพลน) หรือโอนเข้าบัญชี แล้วแนบสลิป · ตรวจผ่าน (ยอดครบ · เข้าบัญชีนี้ · ไม่ซ้ำ) เปิดแพลน 30 วันทันที · ตรวจไม่ได้ = รอแอดมินอนุมัติด้านล่าง · คีย์ตรวจสลิปตั้งที่แท็บ “เมลเซิร์ฟเวอร์”</p>
      {!f ? <div className="mt-4"><Spinner /></div> : (
        <div className="mt-4 grid gap-3 sm:max-w-2xl sm:grid-cols-2">
          <Field label="พร้อมเพย์" hint="เบอร์มือถือ 10 หลัก / เลขบัตรหรือเลขผู้เสียภาษี 13 หลัก (เว้นว่าง = ไม่ใช้)">
            <Input inputMode="numeric" autoComplete="off" value={f.promptpay} onChange={(e) => set('promptpay', e.target.value)} placeholder="เช่น 08x-xxx-xxxx" />
          </Field>
          <Field label="ธนาคาร">
            <Select value={f.bank} onChange={(e) => set('bank', e.target.value)}>
              <option value="">— ไม่ใช้บัญชีธนาคาร —</option>
              {BANKS.map((b) => <option key={b.code} value={b.code}>{b.name} ({b.abbr})</option>)}
            </Select>
          </Field>
          <Field label="เลขบัญชี">
            <Input inputMode="numeric" autoComplete="off" value={f.bankAccount} onChange={(e) => set('bankAccount', e.target.value)} placeholder="10–15 หลัก" />
          </Field>
          <Field label="ชื่อบัญชี">
            <Input autoComplete="off" maxLength={80} value={f.bankHolder} onChange={(e) => set('bankHolder', e.target.value)} placeholder="ชื่อที่แสดงในแอปธนาคาร" />
          </Field>
          {f.bank && f.bankAccount && (
            <div className="flex items-center gap-2 rounded-xl bg-canvas px-3 py-2 text-sm sm:col-span-2">
              <img src={bankLogo(f.bank)} alt="" className="size-7 rounded-full bg-white object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              <span className="font-mono">{fmtAccount(f.bankAccount.replace(/\D/g, ''))}</span><span className="text-muted">{f.bankHolder}</span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <Button onClick={() => void save()} loading={busy}>บันทึก</Button>
          </div>
          {msg && <div className="sm:col-span-2"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
        </div>
      )}
    </Card>
  );
}

/** หลังบ้าน: สลิปค่าแพลนที่รอตรวจ — ดูรูปสลิป · อนุมัติ (เปิดแพลน 30 วัน) / ปฏิเสธ */
export function AdminPaySlips({ onUser, onChange }: { onUser?: (id: string) => void; onChange?: () => void }) {
  const [status, setStatus] = useState<'PENDING' | 'ALL'>('PENDING');
  const [rows, setRows] = useState<SlipRow[] | null>(null);
  const [pending, setPending] = useState(0);
  const [img, setImg] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ slips: SlipRow[]; pending: number }>(`/api/admin/payslips?status=${status}`).then((r) => { setRows(r.slips); setPending(r.pending); }).catch((e) => setErr((e as Error).message));
  }, [status]);
  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);

  async function view(id: string) {
    if (img[id]) { setImg((m) => { const n = { ...m }; delete n[id]; return n; }); return; }
    const r = await fetch(`/api/admin/payslips/${id}/image`, { headers: { Authorization: `Bearer ${getToken() ?? ''}` } });
    if (!r.ok) { setErr('เปิดรูปสลิปไม่ได้'); return; }
    const url = URL.createObjectURL(await r.blob());
    setImg((m) => ({ ...m, [id]: url }));
  }
  async function act(row: SlipRow, a: 'approve' | 'reject') {
    const plan = row.rawPayload?.planName ?? row.rawPayload?.planCode ?? '';
    if (!window.confirm(a === 'approve' ? `อนุมัติสลิป ฿${row.amountCents / 100} และเปิดแพลน ${plan} 30 วันให้ ${row.user.email}?` : `ปฏิเสธสลิปของ ${row.user.email}?`)) return;
    setBusy(row.id + a); setErr(null);
    try { await api(`/api/admin/payslips/${row.id}/${a}`, { method: 'POST' }); load(); onChange?.(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(''); }
  }

  return (
    <Card className="mb-6 p-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <h2 className="font-medium">🧾 สลิปค่าแพลน</h2>
        {pending > 0 && <Badge tone="pink">รอตรวจ {pending}</Badge>}
        <div className="ml-auto flex gap-1">
          {(['PENDING', 'ALL'] as const).map((k) => (
            <Button key={k} variant={status === k ? 'primary' : 'secondary'} className="h-8 px-3 text-xs" onClick={() => setStatus(k)}>{k === 'PENDING' ? 'รอตรวจ' : 'ทั้งหมด'}</Button>
          ))}
        </div>
      </div>
      {err && <div className="px-4 pt-3"><Alert>{err}</Alert></div>}
      {!rows ? <div className="p-6"><Spinner /></div> : rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted">{status === 'PENDING' ? 'ไม่มีสลิปรอตรวจ ✓' : 'ยังไม่มีสลิป'}</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => {
            const raw = r.rawPayload ?? {};
            return (
              <li key={r.id} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <div className="min-w-0 flex-1">
                    <button onClick={() => onUser?.(r.user.id)} className="break-all text-left font-medium hover:text-pink hover:underline">{r.user.email}</button>
                    {r.user.tiktokUsername && <span className="ml-1 text-xs text-muted">@{r.user.tiktokUsername}</span>}
                    <div className="text-xs text-muted">{new Date(r.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })} · {raw.planName ?? raw.planCode} (ราคา ฿{(raw.priceCents ?? 0) / 100}) {raw.ref && <>· อ้างอิง <span className="font-mono">{raw.ref}</span></>}</div>
                    {raw.note && <div className="mt-0.5 text-xs text-pink">{raw.note}</div>}
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">฿{(r.amountCents / 100).toLocaleString('th-TH')}</div>
                    <Badge tone={r.status === 'PAID' ? 'mint' : r.status === 'PENDING' ? 'violet' : 'gray'}>{r.status === 'PAID' ? (raw.auto ? 'ผ่านอัตโนมัติ' : 'อนุมัติแล้ว') : r.status === 'PENDING' ? 'รอตรวจ' : 'ปฏิเสธ'}</Badge>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {raw.slipId && <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => void view(r.id)}>{img[r.id] ? 'ซ่อนสลิป' : 'ดูสลิป'}</Button>}
                  {r.status === 'PENDING' && <>
                    <Button className="h-8 px-3 text-xs" loading={busy === r.id + 'approve'} onClick={() => void act(r, 'approve')}>อนุมัติ + เปิดแพลน</Button>
                    <Button variant="secondary" className="h-8 px-3 text-xs" loading={busy === r.id + 'reject'} onClick={() => void act(r, 'reject')}>ปฏิเสธ</Button>
                  </>}
                </div>
                {img[r.id] && <img src={img[r.id]} alt="สลิป" className="mt-2 max-h-[70vh] max-w-full rounded-xl border border-line" />}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
