'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import QRCode from 'qrcode';
import { Alert, Button, Card, Field, Input, Spinner } from './ui';
import { api, ApiError } from '@/lib/api';
import { promptPayPayload, maskPromptPay } from '@/lib/promptpay';
import { toDigits } from './NumberInput';

interface PageInfo { name: string; tiktok: string; promptpay: string; min: number; title: string; autoVerify: boolean }
const QUICK = [20, 50, 100, 300, 500, 1000];

/** ย่อรูปสลิปก่อนส่ง (≤1600px JPEG) — เร็วขึ้น และไม่เกินขนาดที่เซิร์ฟเวอร์รับ */
function shrink(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.88)); URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('เปิดรูปสลิปไม่ได้'));
    img.src = URL.createObjectURL(file);
  });
}

/** หน้าโดเนทสาธารณะ /donate/?u=<ชื่อ TikTok> — สแกน QR พร้อมเพย์ของวีเจ แล้วแนบสลิป */
export function DonateClient() {
  const u = useSearchParams().get('u') ?? '';
  const [info, setInfo] = useState<PageInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [amount, setAmount] = useState('100');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [slip, setSlip] = useState<File | null>(null);
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { status: string; amount?: number }>(null);

  useEffect(() => {
    if (!u) { setErr('ลิงก์โดเนทไม่ถูกต้อง'); return; }
    api<PageInfo>(`/api/donate/page?u=${encodeURIComponent(u)}`).then((r) => { setInfo(r); setAmount(String(Math.max(r.min, 100))); }).catch((e) => setErr((e as Error).message));
  }, [u]);
  const amt = Number(amount) || 0;
  useEffect(() => {
    if (!info) return;
    QRCode.toDataURL(promptPayPayload(info.promptpay, amt > 0 ? amt : undefined), { width: 480, margin: 1, color: { dark: '#2b1a3a', light: '#ffffff' } }).then(setQr).catch(() => setQr(''));
  }, [info, amt]);
  const tooLow = useMemo(() => !!info && amt < info.min, [info, amt]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!info || !slip) { setErr('แนบสลิปการโอนด้วย'); return; }
    setBusy(true); setErr(null);
    try {
      const data = await shrink(slip);
      const r = await api<{ status: string; amount?: number }>('/api/donate/submit', { method: 'POST', body: { u, name: name.trim(), message: msg.trim(), amount: amt, slip: data } });
      setDone(r);
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : (e2 as Error).message);
    } finally { setBusy(false); }
  }

  if (err && !info) return <div className="mx-auto max-w-md px-4 py-16"><Alert>{err}</Alert></div>;
  if (!info) return <div className="grid min-h-dvh place-items-center"><Spinner /></div>;
  if (done) return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="text-6xl">💖</div>
      <h1 className="mt-4 font-display text-2xl">ขอบคุณที่โดเนทให้ {info.name}!</h1>
      <p className="mt-3 text-muted">{done.status === 'verified' ? `ตรวจสลิปผ่านแล้ว ฿${(done.amount ?? amt).toLocaleString('th-TH')} — ชื่อและข้อความของคุณกำลังขึ้นจอไลฟ์ ✨` : 'ส่งสลิปแล้ว — รอวีเจตรวจสอบสักครู่ แล้วชื่อของคุณจะขึ้นจอไลฟ์ ✨'}</p>
      <Button className="mt-6" variant="secondary" onClick={() => { setDone(null); setSlip(null); setMsg(''); }}>โดเนทอีกครั้ง</Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <div className="text-center">
        <div className="text-5xl">💸</div>
        <h1 className="mt-2 font-display text-2xl">โดเนทให้ {info.name}</h1>
        <p className="text-sm text-muted">@{info.tiktok}{info.title ? ` · ${info.title}` : ''}</p>
      </div>
      <Card className="mt-6">
        <form onSubmit={submit} className="space-y-4">
          <Field label="ชื่อที่จะขึ้นจอ"><Input required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อเล่น หรือชื่อ TikTok" /></Field>
          <Field label={`จำนวนเงิน (ขั้นต่ำ ${info.min} บาท)`}>
            <div className="mb-2 flex flex-wrap gap-2">
              {QUICK.filter((q) => q >= info.min).map((q) => (
                <button key={q} type="button" onClick={() => setAmount(String(q))} className={`rounded-full border px-3 py-1 text-sm ${amt === q ? 'border-pink bg-pink-soft text-pink' : 'border-line bg-white'}`}>฿{q}</button>
              ))}
            </div>
            <Input type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(toDigits(e.target.value, true))} />
          </Field>
          <Field label="ข้อความ (ไม่บังคับ)"><Input maxLength={150} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="ส่งกำลังใจ / ขอเพลง" /></Field>

          <div className="rounded-2xl border border-line bg-canvas/60 p-4 text-center">
            <p className="text-sm font-medium">1) สแกนจ่ายผ่านแอปธนาคาร (พร้อมเพย์)</p>
            {tooLow ? <p className="mt-3 text-sm text-pink">ใส่ยอดอย่างน้อย {info.min} บาท</p> : qr ? <img src={qr} alt="QR พร้อมเพย์" className="mx-auto mt-3 w-56 rounded-xl" /> : <Spinner />}
            <p className="mt-2 text-xs text-muted">พร้อมเพย์ {maskPromptPay(info.promptpay)} · ยอด ฿{amt.toLocaleString('th-TH')} · เงินเข้าบัญชีวีเจโดยตรง</p>
          </div>
          <Field label="2) แนบสลิปการโอน">
            <input type="file" accept="image/*" required onChange={(e) => setSlip(e.target.files?.[0] ?? null)} className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-pink-soft file:px-4 file:py-2 file:text-pink" />
          </Field>
          {err && <Alert>{err}</Alert>}
          <Button type="submit" className="w-full" loading={busy} disabled={tooLow || !slip}>ส่งสลิป & ขึ้นจอ 💖</Button>
          <p className="text-center text-[11px] text-muted">{info.autoVerify ? 'ระบบตรวจสลิปอัตโนมัติ ผ่านแล้วขึ้นจอทันที' : 'วีเจจะตรวจสลิป แล้วชื่อของคุณจะขึ้นจอ'} · ให้บริการโดย VJLiveKit (ไม่ได้ถือเงินแทนวีเจ)</p>
        </form>
      </Card>
    </div>
  );
}
