'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Play, Plus, Search, Trash2, Upload as UploadIcon, X } from 'lucide-react';
import { Alert, Button, Card, Input, PageHeader, Select, Spinner } from '@/components/ui';
import { GiftCell, GiftPicker } from '@/components/GiftPicker';
import { api, ApiError, type Rule, type TriggerEvent } from '@/lib/api';
import { translate, useT } from '@/lib/i18n';
import { SFX, enqueueSound, getSoundPrefs, playSound, readAsDataUrl, toAudioDataUrl, setSoundPrefs, type SoundPrefs, type Upload } from '@/lib/sounds';

const EVENTS: [TriggerEvent, string][] = [['gift', '🎁 ได้รับกิฟต์'], ['follow', '➕ มีคนติดตาม'], ['share', '🔁 มีคนแชร์'], ['like', '❤️ มีคนกดไลก์'], ['chat', '💬 แชทมีคำว่า']];
const KEYS = ['', ...'1234567890QWERTYUIOPASDFGHJKLZXCVBNM'.split(''), 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10'];

const soundName = (a: Rule['action'], uploads: Upload[], t: typeof translate) =>
  a.sound ? t(SFX.find(([id]) => id === a.sound)?.[1] ?? a.sound) : a.url ? (uploads.find((u) => u.url === a.url)?.name ? `🎵 ${uploads.find((u) => u.url === a.url)!.name}` : t('🔗 ไฟล์ของฉัน')) : t('ยังไม่ได้เลือก');
const changed = () => window.dispatchEvent(new Event('vjl-rules-changed')); // แจ้งตัวเล่นเสียง (ปุ่มลัด) ให้โหลดกฎใหม่

/**
 * เสียงแจ้งเตือน (แบบ TikFinity Sound Alerts): ได้กิฟต์/ติดตาม/แชท → เล่นเสียง
 * ทุกแถวคือกฎ Actions ชนิด "เล่นเสียง" — เสียงดังที่เว็บนี้ (ลำโพงแดชบอร์ด) หรือที่ลิงก์ FX
 */
export default function SoundsPage() {
  const t = useT();
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [maxBytes, setMaxBytes] = useState(5 * 1024 * 1024);
  const [q, setQ] = useState('');
  const [err, setErr] = useState<{ text: string; upgrade?: boolean } | null>(null);
  const [lib, setLib] = useState<Rule | null>(null); // แถวที่กำลังเลือกเสียง
  const [prefs, setPrefs] = useState<SoundPrefs>({ simultaneous: false, maxQueue: 20 });

  const load = useCallback(() => api<{ rules: Rule[] }>('/api/actions').then((r) => setRules(r.rules.filter((x) => x.action.type === 'sound'))).catch((e) => { setErr({ text: (e as Error).message }); setRules([]); }), []);
  useEffect(() => {
    void load();
    api<{ sounds: Upload[]; maxBytes: number }>('/api/sounds').then((r) => { setUploads(r.sounds); if (r.maxBytes) setMaxBytes(r.maxBytes); }).catch(() => {});
    setPrefs(getSoundPrefs());
  }, [load]);

  async function save(r: Rule, patch: { enabled?: boolean; trigger?: Rule['trigger']; action?: Partial<Rule['action']> }) {
    const next: Rule = { ...r, enabled: patch.enabled ?? r.enabled, trigger: patch.trigger ?? r.trigger, action: { ...r.action, ...patch.action, type: 'sound' } };
    // เปลี่ยนเป็นไฟล์ → ล้างเสียงสำเร็จรูป (และกลับกัน)
    if (patch.action && 'url' in patch.action && patch.action.url) delete next.action.sound;
    if (patch.action && 'sound' in patch.action && patch.action.sound) delete next.action.url;
    if (!next.action.key) delete next.action.key;
    setRules((rs) => rs?.map((x) => (x.id === r.id ? next : x)) ?? rs);
    try { await api(`/api/actions/${r.id}`, { method: 'PUT', body: { enabled: next.enabled, trigger: next.trigger, action: next.action } }); changed(); }
    catch (e) { setErr({ text: (e as Error).message }); void load(); }
  }
  async function create() {
    setErr(null);
    try {
      await api('/api/actions', { method: 'POST', body: { name: 'เสียงแจ้งเตือน', enabled: true, trigger: { event: 'gift', giftName: 'Rose' }, action: { type: 'sound', sound: 'chime', volume: 1 } } });
      await load(); changed();
    } catch (e) { setErr({ text: (e as Error).message, upgrade: e instanceof ApiError && e.upgrade }); }
  }
  async function remove(r: Rule) {
    if (!confirm(t('ลบเสียงแจ้งเตือนนี้?'))) return;
    try { await api(`/api/actions/${r.id}`, { method: 'DELETE' }); await load(); changed(); } catch (e) { setErr({ text: (e as Error).message }); }
  }
  function setPref(p: SoundPrefs) { setPrefs(p); setSoundPrefs(p); }

  const shown = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return !rules ? null : qq ? rules.filter((r) => `${r.trigger.giftName ?? ''} ${r.trigger.keyword ?? ''} ${r.name} ${soundName(r.action, uploads, t)}`.toLowerCase().includes(qq)) : rules;
  }, [rules, q, uploads, t]);

  return (
    <div>
      <PageHeader title={t('🔊 เสียงแจ้งเตือน')} description={t('ได้กิฟต์ / มีคนติดตาม / แชท → เล่นเสียง · เสียงดังที่เว็บนี้ (เปิดค้างไว้ระหว่างไลฟ์) หรือที่ลิงก์ FX')} />
      <p className="-mt-3 mb-5 text-sm text-muted">{t('ตั้งเสียงหลายแบบให้กิฟต์เดียวกันได้ · อยากได้เอฟเฟกต์บนจอ (ไพ่ ผีเสื้อ ป้ายไฟ) ใช้')} <Link href="/dashboard/actions/" className="text-pink underline">Actions & Events</Link> · {t('ตั้ง')} <b>{t('ปุ่มลัด')}</b> {t('แล้วกดคีย์บอร์ดเพื่อเล่นเสียงเองได้ทุกหน้า')}</p>
      {err && <div className="mb-4"><Alert>{err.text} {err.upgrade && <Link href="/dashboard/billing/" className="font-medium underline">{t('อัปเกรด')}</Link>}</Alert></div>}

      <Card className="mb-6 p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <Button onClick={create}><Plus className="size-4" /> {t('เพิ่มเสียงแจ้งเตือน')}</Button>
          <div className="relative ml-auto w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('ค้นหา…')} className="pl-9" />
          </div>
        </div>
        {!shown ? <div className="p-6"><Spinner /></div> : shown.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">{rules?.length ? t('ไม่พบ') : t('ยังไม่มีเสียงแจ้งเตือน — กด “เพิ่มเสียงแจ้งเตือน”')}</p>
        ) : (
          <div className="divide-y divide-line">
            {shown.map((r) => (
              <div key={r.id} className={`grid gap-3 p-4 md:grid-cols-[auto_1.4fr_1.2fr_6rem_9rem] md:items-center ${r.enabled ? '' : 'opacity-50'}`}>
                <div className="flex items-center gap-1.5">
                  <button title={t('ฟังเสียง')} onClick={() => void playSound(r.action)} className="grid size-8 place-items-center rounded-full bg-pink text-white"><Play className="size-4" /></button>
                  <button title={t('ลบ')} onClick={() => remove(r)} className="grid size-8 place-items-center rounded-full text-muted hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" /></button>
                  <input type="checkbox" title={t('เปิดใช้')} checked={r.enabled} onChange={(e) => void save(r, { enabled: e.target.checked })} className="ml-1 size-4 accent-pink" />
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <div className="hidden scale-75 sm:block"><GiftCell name={r.trigger.giftName} event={r.trigger.event} /></div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Select value={r.trigger.event} onChange={(e) => void save(r, { trigger: { event: e.target.value as TriggerEvent } })}>
                      {EVENTS.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}
                    </Select>
                    {r.trigger.event === 'gift' && <GiftPicker value={r.trigger.giftName ?? ''} onChange={(v) => void save(r, { trigger: { event: 'gift', ...(v ? { giftName: v } : {}) } })} />}
                    {r.trigger.event === 'chat' && <Input defaultValue={r.trigger.keyword ?? ''} placeholder={t('คำในแชท')} onBlur={(e) => void save(r, { trigger: { event: 'chat', keyword: e.target.value.trim() } })} />}
                  </div>
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <Button variant="secondary" className="shrink-0 px-3 text-xs" onClick={() => setLib(r)}>{t('เลือกเสียง')}</Button>
                  <span className="truncate text-sm">{soundName(r.action, uploads, t)}</span>
                </div>
                <Select title={t('ปุ่มลัด')} value={r.action.key ?? ''} onChange={(e) => void save(r, { action: { key: e.target.value } })}>
                  {KEYS.map((k) => <option key={k} value={k}>{k || t('ไม่มีปุ่มลัด')}</option>)}
                </Select>
                <div className="flex items-center gap-2">
                  <input type="range" min={0} max={1.5} step={0.05} defaultValue={r.action.volume ?? 1} title={t('ความดัง')} className="flex-1 accent-pink"
                    onMouseUp={(e) => void save(r, { action: { volume: Number((e.target as HTMLInputElement).value) } })}
                    onTouchEnd={(e) => void save(r, { action: { volume: Number((e.target as HTMLInputElement).value) } })}
                    onKeyUp={(e) => void save(r, { action: { volume: Number((e.target as HTMLInputElement).value) } })} />
                  <span className="w-9 text-right text-xs tabular-nums text-muted">{Math.round((r.action.volume ?? 1) * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="max-w-xl">
        <h2 className="mb-3 font-medium">{t('ตั้งค่าการเล่นเสียง')} <span className="text-xs font-normal text-muted">{t('(เก็บในเครื่องนี้)')}</span></h2>
        <label className="flex items-center justify-between gap-3 py-2 text-sm">{t('เล่นเสียงซ้อนกันได้ (ไม่ต้องรอคิว)')}
          <input type="checkbox" className="size-4 accent-pink" checked={prefs.simultaneous} onChange={(e) => setPref({ ...prefs, simultaneous: e.target.checked })} />
        </label>
        <label className="flex items-center justify-between gap-3 py-2 text-sm">{t('ความยาวคิวสูงสุด (เสียง)')}
          <Input className="w-24 text-right" inputMode="numeric" value={String(prefs.maxQueue)} disabled={prefs.simultaneous}
            onChange={(e) => setPref({ ...prefs, maxQueue: Math.max(1, Math.min(500, Number(e.target.value.replace(/\D/g, '')) || 1)) })} />
        </label>
        <Button variant="secondary" className="mt-2" onClick={() => { enqueueSound({ sound: 'pop' }); enqueueSound({ sound: 'coin' }); enqueueSound({ sound: 'chime' }); }}><Play className="size-4" /> {t('ลองเล่น 3 เสียงติดกัน')}</Button>
      </Card>

      {lib && <SoundLibrary uploads={uploads} maxBytes={maxBytes} onUploaded={(u) => setUploads((x) => [u, ...x])}
        onDeleted={(id) => setUploads((x) => x.filter((u) => u.id !== id))}
        onPick={(a) => { void save(lib, { action: a }); setLib(null); }} onClose={() => setLib(null)} />}
    </div>
  );
}

/** คลังเสียง: เสียงสำเร็จรูป + ไฟล์ที่อัปโหลด — ฟังก่อน แล้วกด “ใช้เสียงนี้” */
function SoundLibrary({ uploads, maxBytes, onUploaded, onDeleted, onPick, onClose }: {
  uploads: Upload[]; maxBytes: number; onUploaded: (u: Upload) => void; onDeleted: (id: string) => void;
  onPick: (a: { sound?: string; url?: string }) => void; onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const t = useT();
  const qq = q.trim().toLowerCase();
  const items: { key: string; name: string; a: { sound?: string; url?: string }; up?: Upload }[] = [
    ...uploads.map((u) => ({ key: u.id, name: `🎵 ${u.name}`, a: { url: u.url }, up: u })),
    ...SFX.map(([id, name]) => ({ key: id, name: t(name), a: { sound: id } })),
  ].filter((x) => !qq || x.name.toLowerCase().includes(qq));

  async function upload(f: File) {
    if (f.size > maxBytes) { setErr(t('ไฟล์ใหญ่เกิน {mb}MB — ตัดให้สั้นลง (เช่น mp3cut.net) หรือแปลงเป็น mp3', { mb: Math.round(maxBytes / 1048576) })); return; }
    setBusy(true); setErr(null);
    try {
      const r = await api<{ sound: Upload }>('/api/sounds', { method: 'POST', body: { name: f.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'เสียง', data: await toAudioDataUrl(f) } });
      onUploaded(r.sound);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function del(u: Upload) {
    if (!confirm(t('ลบไฟล์ “{name}”? กฎที่ใช้ไฟล์นี้จะไม่มีเสียง', { name: u.name }))) return;
    try { await api(`/api/sounds/${u.id}`, { method: 'DELETE' }); onDeleted(u.id); } catch (e) { setErr((e as Error).message); }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[85dvh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-medium">{t('คลังเสียง')}</h2>
          <button onClick={onClose} aria-label={t('ปิด')} className="text-muted hover:text-ink"><X className="size-5" /></button>
        </div>
        <div className="space-y-3 border-b border-line p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-line px-3 py-2 hover:bg-pink-soft">
              {busy ? <Spinner /> : <UploadIcon className="size-4" />} {t('อัปโหลดเสียง')}
              <input type="file" accept="audio/*,video/*" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f); }} />
            </label>
            <span className="text-muted">{t('หรือเลือกจากคลังด้านล่าง · mp3 / wav / ogg / m4a ไม่เกิน {mb}MB', { mb: Math.round(maxBytes / 1048576) })}</span>
          </div>
          <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('ค้นหาเสียง…')} className="pl-9" /></div>
          {err && <Alert>{err}</Alert>}
        </div>
        <ul className="flex-1 divide-y divide-line overflow-y-auto">
          {items.map((x) => (
            <li key={x.key} className="flex items-center gap-2 px-4 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm">{x.name}</span>
              <Button variant="secondary" className="px-3 text-xs" onClick={() => void playSound(x.a)}><Play className="size-3.5" /> {t('ฟัง')}</Button>
              <Button className="px-3 text-xs" onClick={() => onPick(x.a)}>{t('ใช้เสียงนี้')}</Button>
              {x.up && <button title={t('ลบไฟล์')} onClick={() => del(x.up!)} className="text-muted hover:text-red-600"><Trash2 className="size-4" /></button>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
