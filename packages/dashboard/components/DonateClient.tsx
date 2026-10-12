'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import QRCode from 'qrcode';
import { Alert, Button, Input, Spinner } from './ui';
import { api, ApiError } from '@/lib/api';
import { promptPayPayload, maskPromptPay } from '@/lib/promptpay';
import { toDigits } from './NumberInput';
import { TikTokAvatar } from './TikTokAvatar';
import { bankLogo, bankOf, fmtAccount } from '@/lib/banks';
import { OpenInBrowser } from './OpenInBrowser';
import { translate, useLang, useT } from '@/lib/i18n';

interface PageInfo { name: string; tiktok: string; promptpay: string; bank?: { code: string; account: string; holder: string } | null; min: number; title: string; autoVerify: boolean }
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
    img.onerror = () => reject(new Error(translate('เปิดรูปสลิปไม่ได้')));
    img.src = URL.createObjectURL(file);
  });
}

/** พื้นหลังทั้งหน้า: ไล่สีพาสเทลฟุ้ง ๆ */
function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[radial-gradient(120%_70%_at_50%_0%,#ffe1ef_0%,#f6ecff_45%,#fdf9ff_100%)]">
      <div className="mx-auto max-w-md px-4 pb-12 pt-5">{children}</div>
    </div>
  );
}
/** การ์ดขั้นตอน (เลขวงกลมไล่สี + หัวข้อ) */
function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-white/90 p-4 shadow-[0_10px_30px_-20px_rgba(120,60,160,.45)] ring-1 ring-white">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><span className="grid size-6 place-items-center rounded-full bg-gradient-to-br from-pink to-violet text-xs text-white">{n}</span>{title}</h2>
      {children}
    </section>
  );
}

/** หน้าโดเนทสาธารณะ /donate/?u=<ชื่อ TikTok> — สแกน QR พร้อมเพย์ หรือโอนเข้าบัญชีธนาคารของวีเจ แล้วแนบสลิป */
export function DonateClient() {
  const u = useSearchParams().get('u') ?? '';
  const t = useT();
  const [lang] = useLang();
  const loc = lang === 'en' ? 'en-US' : 'th-TH';
  const [info, setInfo] = useState<PageInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [amount, setAmount] = useState('100');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [slip, setSlip] = useState<File | null>(null);
  const [slipPrev, setSlipPrev] = useState('');
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { status: string; amount?: number }>(null);
  const [pay, setPay] = useState<'qr' | 'bank'>('qr');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!u) { setErr(translate('ลิงก์โดเนทไม่ถูกต้อง')); return; }
    api<PageInfo>(`/api/donate/page?u=${encodeURIComponent(u)}`).then((r) => { setInfo(r); setAmount(String(Math.max(r.min, 100))); if (!r.promptpay && r.bank) setPay('bank'); }).catch((e) => setErr((e as Error).message));
  }, [u]);
  const amt = Number(amount) || 0;
  useEffect(() => {
    if (!info || !info.promptpay) return;
    QRCode.toDataURL(promptPayPayload(info.promptpay, amt > 0 ? amt : undefined), { width: 480, margin: 1, color: { dark: '#2b1a3a', light: '#ffffff' } }).then(setQr).catch(() => setQr(''));
  }, [info, amt]);
  useEffect(() => { if (!slip) { setSlipPrev(''); return; } const p = URL.createObjectURL(slip); setSlipPrev(p); return () => URL.revokeObjectURL(p); }, [slip]);
  const tooLow = useMemo(() => !!info && amt < info.min, [info, amt]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!info || !slip) { setErr(t('แนบสลิปการโอนด้วย')); return; }
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
  const bank = info.bank ? { ...info.bank, meta: bankOf(info.bank.code) } : null;
  const copyAcc = async () => {
    if (!bank) return;
    try { await navigator.clipboard.writeText(bank.account); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { window.prompt(t('คัดลอกเลขบัญชี'), bank.account); }
  };

  // หัวหน้า: ภาพปก (GPT) + รูปโปรไฟล์ TikTok ของวีเจ (คนดูมั่นใจว่าโดเนทถูกคน)
  const header = (
    <div className="overflow-hidden rounded-[28px] bg-white/90 text-center shadow-[0_18px_40px_-22px_rgba(190,60,140,.45)] ring-1 ring-white">
      <div className="relative h-28 bg-gradient-to-r from-pink-soft via-[#ffd9ec] to-violet-soft">
        <img src="/donate-cover.webp" alt="" className="absolute inset-0 h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      </div>
      <div className="relative -mt-12 inline-block">
        <TikTokAvatar username={info.tiktok} size={96} className="shadow-lg ring-4" />
        <span className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full bg-white text-lg shadow">💸</span>
      </div>
      <h1 className="mt-2 px-4 font-display text-2xl">{t('โดเนทให้ {name}', { name: info.name })}</h1>
      <p className="px-4 text-sm text-muted">@{info.tiktok}</p>
      {info.title && <p className="mx-6 mt-3 rounded-2xl bg-pink-soft/60 px-4 py-2 text-sm text-ink">💬 {info.title}</p>}
      <div className="pb-4" />
    </div>
  );

  if (done) return (
    <Shell>
      {header}
      <div className="mt-6 rounded-3xl bg-white/90 p-6 text-center shadow-sm ring-1 ring-white">
        <div className="text-5xl">💖</div>
        <h2 className="mt-3 font-display text-xl">{t('ขอบคุณที่โดเนทให้ {name}!', { name: info.name })}</h2>
        <p className="mt-2 text-sm text-muted">{done.status === 'verified' ? t('ตรวจสลิปผ่านแล้ว ฿{amount} — ชื่อและข้อความของคุณกำลังขึ้นจอไลฟ์ ✨', { amount: (done.amount ?? amt).toLocaleString(loc) }) : t('ส่งสลิปแล้ว — รอวีเจตรวจสอบสักครู่ แล้วชื่อของคุณจะขึ้นจอไลฟ์ ✨')}</p>
        <Button className="mt-5" variant="secondary" onClick={() => { setDone(null); setSlip(null); setMsg(''); }}>{t('โดเนทอีกครั้ง')}</Button>
      </div>
    </Shell>
  );

  return (
    <Shell>
      <OpenInBrowser />
      {header}
      <form onSubmit={submit} className="mt-5 space-y-4">
        <Step n={1} title={t('ชื่อ & ข้อความที่จะขึ้นจอ')}>
          <div className="space-y-3">
            <Input required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('ชื่อเล่น หรือชื่อ TikTok')} />
            <Input maxLength={150} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={t('ข้อความ (ไม่บังคับ) เช่น ส่งกำลังใจ / ขอเพลง')} />
          </div>
        </Step>

        <Step n={2} title={t('จำนวนเงิน (ขั้นต่ำ {min} บาท)', { min: info.min })}>
          <div className="grid grid-cols-3 gap-2">
            {QUICK.filter((q) => q >= info.min).map((q) => (
              <button key={q} type="button" onClick={() => setAmount(String(q))}
                className={`rounded-2xl border-2 py-2.5 text-base font-semibold transition ${amt === q ? 'border-pink bg-gradient-to-br from-pink-soft to-violet-soft text-pink shadow-sm' : 'border-line bg-white text-ink hover:border-pink/40'}`}>฿{q.toLocaleString(loc)}</button>
            ))}
          </div>
          <div className="relative mt-2">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">฿</span>
            <Input className="pl-8 text-lg font-semibold" type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(toDigits(e.target.value, true))} />
          </div>
          {tooLow && <p className="mt-2 text-sm text-pink">{t('ใส่ยอดอย่างน้อย {min} บาท', { min: info.min })}</p>}
        </Step>

        <Step n={3} title={t('โอนเงินเข้าวีเจ')}>
          {info.promptpay && bank && (
            <div className="mb-3 grid grid-cols-2 gap-1 rounded-full bg-canvas p-1 text-sm">
              {(['qr', 'bank'] as const).map((k) => (
                <button key={k} type="button" onClick={() => setPay(k)} className={`rounded-full py-1.5 font-medium transition ${pay === k ? 'bg-white text-pink shadow-sm' : 'text-muted'}`}>{k === 'qr' ? t('📱 สแกน QR พร้อมเพย์') : t('🏦 โอนเข้าบัญชี')}</button>
              ))}
            </div>
          )}
          {pay === 'qr' && info.promptpay ? (
            <div className="text-center">
              <div className="mx-auto w-60 rounded-3xl bg-gradient-to-br from-pink to-violet p-[3px] shadow-md">
                <div className="rounded-[22px] bg-white p-3">
                  {tooLow ? <p className="py-16 text-sm text-pink">{t('ใส่ยอดอย่างน้อย {min} บาท', { min: info.min })}</p> : qr ? <img src={qr} alt={t('QR พร้อมเพย์')} className="mx-auto w-full" /> : <div className="py-16"><Spinner /></div>}
                  <img src={bankLogo('promptpay')} alt="PromptPay" className="mx-auto mt-1 size-12 rounded-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                </div>
              </div>
              <p className="mt-3 text-xs text-muted">{t('พร้อมเพย์ {pp} · ยอด ฿{amount} · เงินเข้าบัญชีวีเจโดยตรง', { pp: maskPromptPay(info.promptpay), amount: amt.toLocaleString(loc) })}</p>
            </div>
          ) : bank ? (
            <>
              <div className="overflow-hidden rounded-2xl text-white shadow-md" style={{ background: `linear-gradient(135deg, ${bank.meta?.color ?? '#7a5cff'}, #2b1a3a)` }}>
                <div className="p-4">
                  <div className="flex items-center gap-2.5">
                    <img src={bankLogo(bank.code)} alt="" className="size-11 shrink-0 rounded-full bg-white object-contain ring-2 ring-white/80 shadow" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    <span className="text-sm font-medium">{t('ธนาคาร')}{bank.meta?.name ?? bank.code}</span>
                  </div>
                  <div className="mt-2 font-mono text-2xl font-bold tracking-wider">{fmtAccount(bank.account)}</div>
                  {bank.holder && <div className="mt-1 text-sm opacity-90">{bank.holder}</div>}
                </div>
                <button type="button" onClick={copyAcc} className="w-full bg-white/15 py-2.5 text-sm font-semibold transition hover:bg-white/25">{copied ? t('คัดลอกแล้ว ✓') : t('📋 คัดลอกเลขบัญชี')}</button>
              </div>
              <p className="mt-2 text-center text-xs text-muted">{t('โอนยอด ฿{amount} แล้วแนบสลิปด้านล่าง', { amount: amt.toLocaleString(loc) })}</p>
            </>
          ) : null}
        </Step>

        <Step n={4} title={t('แนบสลิปการโอน')}>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-pink/40 bg-pink-soft/30 px-4 py-5 text-center text-sm transition hover:bg-pink-soft/50">
            {slipPrev ? <img src={slipPrev} alt="" className="max-h-48 rounded-xl shadow" /> : <span className="text-3xl">🧾</span>}
            <span className="font-medium text-pink">{slip ? t('เปลี่ยนรูปสลิป') : t('แตะเพื่อเลือกรูปสลิป')}</span>
            <input type="file" accept="image/*" required onChange={(e) => setSlip(e.target.files?.[0] ?? null)} className="sr-only" />
          </label>
        </Step>

        {err && <Alert>{err}</Alert>}
        <Button type="submit" className="h-12 w-full rounded-2xl bg-gradient-to-r from-pink to-violet text-base shadow-lg" loading={busy} disabled={tooLow || !slip}>{t('ส่งสลิป & ขึ้นจอ 💖')}</Button>
        <p className="text-center text-[11px] text-muted">{info.autoVerify ? t('ระบบตรวจสลิปอัตโนมัติ ผ่านแล้วขึ้นจอทันที') : t('วีเจจะตรวจสลิป แล้วชื่อของคุณจะขึ้นจอ')} · {t('ให้บริการโดย VJLiveKit (ไม่ได้ถือเงินแทนวีเจ)')}</p>
      </form>
    </Shell>
  );
}
