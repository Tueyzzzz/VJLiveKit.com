'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { Copy, Upload } from 'lucide-react';
import { Alert, Badge, Button, Card, Spinner, cx } from './ui';
import { api } from '@/lib/api';
import { promptPayPayload } from '@/lib/promptpay';
import { useAuth } from '@/lib/auth';

interface Info {
  enabled: boolean; autoVerify: boolean;
  bankName: string; accountName: string; accountNo: string; promptpay: string;
  options: { months: number; amount: number }[];
}
interface Transfer { id: string; amount: number; status: string; createdAt: string; months: number; note: string | null; auto: boolean }

const STATUS: Record<string, [string, 'mint' | 'pink' | 'gray']> = { PAID: ['สำเร็จ', 'mint'], PENDING: ['รอตรวจสอบ', 'gray'], FAILED: ['ไม่ผ่าน', 'pink'] };

/** โหลดรูป → อ่าน QR บนสลิป (เลขอ้างอิงรายการ) + ย่อเป็น JPEG เพื่ออัปโหลด */
async function readSlip(file: File): Promise<{ dataUrl: string; qr: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const scan = (maxW: number) => {
      const k = Math.min(1, maxW / img.naturalWidth), c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      const g = c.getContext('2d')!; g.drawImage(img, 0, 0, c.width, c.height);
      return { c, code: jsQR(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height) };
    };
    let r = scan(1000); if (!r.code) r = scan(1600); if (!r.code) r = scan(700);
    const out = scan(1200).c;
    return { dataUrl: out.toDataURL('image/jpeg', 0.82), qr: r.code?.data ?? '' };
  } finally { URL.revokeObjectURL(url); }
}

export function TransferPay() {
  const { refresh } = useAuth();
  const [info, setInfo] = useState<Info | null>(null);
  const [months, setMonths] = useState(1);
  const [qrImg, setQrImg] = useState('');
  const [list, setList] = useState<Transfer[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'info' | 'error' | 'success'; text: string } | null>(null);

  const load = () => api<{ transfers: Transfer[] }>('/api/billing/transfer/mine').then((r) => setList(r.transfers)).catch(() => {});
  useEffect(() => { api<Info>('/api/billing/transfer/info').then(setInfo).catch(() => setInfo(null)); load(); }, []);
  const amount = info?.options.find((o) => o.months === months)?.amount ?? 0;
  useEffect(() => {
    if (!info?.promptpay || !amount) return;
    QRCode.toDataURL(promptPayPayload(info.promptpay, amount), { margin: 1, width: 360 }).then(setQrImg).catch(() => setQrImg(''));
  }, [info, amount]);

  if (!info) return null;
  if (!info.enabled) return null;

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setBusy(true); setMsg(null);
    try {
      const { dataUrl, qr } = await readSlip(file);
      const res = await api<{ status: string; message: string }>('/api/billing/transfer', { method: 'POST', body: { months, slip: dataUrl, qr } });
      setMsg({ tone: res.status === 'PAID' ? 'success' : 'info', text: qr ? res.message : `${res.message} (อ่าน QR บนสลิปไม่ได้ — ใช้รูปสลิปเต็มจากแอปธนาคารจะตรวจได้เร็วกว่า)` });
      if (res.status === 'PAID') await refresh();
      load();
    } catch (err) {
      setMsg({ tone: 'error', text: (err as Error).message });
    } finally { setBusy(false); }
  }

  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl">โอนเงิน / พร้อมเพย์</h2>
        <Badge tone={info.autoVerify ? 'mint' : 'gray'}>{info.autoVerify ? 'ตรวจสลิปอัตโนมัติ' : 'แอดมินตรวจสลิป'}</Badge>
      </div>
      <p className="mt-1 text-sm text-muted">เลือกจำนวนเดือน โอนตามยอด แล้วอัปโหลดสลิป — นับต่อจากวันหมดอายุเดิม/ช่วงทดลองฟรี ไม่เสียวันที่เหลือ</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {info.options.map((o) => (
          <button key={o.months} type="button" onClick={() => setMonths(o.months)}
            className={cx('rounded-xl border px-4 py-2 text-sm transition', months === o.months ? 'border-pink bg-pink/10 font-medium text-pink' : 'border-line hover:border-pink/50')}>
            {o.months} เดือน · {o.amount.toLocaleString('th-TH')} บาท
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-[180px_1fr]">
        {info.promptpay && qrImg && (
          <div className="text-center">
            <img src={qrImg} alt="QR พร้อมเพย์" className="mx-auto w-44 rounded-xl border border-line bg-white p-2" />
            <p className="mt-1 text-xs text-muted">สแกนจ่ายพร้อมเพย์ {amount.toLocaleString('th-TH')} บาท</p>
          </div>
        )}
        <div className="space-y-2 text-sm">
          <div className="text-2xl font-semibold text-pink">{amount.toLocaleString('th-TH')} บาท</div>
          {info.accountNo && (
            <div className="flex items-center gap-2">
              <span>{info.bankName || 'บัญชีธนาคาร'}:</span>
              <code className="rounded bg-canvas px-2 py-1">{info.accountNo}</code>
              <button type="button" aria-label="คัดลอกเลขบัญชี" onClick={() => navigator.clipboard?.writeText(info.accountNo)} className="text-muted hover:text-pink"><Copy className="size-4" /></button>
            </div>
          )}
          {info.promptpay && <div>พร้อมเพย์: <code className="rounded bg-canvas px-2 py-1">{info.promptpay}</code></div>}
          {info.accountName && <div className="text-muted">ชื่อบัญชี: {info.accountName}</div>}
          <label className={cx('mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 font-medium text-white brand-gradient', busy && 'pointer-events-none opacity-60')}>
            {busy ? <Spinner /> : <Upload className="size-4" />} อัปโหลดสลิป
            <input type="file" accept="image/*" className="hidden" onChange={onFile} />
          </label>
        </div>
      </div>

      {msg && <div className="mt-4"><Alert tone={msg.tone === 'error' ? undefined : msg.tone === 'success' ? 'success' : 'info'}>{msg.text}</Alert></div>}

      {list.length > 0 && (
        <ul className="mt-5 divide-y divide-line text-sm">
          {list.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>{new Date(t.createdAt).toLocaleString('th-TH')} · {t.months} เดือน · {t.amount.toLocaleString('th-TH')} บาท</span>
              <span className="flex items-center gap-2">
                {t.status === 'PENDING' && t.note && <span className="text-xs text-muted">{t.note}</span>}
                <Badge tone={STATUS[t.status]?.[1] ?? 'gray'}>{STATUS[t.status]?.[0] ?? t.status}{t.auto ? ' (อัตโนมัติ)' : ''}</Badge>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
