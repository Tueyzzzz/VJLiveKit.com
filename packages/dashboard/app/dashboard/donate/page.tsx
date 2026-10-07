'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Eye, Play, RefreshCw, Settings, X } from 'lucide-react';
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Spinner } from '@/components/ui';
import { NumberInput } from '@/components/NumberInput';
import { api, getToken, type OverlayTokenRow } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { maskPromptPay } from '@/lib/promptpay';
import { useLang, useT } from '@/lib/i18n';

interface Donation { id: string; name: string; message: string; amount: number; status: 'pending' | 'verified' | 'rejected'; auto: boolean; note?: string; createdAt: string; hasSlip: boolean }
interface ListRes { donations: Donation[]; autoVerify: boolean; totals: { today: number; all: number; pending: number } }

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [ok, setOk] = useState(false);
  const t = useT();
  return (
    <Button variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(text); } catch { window.prompt(t('คัดลอกลิงก์นี้'), text); return; } setOk(true); setTimeout(() => setOk(false), 1500); }}>
      {ok ? <><Check className="size-4 text-mint" /> {t('คัดลอกแล้ว')}</> : <><Copy className="size-4" /> {label}</>}
    </Button>
  );
}

/** เมนูโดเนท: ตั้งพร้อมเพย์ · ลิงก์หน้าโดเนท + ลิงก์วิดเจ็ต · รายการโดเนท (ยืนยัน/ปฏิเสธ/เล่นซ้ำ) */
export default function DonateDashboard() {
  const { user, entitlements } = useAuth();
  const t = useT();
  const [lang] = useLang();
  const loc = lang === 'en' ? 'en-US' : 'th-TH';
  const [cfg, setCfg] = useState<Record<string, unknown> | null>(null);
  const [pp, setPp] = useState('');
  const [min, setMin] = useState(10);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [overlayUrl, setOverlayUrl] = useState<string | null | undefined>(undefined);
  const [list, setList] = useState<ListRes | null>(null);
  const [slipUrl, setSlipUrl] = useState<string | null>(null);

  useEffect(() => {
    api<{ config: Record<string, unknown> }>('/api/widgets/donate/config').then((r) => {
      const c = r.config ?? {}; setCfg(c); setPp(String(c.promptpay ?? '')); setMin(Number(c.min ?? 10) || 10); setTitle(String(c.title ?? ''));
    }).catch(() => setCfg({}));
    api<{ tokens: OverlayTokenRow[] }>('/api/overlay-tokens').then((r) => setOverlayUrl(r.tokens[0]?.urls.find((u) => u.type === 'donate')?.url ?? null)).catch(() => setOverlayUrl(null));
  }, []);
  const load = useCallback(() => { api<ListRes>('/api/donations').then(setList).catch(() => setList({ donations: [], autoVerify: false, totals: { today: 0, all: 0, pending: 0 } })); }, []);
  useEffect(() => { load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, [load]); // รายการใหม่เข้ามาเอง

  async function save() {
    const d = pp.replace(/\D/g, '');
    if (d.length !== 10 && d.length !== 13 && d.length !== 15) { setMsg({ tone: 'error', text: t('พร้อมเพย์ต้องเป็นเบอร์มือถือ 10 หลัก เลขบัตรประชาชน 13 หลัก หรือ e-Wallet 15 หลัก') }); return; }
    setSaving(true); setMsg(null);
    try {
      await api('/api/widgets/donate/config', { method: 'PUT', body: { ...(cfg ?? {}), promptpay: d, min: Math.max(1, min), title: title.trim() } });
      setCfg({ ...(cfg ?? {}), promptpay: d, min, title }); setMsg({ tone: 'success', text: t('บันทึกแล้ว ✓ หน้าโดเนทพร้อมใช้') });
    } catch (e) { setMsg({ tone: 'error', text: (e as Error).message }); } finally { setSaving(false); }
  }
  async function act(id: string, a: 'approve' | 'reject' | 'replay') { try { await api(`/api/donations/${id}/${a}`, { method: 'POST' }); load(); } catch (e) { setMsg({ tone: 'error', text: (e as Error).message }); } }
  async function viewSlip(id: string) {
    const r = await fetch(`/api/donations/${id}/slip`, { headers: { Authorization: `Bearer ${getToken() ?? ''}` } });
    if (r.ok) setSlipUrl(URL.createObjectURL(await r.blob()));
  }

  if (!user) return null;
  const locked = entitlements ? !entitlements.widgets.includes('donate') : false;
  const donateUrl = user.tiktokUsername ? `${typeof window !== 'undefined' ? window.location.origin : ''}/donate/?u=${user.tiktokUsername}` : '';
  const ready = !!String(cfg?.promptpay ?? '');

  return (
    <div>
      <PageHeader title={t('โดเนทขึ้นจอ 💸')} description={t('คนดูสแกนจ่ายพร้อมเพย์เข้าบัญชีคุณโดยตรง แนบสลิป แล้วชื่อ + ข้อความขึ้นจอไลฟ์ — เงินไม่ผ่าน VJLiveKit')} />
      {locked && <div className="mb-5"><Alert tone="info">{t('โดเนทขึ้นจอใช้ได้ในแพลน Pro —')} <Link href="/dashboard/billing/" className="font-medium text-pink underline">{t('อัปเกรด')}</Link></Alert></div>}
      {!user.tiktokUsername && <div className="mb-5"><Alert>{t('ตั้งชื่อ TikTok ในหน้า')} <Link href="/dashboard/" className="underline">{t('ภาพรวม')}</Link> {t('ก่อน จึงจะมีลิงก์หน้าโดเนท')}</Alert></div>}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-medium">{t('1) บัญชีรับเงิน')}</h2>
          {!cfg ? <Spinner /> : (
            <div className="space-y-4">
              <Field label={t('พร้อมเพย์ของคุณ')} hint={t('เบอร์มือถือ / เลขบัตรประชาชน / e-Wallet — QR จะสร้างจากเลขนี้ เงินเข้าบัญชีคุณโดยตรง')}>
                <Input inputMode="numeric" value={pp} onChange={(e) => setPp(e.target.value)} placeholder="08xxxxxxxx" />
              </Field>
              <Field label={t('โดเนทขั้นต่ำ (บาท)')}><NumberInput min={1} value={min} onChange={setMin} /></Field>
              <Field label={t('ข้อความบนหน้าโดเนท (ไม่บังคับ)')}><Input maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('เช่น ขอบคุณทุกกำลังใจนะคะ 💕')} /></Field>
              {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
              <Button onClick={save} loading={saving}>{t('บันทึก')}</Button>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-medium">{t('2) ลิงก์')}</h2>
          <div className="space-y-4 text-sm">
            <div>
              <div className="font-medium">{t('🔗 ลิงก์หน้าโดเนท (ให้คนดู)')}</div>
              <p className="text-muted">{t('ใส่ในไบโอ TikTok / ปักหมุดในแชท')}{ready && cfg?.promptpay ? ` · ${t('รับเข้าพร้อมเพย์ {pp}', { pp: maskPromptPay(String(cfg.promptpay)) })}` : ''}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {donateUrl && ready ? <><CopyBtn text={donateUrl} label={t('คัดลอกลิงก์โดเนท')} /><a href={donateUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-pink underline"><Eye className="size-4" /> {t('ดูหน้าโดเนท')}</a></> : <span className="text-muted">{t('บันทึกพร้อมเพย์ก่อน')}</span>}
              </div>
            </div>
            <div>
              <div className="font-medium">{t('📺 ลิงก์วิดเจ็ตโดเนท (ใส่ในโปรแกรมไลฟ์)')}</div>
              <p className="text-muted">{t('แจ้งเตือนชื่อ · ยอดเงิน · ข้อความ พร้อมเสียงและเหรียญโปรย')}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {overlayUrl ? <CopyBtn text={overlayUrl} label={t('คัดลอกลิงก์วิดเจ็ต')} /> : overlayUrl === null ? <Link href="/dashboard/widgets/" className="text-pink underline">{t('สร้างลิงก์ที่หน้าวิดเจ็ตก่อน')}</Link> : <Spinner />}
                <Link href="/dashboard/widgets/settings/?type=donate" className="inline-flex items-center gap-1 text-pink underline"><Settings className="size-4" /> {t('ตั้งค่าหน้าตาแจ้งเตือน')}</Link>
              </div>
            </div>
            <Alert tone="info">{list?.autoVerify ? t('✅ ตรวจสลิปอัตโนมัติ (EasySlip) — สลิปถูกต้องขึ้นจอทันที') : t('⏳ ตอนนี้ต้องกด “ยืนยัน” เองในรายการด้านล่าง (ระบบตรวจสลิปอัตโนมัติยังไม่เปิด)')}</Alert>
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-0">
        <div className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-3 text-sm">
          <span className="font-medium">{t('รายการโดเนท')}</span>
          <Badge tone="mint">{t('วันนี้')} ฿{(list?.totals.today ?? 0).toLocaleString(loc)}</Badge>
          <Badge tone="violet">{t('ทั้งหมด')} ฿{(list?.totals.all ?? 0).toLocaleString(loc)}</Badge>
          {!!list?.totals.pending && <Badge tone="pink">{t('รอยืนยัน')} {list.totals.pending}</Badge>}
          <button onClick={load} className="ml-auto text-muted hover:text-ink" aria-label={t('รีเฟรช')}><RefreshCw className="size-4" /></button>
        </div>
        {!list ? <div className="p-6"><Spinner /></div> : list.donations.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">{t('ยังไม่มีโดเนท — ลองคัดลอกลิงก์หน้าโดเนทไปใส่ในไบโอ')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {list.donations.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{d.name}</span>
                    <span className="font-display text-pink">฿{d.amount.toLocaleString(loc)}</span>
                    {d.status === 'pending' && <Badge tone="pink">{t('รอยืนยัน')}</Badge>}
                    {d.status === 'verified' && <Badge tone="mint">{d.auto ? t('ตรวจอัตโนมัติ') : t('ยืนยันแล้ว')}</Badge>}
                    {d.status === 'rejected' && <Badge tone="gray">{t('ปฏิเสธ')}</Badge>}
                  </div>
                  {d.message && <p className="truncate text-sm text-muted">“{d.message}”</p>}
                  <p className="text-[11px] text-muted">{new Date(d.createdAt).toLocaleString(loc)}{d.note ? ` · ${d.note}` : ''}</p>
                </div>
                {d.hasSlip && <Button variant="ghost" className="px-3" onClick={() => viewSlip(d.id)}><Eye className="size-4" /> {t('สลิป')}</Button>}
                {d.status === 'pending' && <>
                  <Button className="px-3" onClick={() => act(d.id, 'approve')}><Check className="size-4" /> {t('ยืนยัน & ขึ้นจอ')}</Button>
                  <Button variant="ghost" className="px-3 hover:text-red-600" onClick={() => act(d.id, 'reject')}><X className="size-4" /></Button>
                </>}
                {d.status === 'verified' && <Button variant="ghost" className="px-3" onClick={() => act(d.id, 'replay')} aria-label={t('ขึ้นจออีกครั้ง')}><Play className="size-4" /></Button>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {slipUrl && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => { URL.revokeObjectURL(slipUrl); setSlipUrl(null); }}>
          <img src={slipUrl} alt={t('สลิป')} className="max-h-[90vh] max-w-full rounded-xl" />
        </div>
      )}
    </div>
  );
}
