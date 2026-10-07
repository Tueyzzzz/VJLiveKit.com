'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Play, Square } from 'lucide-react';
import { Alert, Button, Card, Field, Input, PageHeader, Select, Spinner, cx } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import * as TTS from '@/lib/tts';

function Switch({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex w-full items-center gap-3 rounded-xl px-1 py-1.5 text-left">
      <span className={cx('relative h-6 w-11 shrink-0 rounded-full transition', on ? 'bg-pink' : 'bg-gray-200')}>
        <span className={cx('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', on ? 'left-[1.4rem]' : 'left-0.5')} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </button>
  );
}

const SAMPLE: TTS.TtsEvent[] = [
  { type: 'chat', user: { nickname: 'มิมิ' }, comment: 'สวัสดีค่าาา 55555 😍' },
  { type: 'gift', user: { nickname: 'บิ๊ก' }, giftName: 'Rose', value: 1, repeatCount: 1 },
  { type: 'follow', user: { nickname: 'ลิซ่า' } },
];

/**
 * อ่านแชทออกเสียง (TTS) — แบบ TikFinity: เสียงดังที่หน้าเว็บนี้ (เปิดค้างไว้ระหว่างไลฟ์ หน้าไหนก็ได้) ไม่ต้องใส่ลิงก์ใน OBS
 */
export default function TtsPage() {
  const t = useT();
  const { entitlements, isAdmin } = useAuth();
  const allowed = isAdmin || !!entitlements?.widgets.includes('tts');
  const [cfg, setCfg] = useState<TTS.TtsCfg | null>(null);
  const [saved, setSaved] = useState<TTS.TtsCfg | null>(null);
  const [here, setHereS] = useState(true);
  const [voice, setVoice] = useState('');
  const [list, setList] = useState<SpeechSynthesisVoice[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [test, setTest] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'error' | 'success' | 'info'; text: string } | null>(null);

  useEffect(() => {
    api<{ config: Partial<TTS.TtsCfg> }>('/api/widgets/tts/config').then((r) => { const c = TTS.withDefaults(r.config); setCfg(c); setSaved(c); }).catch((e) => setNote({ tone: 'error', text: (e as Error).message }));
    setHereS(TTS.getHere()); setVoice(TTS.getVoiceName());
    const fill = () => setList(TTS.voices());
    fill(); if (typeof speechSynthesis !== 'undefined') speechSynthesis.addEventListener('voiceschanged', fill);
    const off = TTS.onSay((text) => setLog((l) => [text, ...l].slice(0, 8)));
    return () => { off(); if (typeof speechSynthesis !== 'undefined') speechSynthesis.removeEventListener('voiceschanged', fill); };
  }, []);

  if (!cfg) return <Spinner />;
  const set = <K extends keyof TTS.TtsCfg>(k: K, v: TTS.TtsCfg[K]) => { const c = { ...cfg, [k]: v }; setCfg(c); TTS.setCfg(c); };
  const dirty = JSON.stringify(cfg) !== JSON.stringify(saved);
  const thai = list.some((v) => v.lang.toLowerCase().startsWith('th'));

  async function save(next = cfg!) {
    setBusy(true);
    try {
      await api('/api/widgets/tts/config', { method: 'PUT', body: next });
      setSaved(next); window.dispatchEvent(new Event('vjl-tts-changed'));
      setNote({ tone: 'success', text: next.enabled ? t('บันทึกแล้ว — เปิดเว็บนี้ค้างไว้ระหว่างไลฟ์ ระบบจะอ่านแชทให้เอง') : t('บันทึกแล้ว') });
    } catch (e) { setNote({ tone: 'error', text: (e as Error).message }); }
    finally { setBusy(false); }
  }
  const toggleMain = (v: boolean) => { const c = { ...cfg, enabled: v }; setCfg(c); TTS.setCfg(c); void save(c); };
  const toggleHere = (v: boolean) => { setHereS(v); TTS.setHere(v); window.dispatchEvent(new Event('vjl-tts-changed')); };
  const pickVoice = (v: string) => { setVoice(v); TTS.setVoiceName(v); TTS.say(t('สวัสดีค่ะ นี่คือเสียงอ่านแชท'), true); };
  const demo = () => { TTS.stop(); for (const e of SAMPLE) { const l = TTS.lineFor({ ...e, user: { ...e.user, uniqueId: Math.random().toString(36) } }, cfg); if (l) TTS.say(l); } };

  return (
    <div className="space-y-5">
      <PageHeader title={t('อ่านแชทออกเสียง (TTS)')} description={t('ระบบอ่านแชทและของขวัญให้ฟัง เสียงออกจากหน้าเว็บนี้ ไม่ต้องใส่ลิงก์ในโปรแกรมไลฟ์ — เปิดเว็บค้างไว้ระหว่างไลฟ์ (หน้าไหนก็ได้)')} />
      {!allowed && <Alert tone="info">{t('อ่านแชทออกเสียงใช้ได้ในแพลน Pro')} <Link href="/dashboard/billing/" className="font-medium underline">{t('ดูแพลน')}</Link></Alert>}
      {note && <Alert tone={note.tone}>{note.text}</Alert>}

      <Card className={cx('space-y-2', cfg.enabled ? 'border-pink/40 bg-pink-soft/30' : '')}>
        <Switch on={cfg.enabled} onChange={toggleMain} label={cfg.enabled ? t('🔊 เปิดอ่านแชทอยู่') : t('🔇 ปิดอ่านแชทอยู่')} hint={t('เปิด/ปิดทั้งบัญชี')} />
        <Switch on={here} onChange={toggleHere} label={t('อ่านที่เครื่องนี้')} hint={t('ปิดไว้ในมือถือหรือเครื่องที่ไม่ได้ไลฟ์ จะได้ไม่ดังซ้ำ (เปิดหลายแท็บ อ่านแท็บเดียว)')} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="space-y-4">
          <h3 className="font-display text-lg font-semibold">{t('🗣️ เสียง')}</h3>
          {!thai && list.length > 0 && <Alert tone="info">{t('เครื่องนี้ไม่มีเสียงภาษาไทย — แนะนำเปิดด้วย Microsoft Edge (มีเสียงไทยธรรมชาติ) หรือติดตั้งเสียงพูดภาษาไทยใน Windows')}</Alert>}
          <Field label={t('เสียงที่ใช้ (เครื่องนี้)')} hint={t('Edge: เลือก "Premwadee Online (Natural)" หรือ "Niwat" จะเป็นธรรมชาติที่สุด')}>
            <Select value={voice} onChange={(e) => pickVoice(e.target.value)}>
              <option value="">{t('อัตโนมัติ (เสียงไทยที่ดีที่สุด)')}</option>
              {list.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
            </Select>
          </Field>
          {([['rate', 'ความเร็ว', 0.5, 2], ['pitch', 'ระดับเสียง', 0.5, 1.6], ['volume', 'ความดัง', 0.1, 1]] as const).map(([k, label, min, max]) => (
            <Field key={k} label={`${t(label)}: ${cfg[k].toFixed(2)}`}>
              <input type="range" min={min} max={max} step={0.05} value={cfg[k]} onChange={(e) => set(k, parseFloat(e.target.value))} className="w-full accent-pink" />
            </Field>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={demo}><Play className="size-4" />{t('ฟังตัวอย่าง')}</Button>
            <Button type="button" variant="ghost" onClick={() => TTS.stop()}><Square className="size-4" />{t('หยุด')}</Button>
          </div>
          <div className="flex gap-2">
            <Input value={test} onChange={(e) => setTest(e.target.value)} placeholder={t('พิมพ์ข้อความลองอ่าน…')} />
            <Button type="button" onClick={() => test.trim() && TTS.say(TTS.clean(test, cfg), true)}>{t('อ่าน')}</Button>
          </div>
        </Card>

        <Card className="space-y-3">
          <h3 className="font-display text-lg font-semibold">{t('📖 อ่านอะไรบ้าง')}</h3>
          <Switch on={cfg.readChat} onChange={(v) => set('readChat', v)} label={t('💬 แชท')} />
          {cfg.readChat && (
            <div className="space-y-3 rounded-xl bg-gray-50 p-3">
              <Field label={t('อ่านแชทแบบไหน')}>
                <Select value={cfg.chatMode} onChange={(e) => set('chatMode', e.target.value as TTS.TtsCfg['chatMode'])}>
                  <option value="all">{t('ทุกแชท')}</option>
                  <option value="prefix">{t('เฉพาะแชทที่ขึ้นต้นด้วยคำสั่ง')}</option>
                </Select>
              </Field>
              {cfg.chatMode === 'prefix' && <Field label={t('คำสั่ง')} hint={t('เช่น ! → ผู้ชมพิมพ์ "!สวัสดี" ระบบอ่านว่า "สวัสดี"')}><Input value={cfg.prefix} maxLength={10} onChange={(e) => set('prefix', e.target.value)} /></Field>}
              <Field label={t('รูปแบบประโยค')} hint={t('{name} = ชื่อ · {text} = ข้อความ')}><Input value={cfg.tmplChat} onChange={(e) => set('tmplChat', e.target.value)} /></Field>
            </div>
          )}
          <Switch on={cfg.readGift} onChange={(v) => set('readGift', v)} label={t('🎁 ของขวัญ')} />
          {cfg.readGift && (
            <div className="grid gap-3 rounded-xl bg-gray-50 p-3 sm:grid-cols-[8rem_1fr]">
              <Field label={t('ตั้งแต่ (เหรียญ)')}><Input type="number" min={1} value={cfg.minGift} onChange={(e) => set('minGift', Math.max(1, Number(e.target.value) || 1))} /></Field>
              <Field label={t('รูปแบบประโยค')} hint={t('{gift} = ของขวัญ · {count} = จำนวน')}><Input value={cfg.tmplGift} onChange={(e) => set('tmplGift', e.target.value)} /></Field>
            </div>
          )}
          <Switch on={cfg.readFollow} onChange={(v) => set('readFollow', v)} label={t('➕ ติดตาม')} />
          {cfg.readFollow && <Input value={cfg.tmplFollow} onChange={(e) => set('tmplFollow', e.target.value)} />}
          <Switch on={cfg.readShare} onChange={(v) => set('readShare', v)} label={t('🔁 แชร์ไลฟ์')} />
          {cfg.readShare && <Input value={cfg.tmplShare} onChange={(e) => set('tmplShare', e.target.value)} />}
        </Card>

        <Card className="space-y-3">
          <h3 className="font-display text-lg font-semibold">{t('🛡️ กันสแปม')}</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t('ยาวสุด (ตัวอักษร)')}><Input type="number" min={20} max={300} value={cfg.maxLen} onChange={(e) => set('maxLen', Math.min(300, Math.max(20, Number(e.target.value) || 120)))} /></Field>
            <Field label={t('คนเดิมอ่านซ้ำได้ทุก (วินาที)')}><Input type="number" min={0} max={600} value={cfg.userCooldown} onChange={(e) => set('userCooldown', Math.max(0, Number(e.target.value) || 0))} /></Field>
            <Field label={t('คิวสูงสุด')}><Input type="number" min={1} max={50} value={cfg.maxQueue} onChange={(e) => set('maxQueue', Math.min(50, Math.max(1, Number(e.target.value) || 10)))} /></Field>
          </div>
          <Field label={t('คำต้องห้าม (คั่นด้วย ,)')} hint={t('แชทที่มีคำเหล่านี้จะไม่ถูกอ่าน')}><Input value={cfg.blocked} onChange={(e) => set('blocked', e.target.value)} /></Field>
          <Switch on={cfg.skipLinks} onChange={(v) => set('skipLinks', v)} label={t('ไม่อ่านลิงก์')} />
          <p className="text-xs text-muted">{t('ระบบตัดอีโมจิ และอ่าน 5555 เป็น "ฮ่า ๆ" ให้อัตโนมัติ')}</p>
        </Card>

        <Card className="space-y-2">
          <h3 className="font-display text-lg font-semibold">{t('📝 อ่านล่าสุด')}</h3>
          {log.length ? log.map((l, i) => <p key={i} className={cx('truncate rounded-lg px-3 py-1.5 text-sm', i ? 'text-muted' : 'bg-pink-soft/50 text-ink')}>{l}</p>)
            : <p className="text-sm text-muted">{t('ยังไม่มี — ลองกด "ฟังตัวอย่าง"')}</p>}
        </Card>
      </div>

      <div className="sticky bottom-3 z-10 flex justify-end">
        <Button onClick={() => void save()} loading={busy} disabled={!dirty} className="shadow-lg">{dirty ? t('บันทึกการตั้งค่า') : t('บันทึกแล้ว')}</Button>
      </div>
    </div>
  );
}
