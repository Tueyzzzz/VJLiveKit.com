'use client';

import { useEffect, useState, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { X } from 'lucide-react';
import { Alert, Button, Spinner } from './ui';
import { api, ApiError, type Plan } from '@/lib/api';
import { promptPayPayload } from '@/lib/promptpay';
import { bankLogo, bankOf, fmtAccount } from '@/lib/banks';
import { translate, useLang, useT } from '@/lib/i18n';

export interface SlipPayInfo { enabled: boolean; promptpay: string; bank: { code: string; account: string; holder: string } | null; autoVerify: boolean; days: number; mascotPriceCents?: number; mascotFullCents?: number; firstMonthPct?: number }

/** บัญชีรับเงินที่แอดมินตั้งไว้ (null = ยังโหลด / ไม่เปิด) — ใช้ตัดสินว่าปุ่มเลือกแพลนเปิดหน้าโอนหรือแชท */
export function useSlipPay(): SlipPayInfo | null {
  const [info, setInfo] = useState<SlipPayInfo | null>(null);
  useEffect(() => { api<SlipPayInfo>('/api/billing/slip/info').then(setInfo).catch(() => setInfo(null)); }, []);
  return info;
}

/** ย่อรูปสลิปก่อนส่ง (≤1600px JPEG) — เร็วขึ้น และไม่เกินขนาดที่เซิร์ฟเวอร์รับ */
function shrink(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.9)); URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error(translate('เปิดรูปสลิปไม่ได้')));
    img.src = URL.createObjectURL(file);
  });
}

/** การ์ดขั้นตอน (เลขวงกลมไล่สี + หัวข้อ) — สไตล์เดียวกับหน้าโดเนท */
function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-white/90 p-4 shadow-[0_10px_30px_-20px_rgba(120,60,160,.45)] ring-1 ring-white">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><span className="grid size-6 place-items-center rounded-full bg-gradient-to-br from-pink to-violet text-xs text-white">{n}</span>{title}</h3>
      {children}
    </section>
  );
}

/** หน้าชำระค่าแพลนด้วยการโอน (QR พร้อมเพย์ยอดตรง / บัญชีธนาคาร) + แนบสลิป → ตรวจอัตโนมัติ หรือรอแอดมิน */
export function SlipPaySheet({ plan, info, onClose, onPaid, mascot = false }: { plan: Pick<Plan, 'code' | 'name' | 'priceCents'>; info: SlipPayInfo; onClose: () => void; onPaid: () => void; /** สั่งทำมาสคอต: เพิ่มขั้นแนบรูปหน้า + สไตล์ */ mascot?: boolean }) {
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPrev, setPhotoPrev] = useState<string[]>([]);
  const [note, setNote] = useState('');
  useEffect(() => { const u = photos.map((f) => URL.createObjectURL(f)); setPhotoPrev(u); return () => u.forEach((x) => URL.revokeObjectURL(x)); }, [photos]);
  const t = useT();
  const [lang] = useLang();
  const loc = lang === 'en' ? 'en-US' : 'th-TH';
  const baht = plan.priceCents / 100;
  const [pay, setPay] = useState<'qr' | 'bank'>(info.promptpay ? 'qr' : 'bank');
  const [qr, setQr] = useState('');
  const [slip, setSlip] = useState<File | null>(null);
  const [slipPrev, setSlipPrev] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [canManual, setCanManual] = useState(false);
  const [copied, setCopied] = useState(false);
  const [done, setDone] = useState<null | { status: 'paid' | 'pending'; periodEnd?: string }>(null);

  useEffect(() => {
    if (!info.promptpay) return;
    QRCode.toDataURL(promptPayPayload(info.promptpay, baht), { width: 560, margin: 1, color: { dark: '#2b1a3a', light: '#ffffff' } }).then(setQr).catch(() => setQr(''));
  }, [info.promptpay, baht]);
  useEffect(() => { if (!slip) { setSlipPrev(''); return; } const p = URL.createObjectURL(slip); setSlipPrev(p); return () => URL.revokeObjectURL(p); }, [slip]);
  // ล็อกการเลื่อนหน้าหลังตอนเปิด + Esc ปิด
  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [busy, onClose]);

  async function submit(manual = false) {
    if (mascot && !photos.length) { setErr(t('แนบรูปหน้าตัวเองอย่างน้อย 1 รูป')); return; }
    if (!slip) { setErr(t('แนบสลิปการโอนด้วย')); return; }
    setBusy(true); setErr(null); setCanManual(false);
    try {
      const data = await shrink(slip);
      const extra = mascot ? { photos: await Promise.all(photos.map(shrink)), note } : {};
      const r = await api<{ status: 'paid' | 'pending'; periodEnd?: string }>('/api/billing/slip', { method: 'POST', body: { planCode: plan.code, slip: data, manual, ...extra } });
      setDone(r);
      if (r.status === 'paid') onPaid();
    } catch (e) {
      setErr((e as Error).message);
      setCanManual(e instanceof ApiError && e.data.canManual === true);
    } finally { setBusy(false); }
  }

  const bank = info.bank ? { ...info.bank, meta: bankOf(info.bank.code) } : null;
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { window.prompt(t('คัดลอกเลขบัญชี'), text); }
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center bg-[#2b1a3a]/40 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" onClick={() => { if (!busy) onClose(); }}>
      <div className="relative max-h-[94dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-[radial-gradient(120%_70%_at_50%_0%,#ffe1ef_0%,#f6ecff_45%,#fdf9ff_100%)] px-4 pb-6 pt-4 shadow-2xl sm:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-ink/15 sm:hidden" />
        <button type="button" onClick={onClose} disabled={busy} aria-label={t('ปิด')} className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-white/80 text-muted shadow-sm transition hover:text-ink"><X className="size-4" /></button>

        {/* หัว: แพลน + ยอดที่ต้องโอน */}
        <div className="mb-4 rounded-[24px] bg-white/90 px-4 py-4 text-center shadow-[0_18px_40px_-22px_rgba(190,60,140,.45)] ring-1 ring-white">
          <div className="text-xs font-medium text-muted">{mascot ? t('สั่งทำ') : t('ชำระค่าแพลน')}</div>
          <h2 className="font-display text-xl">{t(plan.name)}</h2>
          <div className="mt-1 bg-gradient-to-r from-pink to-violet bg-clip-text font-display text-4xl font-bold text-transparent">฿{baht.toLocaleString(loc)}</div>
          <div className="text-xs text-muted">{mascot
            ? <>{info.mascotFullCents && info.mascotFullCents > plan.priceCents ? <><s>฿{(info.mascotFullCents / 100).toLocaleString(loc)}</s> {t('ส่วนลดตามแพลน')} · </> : null}{t('ทีมงานวาดตัวแทนวีเจจากรูปคุณ ครบทุกท่า · จ่ายครั้งเดียว ใช้ได้ตลอด')}</>
            : t('ใช้งานได้ {days} วัน · ไม่ตัดเงินอัตโนมัติ', { days: info.days })}</div>
        </div>

        {done ? (
          <div className="rounded-3xl bg-white/90 p-6 text-center shadow-sm ring-1 ring-white">
            <div className="text-5xl">{done.status === 'paid' ? '🎉' : '⏳'}</div>
            <h3 className="mt-3 font-display text-xl">{done.status === 'paid' ? t('ชำระเงินสำเร็จ!') : t('ส่งสลิปแล้ว รอแอดมินตรวจ')}</h3>
            <p className="mt-2 text-sm text-muted">
              {mascot ? t('ทีมงานได้รับรูปและรายละเอียดแล้ว จะเริ่มวาดมาสคอตให้ — ติดตาม/คุยรายละเอียดได้ที่แชททีมงาน ทำเสร็จแล้วจะขึ้นใน “ตัวแทนวีเจ → ⭐ มาสคอตของฉัน”')
              : done.status === 'paid'
                ? t('เปิดแพลน {plan} ให้แล้ว ใช้ได้ถึง {date} ✨', { plan: t(plan.name), date: done.periodEnd ? new Date(done.periodEnd).toLocaleDateString(loc, { dateStyle: 'long' }) : '-' })
                : t('ทีมงานจะตรวจสลิปและเปิดแพลนให้โดยเร็ว (ปกติไม่เกินไม่กี่ชั่วโมง) — ดูสถานะได้ที่ประวัติการชำระเงิน')}
            </p>
            <Button className="mt-5" onClick={onClose}>{t('เรียบร้อย')}</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {mascot && (
              <Step n={1} title={t('รูปหน้าตัวเอง + สไตล์ที่อยากได้')}>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-violet/40 bg-violet-soft/30 px-4 py-4 text-center text-sm transition hover:bg-violet-soft/50">
                  {photoPrev.length ? <div className="flex gap-2">{photoPrev.map((u) => <img key={u} src={u} alt="" className="size-20 rounded-xl object-cover shadow" />)}</div> : <span className="text-3xl">🤳</span>}
                  <span className="font-medium text-violet">{photos.length ? t('เปลี่ยนรูป') : t('แตะเพื่อเลือกรูปหน้า 1–3 รูป (เห็นหน้าชัด ๆ)')}</span>
                  <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => { setPhotos([...(e.target.files ?? [])].slice(0, 3)); setErr(null); }} className="sr-only" />
                </label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder={t('สไตล์ที่อยากได้ เช่น ผมยาวสีชมพู ใส่ชุดเดรส ถือไมค์')}
                  className="mt-3 w-full rounded-2xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-pink" />
              </Step>
            )}
            <Step n={mascot ? 2 : 1} title={t('โอนเงิน ฿{amount}', { amount: baht.toLocaleString(loc) })}>
              {info.promptpay && bank && (
                <div className="mb-3 grid grid-cols-2 gap-1 rounded-full bg-canvas p-1 text-sm">
                  {(['qr', 'bank'] as const).map((k) => (
                    <button key={k} type="button" onClick={() => setPay(k)} className={`rounded-full py-1.5 font-medium transition ${pay === k ? 'bg-white text-pink shadow-sm' : 'text-muted'}`}>{k === 'qr' ? t('📱 สแกน QR') : t('🏦 โอนเข้าบัญชี')}</button>
                  ))}
                </div>
              )}
              {pay === 'qr' && info.promptpay ? (
                <div className="text-center">
                  <div className="mx-auto w-64 max-w-full rounded-3xl bg-gradient-to-br from-pink to-violet p-[3px] shadow-md">
                    <div className="rounded-[22px] bg-white p-3">
                      {qr ? <img src={qr} alt={t('QR พร้อมเพย์')} className="mx-auto w-full" /> : <div className="py-16"><Spinner /></div>}
                      <img src={bankLogo('promptpay')} alt="PromptPay" className="mx-auto mt-1 h-8 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted">{t('สแกนด้วยแอปธนาคารไหนก็ได้ · ยอด ฿{amount} ใส่ให้แล้ว', { amount: baht.toLocaleString(loc) })}</p>
                  <p className="text-xs text-muted">{t('พร้อมเพย์ {pp}', { pp: info.promptpay })}</p>
                </div>
              ) : bank ? (
                <>
                  <div className="overflow-hidden rounded-2xl text-white shadow-md" style={{ background: `linear-gradient(135deg, ${bank.meta?.color ?? '#7a5cff'}, #2b1a3a)` }}>
                    <div className="p-4">
                      <div className="flex items-center gap-2.5">
                        <img src={bankLogo(bank.code)} alt="" className="size-11 shrink-0 rounded-full bg-white object-contain shadow ring-2 ring-white/80" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        <span className="text-sm font-medium">{t('ธนาคาร')}{bank.meta?.name ?? bank.code}</span>
                      </div>
                      <div className="mt-2 break-all font-mono text-2xl font-bold tracking-wider">{fmtAccount(bank.account)}</div>
                      {bank.holder && <div className="mt-1 text-sm opacity-90">{bank.holder}</div>}
                    </div>
                    <button type="button" onClick={() => void copy(bank.account)} className="w-full bg-white/15 py-2.5 text-sm font-semibold transition hover:bg-white/25">{copied ? t('คัดลอกแล้ว ✓') : t('📋 คัดลอกเลขบัญชี')}</button>
                  </div>
                  <p className="mt-2 text-center text-xs text-muted">{t('โอนยอด ฿{amount} แล้วแนบสลิปด้านล่าง', { amount: baht.toLocaleString(loc) })}</p>
                </>
              ) : null}
            </Step>

            <Step n={mascot ? 3 : 2} title={t('แนบสลิปการโอน')}>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-pink/40 bg-pink-soft/30 px-4 py-5 text-center text-sm transition hover:bg-pink-soft/50">
                {slipPrev ? <img src={slipPrev} alt="" className="max-h-56 rounded-xl shadow" /> : <span className="text-3xl">🧾</span>}
                <span className="font-medium text-pink">{slip ? t('เปลี่ยนรูปสลิป') : t('แตะเพื่อเลือกรูปสลิป')}</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { setSlip(e.target.files?.[0] ?? null); setErr(null); setCanManual(false); }} className="sr-only" />
              </label>
            </Step>

            {err && <Alert>{err}</Alert>}
            {canManual && (
              <Button variant="secondary" className="w-full" loading={busy} onClick={() => void submit(true)}>{t('ส่งให้แอดมินตรวจแทน')}</Button>
            )}
            <Button className="h-12 w-full rounded-2xl bg-gradient-to-r from-pink to-violet text-base shadow-lg" loading={busy} disabled={!slip} onClick={() => void submit(false)}>{mascot ? t('ส่งสลิป & สั่งทำมาสคอต') : t('ส่งสลิป & เปิดแพลน')}</Button>
            <p className="text-center text-[11px] text-muted">{mascot ? t('ทีมงานได้รับรูป + สลิปแล้วเริ่มวาดให้') : info.autoVerify ? t('ระบบตรวจสลิปอัตโนมัติ ผ่านแล้วเปิดแพลนทันที') : t('ทีมงานจะตรวจสลิปแล้วเปิดแพลนให้')} · {t('สลิปถูกเก็บไว้เป็นหลักฐาน เงินไม่หายแน่นอน')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
