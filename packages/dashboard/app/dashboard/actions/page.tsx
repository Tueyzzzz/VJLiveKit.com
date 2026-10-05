'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select, Spinner } from '@/components/ui';
import { api, ApiError, type ActionType, type Rule, type TriggerEvent } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const EVENT_LABELS: Record<TriggerEvent, string> = { gift: '🎁 ได้รับกิฟต์', follow: '➕ มีคนติดตาม', share: '🔁 มีคนแชร์', like: '❤️ มีคนกดไลค์', chat: '💬 แชทมีคำว่า' };
const ACTION_LABELS: Record<ActionType, string> = { sound: '🔊 เล่นเสียง', image: '🖼️ แสดงรูป/GIF', video: '🎬 เล่นวิดีโอ', text: '✏️ แสดงข้อความ' };

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
}

const EMPTY: Draft = { name: '', enabled: true, event: 'gift', giftName: '', minDiamonds: '', keyword: '', type: 'sound', url: '', text: '', durationSec: '5' };

function toDraft(r: Rule): Draft {
  return {
    id: r.id, name: r.name, enabled: r.enabled, event: r.trigger.event,
    giftName: r.trigger.giftName ?? '', minDiamonds: r.trigger.minDiamonds != null ? String(r.trigger.minDiamonds) : '',
    keyword: r.trigger.keyword ?? '', type: r.action.type, url: r.action.url ?? '', text: r.action.text ?? '',
    durationSec: r.action.durationMs ? String(r.action.durationMs / 1000) : '5',
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
  if (d.type !== 'text' && d.url.trim()) action.url = d.url.trim();
  if (d.text.trim()) action.text = d.text.trim();
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
  return `${s} → ${ACTION_LABELS[r.action.type]}${r.action.text ? ` “${r.action.text}”` : ''}`;
}

export default function ActionsPage() {
  const { entitlements } = useAuth();
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<{ text: string; upgrade?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setRules((await api<{ rules: Rule[] }>('/api/actions')).rules); }
    catch (err) { setError({ text: (err as Error).message }); setRules([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    if (draft.type !== 'text' && !draft.url.trim()) { setError({ text: 'ใส่ลิงก์ไฟล์ (https://...) ด้วย' }); return; }
    if (draft.type === 'text' && !draft.text.trim()) { setError({ text: 'ใส่ข้อความที่จะแสดงด้วย' }); return; }
    setBusy(true);
    setError(null);
    try {
      const body = toBody(draft);
      if (draft.id) await api(`/api/actions/${draft.id}`, { method: 'PUT', body });
      else await api('/api/actions', { method: 'POST', body });
      setDraft(null);
      await load();
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

  async function remove(r: Rule) {
    if (!confirm(`ลบกฎ “${r.name}”?`)) return;
    try { await api(`/api/actions/${r.id}`, { method: 'DELETE' }); await load(); }
    catch (err) { setError({ text: (err as Error).message }); }
  }

  const fxLocked = entitlements ? !entitlements.widgets.includes('fx') : false;

  return (
    <div>
      <PageHeader title="Actions & Events"
        description="ตั้งกฎอัตโนมัติ: เมื่อเกิดเหตุการณ์ในไลฟ์ → overlay FX เล่นเสียง/รูป/วิดีโอ/ข้อความ"
        actions={!draft && <Button onClick={() => { setError(null); setDraft({ ...EMPTY }); }}><Plus className="size-4" /> เพิ่มกฎ</Button>} />

      {fxLocked && (
        <div className="mb-5">
          <Alert tone="info">overlay FX (ที่เล่น Actions) ใช้ได้ในแพลน Pro — ตั้งกฎไว้ก่อนได้ แล้ว <Link href="/dashboard/billing/" className="font-medium text-pink underline">อัปเกรด</Link> เพื่อให้แสดงบนไลฟ์</Alert>
        </div>
      )}
      {error && <div className="mb-5"><Alert>{error.text} {error.upgrade && <Link href="/dashboard/billing/" className="font-medium underline">อัปเกรด</Link>}</Alert></div>}

      {draft && (
        <Card className="mb-6">
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
                  <Field label="ชื่อกิฟต์ (เว้นว่าง = ทุกกิฟต์)"><Input value={draft.giftName} onChange={(e) => set('giftName', e.target.value)} placeholder="Rose" /></Field>
                  <Field label="มูลค่าขั้นต่ำ (เพชร)"><Input type="number" min={0} value={draft.minDiamonds} onChange={(e) => set('minDiamonds', e.target.value)} placeholder="เช่น 100" /></Field>
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
              {draft.type !== 'text' && (
                <Field label="ลิงก์ไฟล์" hint="ลิงก์ตรงไปยังไฟล์ .mp3 / .png / .gif / .mp4 (https://)">
                  <Input type="url" required value={draft.url} onChange={(e) => set('url', e.target.value)} placeholder="https://..." />
                </Field>
              )}
              <Field label={draft.type === 'text' ? 'ข้อความ' : 'ข้อความประกอบ (ไม่บังคับ)'} hint="ใช้ {user} แทนชื่อคนที่ทำให้เกิดเหตุการณ์">
                <Input maxLength={200} value={draft.text} onChange={(e) => set('text', e.target.value)} placeholder="ขอบคุณ {user} 💕" />
              </Field>
              <Field label="แสดงนาน (วินาที)"><Input type="number" min={1} max={60} step="0.5" value={draft.durationSec} onChange={(e) => set('durationSec', e.target.value)} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.enabled} onChange={(e) => set('enabled', e.target.checked)} className="accent-pink" /> เปิดใช้งาน</label>
            <div className="flex gap-2">
              <Button type="submit" loading={busy}>บันทึก</Button>
              <Button type="button" variant="ghost" onClick={() => { setDraft(null); setError(null); }}>ยกเลิก</Button>
            </div>
          </form>
        </Card>
      )}

      {!rules ? <Spinner /> : rules.length === 0 ? (
        !draft && <Card className="py-10 text-center text-sm text-muted">ยังไม่มีกฎ — กด “เพิ่มกฎ” เพื่อเริ่ม</Card>
      ) : (
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-line px-5 py-3 text-xs text-muted">
            <span>{rules.length}/{entitlements?.maxActionRules ?? '-'} กฎ</span>
            <span>มีผลกับไลฟ์ทันทีหลังบันทึก</span>
          </div>
          <ul className="divide-y divide-line">
            {rules.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <button role="switch" aria-checked={r.enabled} aria-label="เปิด/ปิดกฎ" onClick={() => toggle(r)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${r.enabled ? 'bg-mint' : 'bg-gray-200'}`}>
                  <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition ${r.enabled ? 'left-5.5' : 'left-0.5'}`} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-medium">{r.name} {!r.enabled && <Badge tone="gray">ปิดอยู่</Badge>}</div>
                  <div className="truncate text-sm text-muted">{describe(r)}</div>
                </div>
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
