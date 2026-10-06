'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Copy, Pencil, Play, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select, Spinner } from '@/components/ui';
import { GiftCell, GiftPicker, useGifts } from '@/components/GiftPicker';
import { toDigits } from '@/components/NumberInput';
import { api, ApiError, type OverlayTokenRow, type ActionType, type Rule, type TarotDeck, type TarotTopic, type TriggerEvent } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const EVENT_LABELS: Record<TriggerEvent, string> = { gift: '🎁 ได้รับกิฟต์', follow: '➕ มีคนติดตาม', share: '🔁 มีคนแชร์', like: '❤️ มีคนกดไลค์', chat: '💬 แชทมีคำว่า' };
const ACTION_LABELS: Record<ActionType, string> = { sound: '🔊 เล่นเสียง', image: '🖼️ แสดงรูป/GIF', video: '🎬 เล่นวิดีโอ', text: '✏️ แสดงข้อความ', tarot: '🔮 สุ่มไพ่ทาโร่', effect: '🦋 ผีเสื้อเทพนิยาย' };

interface Draft {
  id?: string;
  name: string;
  enabled: boolean;
  event: TriggerEvent;
  giftName: string;
  minDiamonds: string;
  keyword: string;
  type: ActionType;
  url: string;
  text: string;
  durationSec: string;
  cards: string;
  deck: TarotDeck;
  topic: TarotTopic;
  count: string;
}

const EMPTY: Draft = { name: '', enabled: true, event: 'gift', giftName: '', minDiamonds: '', keyword: '', type: 'sound', url: '', text: '', durationSec: '5', cards: '1', deck: 'full', topic: 'general', count: '12' };

/** เทมเพลตยอดนิยม — กดครั้งเดียวสร้างกฎได้เลย (ไม่ต้องหาไฟล์เสียง/รูปเอง) */
interface Template { icon: string; title: string; desc: string; rule: { name: string; trigger: Rule['trigger']; action: Rule['action'] } }
const TEMPLATES: Template[] = [
  { icon: '🔮', title: 'ได้ Rose → เปิดไพ่ 1 ใบ', desc: 'ทุกกุหลาบ = คำทำนาย 1 ใบให้คนส่ง',
    rule: { name: 'Rose เปิดไพ่ทาโร่', trigger: { event: 'gift', giftName: 'Rose' }, action: { type: 'tarot', cards: 1, text: '🌹 คำทำนายของ {user}', durationMs: 8000 } } },
  { icon: '🃏', title: 'กิฟต์ 99 เพชรขึ้นไป → ไพ่ 3 ใบ', desc: 'อดีต · ปัจจุบัน · อนาคต',
    rule: { name: 'ไพ่ 3 ใบ (99 เพชร+)', trigger: { event: 'gift', minDiamonds: 99 }, action: { type: 'tarot', cards: 3, text: '✨ {user} เปิดดวง 3 ใบ', durationMs: 13000 } } },
  { icon: '🌌', title: 'กิฟต์ 1,000 เพชรขึ้นไป → ไพ่ 7 ใบ', desc: 'ดูดวงเต็มชุดให้สายเปย์',
    rule: { name: 'ไพ่ 7 ใบ (1,000 เพชร+)', trigger: { event: 'gift', minDiamonds: 1000 }, action: { type: 'tarot', cards: 7, text: '👑 ดูดวงเต็มชุดให้ {user}', durationMs: 20000 } } },
  { icon: '💬', title: 'พิมพ์ “ดูดวง” ในแชท → ไพ่ 1 ใบ', desc: 'ให้คนดูเล่นได้ทุกคน',
    rule: { name: 'แชทดูดวง', trigger: { event: 'chat', keyword: 'ดูดวง' }, action: { type: 'tarot', cards: 1, text: '🔮 ไพ่ของ {user}', durationMs: 8000 } } },
  { icon: '💘', title: 'ทำนายความรัก 3 ใบ', desc: 'กิฟต์ 30 เพชรขึ้นไป → ใจคุณ · ใจเขา · อนาคตความรัก',
    rule: { name: 'ทำนายความรัก', trigger: { event: 'gift', minDiamonds: 30 }, action: { type: 'tarot', cards: 3, topic: 'love', text: '💘 ดวงความรักของ {user}', durationMs: 13000 } } },
  { icon: '💌', title: 'พิมพ์ “ดูดวงความรัก” → ไพ่ 1 ใบ', desc: 'คนดูขอดูดวงความรักในแชท',
    rule: { name: 'แชทดูดวงความรัก', trigger: { event: 'chat', keyword: 'ดูดวงความรัก' }, action: { type: 'tarot', cards: 1, topic: 'love', text: '💌 ความรักของ {user}', durationMs: 8000 } } },
  { icon: '💰', title: 'ทำนายการเงิน 3 ใบ', desc: 'กิฟต์ 99 เพชรขึ้นไป → การเงินตอนนี้ · สิ่งที่ต้องระวัง · โชคลาภ',
    rule: { name: 'ทำนายการเงิน', trigger: { event: 'gift', minDiamonds: 99 }, action: { type: 'tarot', cards: 3, topic: 'money', text: '💰 ดวงการเงินของ {user}', durationMs: 13000 } } },
  { icon: '🪞', title: 'ทำนายตัวตน 3 ใบ', desc: 'กิฟต์ 30 เพชรขึ้นไป → ตัวตนจริง · ที่คนอื่นมอง · จุดเด่น',
    rule: { name: 'ทำนายตัวตน', trigger: { event: 'gift', minDiamonds: 30 }, action: { type: 'tarot', cards: 3, topic: 'self', text: '🪞 ตัวตนของ {user}', durationMs: 13000 } } },
  { icon: '🦋', title: 'ได้ Rose → ผีเสื้อเทพนิยาย', desc: 'ผีเสื้อปีกวาวบินข้ามจอ โปรยผงประกาย',
    rule: { name: 'ผีเสื้อเทพนิยาย', trigger: { event: 'gift', giftName: 'Rose' }, action: { type: 'effect', effect: 'butterflies', count: 12, text: '🦋 {user} เสกผีเสื้อให้ ✨', durationMs: 8000 } } },
  { icon: '⚔️', title: 'ร่างกายต้องการดาบ', desc: 'ได้กิฟต์ → สุ่มไพ่ชุดดาบ 1 ใบ ตามเทรนด์',
    rule: { name: 'ร่างกายต้องการดาบ', trigger: { event: 'gift', minDiamonds: 1 }, action: { type: 'tarot', cards: 1, deck: 'swords', text: '⚔️ ร่างกายของ {user} ต้องการดาบ!', durationMs: 8000 } } },
  { icon: '💖', title: 'มีคนติดตาม → ข้อความขอบคุณ', desc: '“ขอบคุณ {user} ที่กดติดตามนะ”',
    rule: { name: 'ขอบคุณผู้ติดตามใหม่', trigger: { event: 'follow' }, action: { type: 'text', text: '💖 ขอบคุณ {user} ที่กดติดตามนะ!', durationMs: 4000 } } },
  { icon: '🔁', title: 'มีคนแชร์ → ข้อความขอบคุณ', desc: 'กระตุ้นให้คนช่วยแชร์ไลฟ์',
    rule: { name: 'ขอบคุณที่แชร์', trigger: { event: 'share' }, action: { type: 'text', text: '🔁 ขอบคุณ {user} ที่ช่วยแชร์ไลฟ์ 🙏', durationMs: 4000 } } },
  { icon: '🎉', title: 'กิฟต์ 500 เพชรขึ้นไป → ข้อความว้าว', desc: 'ฉลองให้คนส่งกิฟต์ใหญ่',
    rule: { name: 'ว้าว! กิฟต์ใหญ่ (500+)', trigger: { event: 'gift', minDiamonds: 500 }, action: { type: 'text', text: '🎉 ว้าว! {user} ใจดีสุด ๆ ขอบคุณมาก!', durationMs: 5000 } } },
  { icon: '🌟', title: 'ได้ Galaxy → ข้อความพิเศษ', desc: 'ขอบคุณแบบเฉพาะกิฟต์',
    rule: { name: 'ขอบคุณ Galaxy', trigger: { event: 'gift', giftName: 'Galaxy' }, action: { type: 'text', text: '🌌 {user} ส่ง Galaxy! รักเลย 💜', durationMs: 5000 } } },
];

function toDraft(r: Rule): Draft {
  return {
    id: r.id, name: r.name, enabled: r.enabled, event: r.trigger.event,
    giftName: r.trigger.giftName ?? '', minDiamonds: r.trigger.minDiamonds != null ? String(r.trigger.minDiamonds) : '',
    keyword: r.trigger.keyword ?? '', type: r.action.type, url: r.action.url ?? '', text: r.action.text ?? '',
    durationSec: r.action.durationMs ? String(r.action.durationMs / 1000) : '5',
    cards: String(r.action.cards ?? 1),
    deck: r.action.deck ?? 'full',
    topic: r.action.topic ?? 'general',
    count: String(r.action.count ?? 12),
  };
}

function toBody(d: Draft) {
  const trigger: Rule['trigger'] = { event: d.event };
  if (d.event === 'gift') {
    if (d.giftName.trim()) trigger.giftName = d.giftName.trim();
    if (d.minDiamonds.trim()) trigger.minDiamonds = Math.max(0, Math.floor(Number(d.minDiamonds)));
  }
  if (d.event === 'chat' && d.keyword.trim()) trigger.keyword = d.keyword.trim();
  const action: Rule['action'] = { type: d.type };
  const needsFile = d.type === 'sound' || d.type === 'image' || d.type === 'video';
  if (needsFile && d.url.trim()) action.url = d.url.trim();
  if (d.type === 'effect') { action.effect = 'butterflies'; action.count = Math.max(1, Math.min(30, Number(d.count) || 12)); }
  if (d.text.trim()) action.text = d.text.trim();
  if (d.type === 'tarot') { action.cards = Number(d.cards) || 1; if (d.deck !== 'full') action.deck = d.deck; if (d.topic !== 'general') action.topic = d.topic; }
  const sec = Number(d.durationSec);
  if (sec > 0) action.durationMs = Math.min(60_000, Math.round(sec * 1000));
  return { name: d.name.trim(), enabled: d.enabled, trigger, action };
}

function describe(r: Rule): string {
  const t = r.trigger;
  let s = EVENT_LABELS[t.event];
  if (t.event === 'gift') s += t.giftName ? ` “${t.giftName}”` : '';
  if (t.event === 'gift' && t.minDiamonds) s += ` ≥ ${t.minDiamonds} 💎`;
  if (t.event === 'chat') s += ` “${t.keyword ?? ''}”`;
  return `${s} → ${ACTION_LABELS[r.action.type]}${r.action.type === 'tarot' ? ` ${r.action.cards ?? 1} ใบ` : ''}${r.action.text ? ` “${r.action.text}”` : ''}`;
}

export default function ActionsPage() {
  const { entitlements } = useAuth();
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<{ text: string; upgrade?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  // ลิงก์วิดเจ็ต FX (ตัวที่แสดง Actions บนจอ) — คัดลอกได้จากหน้านี้เลย
  const [fxUrl, setFxUrl] = useState<string | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    api<{ tokens: OverlayTokenRow[] }>('/api/overlay-tokens')
      .then((r) => setFxUrl(r.tokens[0]?.urls.find((u) => u.type === 'fx')?.url ?? null))
      .catch(() => setFxUrl(null));
  }, []);
  async function copyFx() {
    if (!fxUrl) return;
    try { await navigator.clipboard.writeText(fxUrl); } catch { window.prompt('คัดลอกลิงก์นี้', fxUrl); return; }
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }
  // กดแก้ไข/เพิ่มกฎ → เลื่อนขึ้นไปที่ฟอร์ม (ฟอร์มอยู่บนสุด ถ้าไม่เลื่อนจะดูเหมือนกดไม่ติด)
  const formRef = useRef<HTMLDivElement>(null);
  const draftKey = draft ? draft.id ?? 'new' : null;
  useEffect(() => { if (draftKey) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [draftKey]);

  const load = useCallback(async () => {
    try { setRules((await api<{ rules: Rule[] }>('/api/actions')).rules); }
    catch (err) { setError({ text: (err as Error).message }); setRules([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    // ต้องมีลิงก์ไฟล์เฉพาะ เสียง/รูป/วิดีโอ (ไพ่ทาโร่ · ผีเสื้อ · ข้อความ ไม่ต้องใช้)
    if ((draft.type === 'sound' || draft.type === 'image' || draft.type === 'video') && !draft.url.trim()) { setError({ text: 'ใส่ลิงก์ไฟล์ (https://...) ด้วย' }); return; }
    if (draft.type === 'text' && !draft.text.trim()) { setError({ text: 'ใส่ข้อความที่จะแสดงด้วย' }); return; }
    setBusy(true);
    setError(null);
    try {
      const body = toBody(draft);
      if (draft.id) await api(`/api/actions/${draft.id}`, { method: 'PUT', body });
      else await api('/api/actions', { method: 'POST', body });
      setDraft(null);
      await load();
      setSaved(`บันทึก “${body.name}” แล้ว ✓ มีผลกับไลฟ์ทันที`); setTimeout(() => setSaved(null), 4000);
    } catch (err) {
      setError({ text: err instanceof ApiError && err.status === 400 ? 'ข้อมูลไม่ถูกต้อง — ลิงก์ต้องขึ้นต้นด้วย https://' : (err as Error).message,
        upgrade: err instanceof ApiError && err.upgrade });
    } finally {
      setBusy(false);
    }
  }

  async function toggle(r: Rule) {
    try { await api(`/api/actions/${r.id}`, { method: 'PUT', body: { enabled: !r.enabled } }); await load(); }
    catch (err) { setError({ text: (err as Error).message }); }
  }

  // ▶ ทดลองเล่นบนจอ fx — ถ้าไม่มีจอ fx เปิดอยู่ บอกให้ใส่ลิงก์ก่อน
  async function test(r: Rule) {
    try {
      const res = await api<{ screens: number }>(`/api/actions/${r.id}/test`, { method: 'POST' });
      if (res.screens > 0) alert(`ส่ง “${r.name}” ไปที่จอแล้ว ✓ (เปิดอยู่ ${res.screens} จอ)`);
      else alert('ยังไม่มีจอเอฟเฟกต์ (fx) เปิดอยู่ — คัดลอกลิงก์ “จอเอฟเฟกต์” ด้านบนไปใส่ในโปรแกรมไลฟ์ก่อน แล้วกดทดลองอีกครั้ง');
    } catch (err) { setError({ text: (err as Error).message }); }
  }

  async function remove(r: Rule) {
    if (!confirm(`ลบกฎ “${r.name}”?`)) return;
    try { await api(`/api/actions/${r.id}`, { method: 'DELETE' }); await load(); }
    catch (err) { setError({ text: (err as Error).message }); }
  }

  // เตือนเมื่อเลือกกิฟต์ถูก ๆ คู่กับขั้นต่ำสูง (เช่น Heart 1💎 + 99) → ต้องส่งคอมโบเดียวหลายสิบชิ้นถึงจะขึ้น
  const gifts = useGifts();
  const minHint = (() => {
    if (!draft || draft.event !== 'gift' || !draft.minDiamonds.trim()) return 'นับรวมทั้งคอมโบ (ส่งรัว ๆ ครั้งเดียว) · เว้นว่าง = ทุกราคา';
    const min = Number(draft.minDiamonds) || 0;
    const g = draft.giftName ? gifts.find((x) => x.name.toLowerCase() === draft.giftName.toLowerCase()) : undefined;
    if (g && g.diamonds > 0 && min > g.diamonds) return `⚠️ ${g.name} ราคา ${g.diamonds}💎 → ต้องส่ง ${Math.ceil(min / g.diamonds)} ชิ้นในคอมโบเดียวถึงจะขึ้น · ถ้าอยากให้ขึ้นทุกครั้งที่ส่ง ให้ลบช่องนี้ หรือเลือก "ทุกกิฟต์"`;
    return 'นับรวมทั้งคอมโบ (ส่งรัว ๆ ครั้งเดียว)';
  })();

  const fxLocked = entitlements ? !entitlements.widgets.includes('fx') : false;
  const [adding, setAdding] = useState<string | null>(null);
  async function applyTemplate(t: Template) {
    setAdding(t.rule.name); setError(null);
    try { await api('/api/actions', { method: 'POST', body: { ...t.rule, enabled: true } }); await load(); }
    catch (err) { setError({ text: (err as Error).message, upgrade: err instanceof ApiError && err.upgrade }); }
    finally { setAdding(null); }
  }
  const have = new Set((rules ?? []).map((r) => r.name));

  return (
    <div>
      <PageHeader title="Actions & Events"
        description="ตั้งกฎอัตโนมัติ: เมื่อเกิดเหตุการณ์ในไลฟ์ → overlay FX เล่นเสียง/รูป/วิดีโอ/ข้อความ"
        actions={!draft && <Button onClick={() => { setError(null); setDraft({ ...EMPTY }); }}><Plus className="size-4" /> เพิ่มกฎ</Button>} />

      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-medium">✨ ลิงก์วิดเจ็ตเอฟเฟกต์ (FX)</div>
            <p className="text-sm text-muted">Actions ทุกกฎจะแสดงผ่านวิดเจ็ตนี้ — วางในโปรแกรมไลฟ์ <b>ให้เต็มจอ</b> และไว้ <b>ชั้นบนสุด</b> ครั้งเดียวพอ</p>
          </div>
          {fxUrl ? (
            <Button variant="secondary" onClick={copyFx}>{copied ? <><Check className="size-4 text-mint" /> คัดลอกแล้ว</> : <><Copy className="size-4" /> คัดลอกลิงก์ FX</>}</Button>
          ) : fxUrl === null ? (
            <Link href="/dashboard/widgets/" className="text-sm font-medium text-pink underline">สร้างลิงก์ที่หน้าวิดเจ็ตก่อน</Link>
          ) : <Spinner />}
        </div>
      </Card>

      {fxLocked && (
        <div className="mb-5">
          <Alert tone="info">overlay FX (ที่เล่น Actions) ใช้ได้ในแพลน Pro — ตั้งกฎไว้ก่อนได้ แล้ว <Link href="/dashboard/billing/" className="font-medium text-pink underline">อัปเกรด</Link> เพื่อให้แสดงบนไลฟ์</Alert>
        </div>
      )}
      {saved && <div className="mb-5"><Alert tone="success">{saved}</Alert></div>}
      {error && <div className="mb-5"><Alert>{error.text} {error.upgrade && <Link href="/dashboard/billing/" className="font-medium underline">อัปเกรด</Link>}</Alert></div>}

      {draft && (
        <div ref={formRef} className="scroll-mt-4">
        <Card className="mb-6 ring-2 ring-pink/40">
          <form onSubmit={save} className="space-y-4">
            <h2 className="font-medium">{draft.id ? 'แก้ไขกฎ' : 'กฎใหม่'}</h2>
            <Field label="ชื่อกฎ"><Input required maxLength={80} value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="เช่น ได้ Rose เล่นเสียงปรบมือ" /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="เมื่อ">
                <Select value={draft.event} onChange={(e) => set('event', e.target.value as TriggerEvent)}>
                  {Object.entries(EVENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </Field>
              {draft.event === 'gift' && (
                <>
                  <Field label="กิฟต์"><GiftPicker value={draft.giftName} onChange={(v) => set('giftName', v)} /></Field>
                  <Field label="มูลค่าขั้นต่ำ (เพชร)" hint={minHint}><Input type="text" inputMode="numeric" value={draft.minDiamonds} onChange={(e) => set('minDiamonds', toDigits(e.target.value))} placeholder="เช่น 100" /></Field>
                </>
              )}
              {draft.event === 'chat' && (
                <Field label="คำในแชท"><Input required value={draft.keyword} onChange={(e) => set('keyword', e.target.value)} placeholder="!เต้น" /></Field>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="ให้ทำ">
                <Select value={draft.type} onChange={(e) => set('type', e.target.value as ActionType)}>
                  {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </Field>
              {(draft.type === 'sound' || draft.type === 'image' || draft.type === 'video') && (
                <Field label="ลิงก์ไฟล์" hint="ลิงก์ตรงไปยังไฟล์ .mp3 / .png / .gif / .mp4 (https://)">
                  <Input type="url" required value={draft.url} onChange={(e) => set('url', e.target.value)} placeholder="https://..." />
                </Field>
              )}
              <Field label={draft.type === 'text' ? 'ข้อความ' : 'ข้อความประกอบ (ไม่บังคับ)'} hint={draft.type === 'tarot' ? 'สุ่มไพ่ครบสำรับ 78 ใบ พร้อมคำทำนาย · {user} = ชื่อคนส่ง · แนะนำแสดงนาน 8 วินาที' : 'ใช้ {user} แทนชื่อคนที่ทำให้เกิดเหตุการณ์'}>
                <Input maxLength={200} value={draft.text} onChange={(e) => set('text', e.target.value)} placeholder="ขอบคุณ {user} 💕" />
              </Field>
              {draft.type === 'tarot' && (
                <Field label="จำนวนไพ่">
                  <Select value={draft.cards} onChange={(e) => { set('cards', e.target.value); set('durationSec', e.target.value === '7' ? '20' : e.target.value === '3' ? '13' : '8'); }}>
                    <option value="1">🃏 เปิด 1 ใบ — คำทำนายเดียว</option>
                    <option value="3">🃏🃏🃏 เปิด 3 ใบ — อดีต · ปัจจุบัน · อนาคต</option>
                    <option value="7">เปิด 7 ใบ — ดูดวงเต็มชุด</option>
                  </Select>
                </Field>
              )}
              {draft.type === 'effect' && (
                <Field label="จำนวนผีเสื้อ" hint="1–30 ตัว · ข้อความประกอบจะขึ้นเป็นหัวเรื่องกลางจอ">
                  <Input type="text" inputMode="numeric" value={draft.count} onChange={(e) => set('count', toDigits(e.target.value))} />
                </Field>
              )}
              {draft.type === 'tarot' && (
                <Field label="หัวข้อคำทำนาย">
                  <Select value={draft.topic} onChange={(e) => set('topic', e.target.value as TarotTopic)}>
                    <option value="general">🔮 ดวงทั่วไป</option>
                    <option value="love">💘 ความรัก — ใจคุณ · ใจเขา · อนาคตความรัก</option>
                    <option value="money">💰 การเงิน — การเงินตอนนี้ · สิ่งที่ต้องระวัง · โชคลาภที่กำลังมา</option>
                    <option value="self">🪞 ตัวตน — นิสัยจริง · คนอื่นมองคุณ · จุดเด่นที่ซ่อนอยู่</option>
                  </Select>
                </Field>
              )}
              {draft.type === 'tarot' && (
                <Field label="สำรับไพ่">
                  <Select value={draft.deck} onChange={(e) => set('deck', e.target.value as TarotDeck)}>
                    <option value="full">ครบสำรับ 78 ใบ</option>
                    <option value="major">ชุดใหญ่ 22 ใบ (Major Arcana)</option>
                    <option value="swords">⚔️ เฉพาะชุดดาบ — “ร่างกายต้องการดาบ”</option>
                    <option value="cups">🏆 เฉพาะชุดถ้วย (ความรัก)</option>
                    <option value="wands">🔥 เฉพาะชุดไม้เท้า (พลัง/งาน)</option>
                    <option value="pentacles">💰 เฉพาะชุดเหรียญ (การเงิน)</option>
                  </Select>
                </Field>
              )}
              <Field label="แสดงนาน (วินาที)"><Input type="text" inputMode="decimal" value={draft.durationSec} onChange={(e) => set('durationSec', toDigits(e.target.value, true))} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.enabled} onChange={(e) => set('enabled', e.target.checked)} className="accent-pink" /> เปิดใช้งาน</label>
            <div className="flex gap-2">
              <Button type="submit" loading={busy}>บันทึก</Button>
              <Button type="button" variant="ghost" onClick={() => { setDraft(null); setError(null); }}>ยกเลิก</Button>
            </div>
          </form>
        </Card>
        </div>
      )}

      {!draft && rules && (
        <Card className="mb-6">
          <h2 className="mb-1 flex items-center gap-2 font-medium"><Sparkles className="size-4 text-pink" /> เทมเพลตยอดนิยม</h2>
          <p className="mb-4 text-sm text-muted">กด “ใช้เลย” แล้วใช้ได้ทันที — แก้ข้อความหรือเงื่อนไขทีหลังได้ด้วยปุ่มดินสอ</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TEMPLATES.map((t) => {
              const added = have.has(t.rule.name);
              return (
                <div key={t.rule.name} className="flex flex-col rounded-xl border border-line bg-canvas/50 p-3">
                  <div className="text-2xl">{t.icon}</div>
                  <div className="mt-1 text-sm font-medium leading-snug">{t.title}</div>
                  <div className="mt-0.5 flex-1 text-xs text-muted">{t.desc}</div>
                  <Button variant={added ? 'ghost' : 'secondary'} className="mt-3 w-full" disabled={added} loading={adding === t.rule.name} onClick={() => applyTemplate(t)}>
                    {added ? <><Check className="size-4" /> เพิ่มแล้ว</> : 'ใช้เลย'}
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {!rules ? <Spinner /> : rules.length === 0 ? (
        !draft && <Card className="py-10 text-center text-sm text-muted">ยังไม่มีกฎ — เลือกเทมเพลตด้านบน หรือกด “เพิ่มกฎ” เพื่อตั้งเอง</Card>
      ) : (
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-line px-5 py-3 text-xs text-muted">
            <span className="flex items-center gap-3"><span className="w-11 shrink-0" /><span className="w-24 text-center">ของขวัญ</span><span>{rules.length}/{entitlements?.maxActionRules ?? '-'} กฎ</span></span>
            <span>มีผลกับไลฟ์ทันทีหลังบันทึก</span>
          </div>
          <ul className="divide-y divide-line">
            {rules.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <button role="switch" aria-checked={r.enabled} aria-label="เปิด/ปิดกฎ" onClick={() => toggle(r)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${r.enabled ? 'bg-mint' : 'bg-gray-200'}`}>
                  <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition ${r.enabled ? 'left-5.5' : 'left-0.5'}`} />
                </button>
                <GiftCell name={r.trigger.giftName} event={r.trigger.event} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-medium">{r.name} {!r.enabled && <Badge tone="gray">ปิดอยู่</Badge>}</div>
                  <div className="truncate text-sm text-muted">{describe(r)}</div>
                </div>
                <Button variant="ghost" className="px-3" aria-label="ทดลองเล่น" title="ทดลองเล่นบนจอ" onClick={() => test(r)}><Play className="size-4" /></Button>
                <Button variant="ghost" className="px-3" aria-label="แก้ไข" onClick={() => { setError(null); setDraft(toDraft(r)); }}><Pencil className="size-4" /></Button>
                <Button variant="ghost" className="px-3 hover:text-red-600" aria-label="ลบ" onClick={() => remove(r)}><Trash2 className="size-4" /></Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
