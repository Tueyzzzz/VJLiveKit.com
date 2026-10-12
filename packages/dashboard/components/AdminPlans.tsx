'use client';

import { useEffect, useState } from 'react';
import { RotateCcw, Save, Tags } from 'lucide-react';
import { Alert, Badge, Button, Card, Field, Input, Spinner } from './ui';
import { WIDGET_LABELS } from './Pricing';
import { api, formatMoney } from '@/lib/api';

interface Features {
  widgets: string[]; maxActionRules: number; maxTokens: number; noWatermark: boolean;
  tarot: boolean; liveStats: boolean; soundMaxMB: number; soundMaxFiles: number; prioritySupport: boolean; mascotDiscountPct: number;
}
interface PlanRow { code: string; name: string; priceCents: number; currency: string; badge: string; tagline: string; bullets: string[]; features: Features }

/** กลุ่มวิดเจ็ตสำหรับติ๊กเลือก (ตัวที่ไม่อยู่ในกลุ่มไหนจะไปอยู่ "อื่น ๆ") */
const GROUPS: [string, string[]][] = [
  ['พื้นฐาน', ['coinjar', 'collect', 'alerts', 'goal', 'chat', 'follower']],
  ['อันดับ / เวลา / ป้าย', ['topgifters', 'toplikers', 'timer', 'sign', 'fxmenu', 'donate']],
  ['สะสมของขวัญ', ['giftjar', 'aquarium', 'spacedome', 'belly', 'snowglobe', 'vehicle', 'garden', 'tree', 'pile']],
  ['Actions / เสียง', ['fx', 'tts']],
  ['PK / ลีก / มาสคอต', ['pkmvp', 'league', 'mascot']],
];
const NUMS: [keyof Features, string, string][] = [
  ['maxActionRules', 'กฎ Actions สูงสุด', 'ข้อ'],
  ['maxTokens', 'ชุดลิงก์ overlay', 'ชุด'],
  ['soundMaxMB', 'อัปโหลดเสียง/ไฟล์', 'MB (0 = ค่าระบบ)'],
  ['soundMaxFiles', 'จำนวนไฟล์เสียง', 'ไฟล์ (0 = ค่าระบบ)'],
  ['mascotDiscountPct', 'ส่วนลดสั่งทำมาสคอต', '%'],
];
const FLAGS: [keyof Features, string][] = [
  ['noWatermark', 'ไม่มีป้าย vjlivekit.com บนจอ'],
  ['tarot', 'ไพ่ทาโร่'],
  ['liveStats', 'สถิติไลฟ์ละเอียด'],
  ['prioritySupport', 'ซัพพอร์ตด่วน'],
];

/** หลังบ้าน › แพลน: แก้ชื่อ ราคา ป้าย จุดเด่น วิดเจ็ต และลิมิต — บันทึกแล้วมีผลทันทีทุกหน้า */
export function AdminPlans() {
  const [plans, setPlans] = useState<PlanRow[] | null>(null);
  const [all, setAll] = useState<string[]>([]);
  const [open, setOpen] = useState<string>('free');
  const [busy, setBusy] = useState('');
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  useEffect(() => {
    api<{ plans: PlanRow[]; widgets: string[] }>('/api/admin/plans').then((r) => { setPlans(r.plans); setAll(r.widgets); }).catch((e) => setMsg({ tone: 'error', text: (e as Error).message }));
  }, []);
  if (!plans) return msg ? <Alert>{msg.text}</Alert> : <Spinner />;

  const edit = (code: string, f: (p: PlanRow) => PlanRow) => { setPlans(plans.map((p) => (p.code === code ? f(p) : p))); setDirty(true); };
  const groups: [string, string[]][] = [...GROUPS, ['อื่น ๆ', all.filter((w) => !GROUPS.some(([, ws]) => ws.includes(w)))]].filter(([, ws]) => ws.length > 0) as [string, string[]][];

  async function save() {
    setBusy('save'); setMsg(null);
    try { const r = await api<{ plans: PlanRow[] }>('/api/admin/plans', { method: 'PUT', body: { plans } }); setPlans(r.plans); setDirty(false); setMsg({ tone: 'success', text: 'บันทึกแล้ว ✓ มีผลทันที (หน้าราคา + สิทธิ์ลูกค้า)' }); }
    catch (e) { setMsg({ tone: 'error', text: (e as Error).message }); } finally { setBusy(''); }
  }
  async function reset(code: string) {
    if (!confirm('คืนค่าเริ่มต้นของแพลนนี้? (ลบที่แก้ไว้ทั้งหมด)')) return;
    setBusy('reset'); setMsg(null);
    try { const r = await api<{ plans: PlanRow[] }>(`/api/admin/plans/${code}/reset`, { method: 'POST', body: {} }); setPlans(r.plans); setMsg({ tone: 'success', text: 'คืนค่าเริ่มต้นแล้ว ✓' }); }
    catch (e) { setMsg({ tone: 'error', text: (e as Error).message }); } finally { setBusy(''); }
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-semibold"><Tags className="size-5 text-pink" /> แพลน & ราคา</div>
          <p className="mt-1 text-xs text-muted">แก้แล้วกดบันทึก — หน้าราคา/หน้าแพลนของลูกค้า และสิทธิ์ใช้งานเปลี่ยนทันที · ช่วงทดลองฟรีได้สิทธิ์เท่าแพลนสูงสุด (แต่มีป้ายบนจอ)</p>
        </div>
        <Button onClick={save} loading={busy === 'save'} disabled={!dirty}><Save className="size-4" /> บันทึกทั้งหมด</Button>
      </Card>
      {msg && <Alert tone={msg.tone === 'error' ? undefined : msg.tone}>{msg.text}</Alert>}

      {plans.map((p) => (
        <Card key={p.code} className="p-0">
          <button type="button" className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left" onClick={() => setOpen(open === p.code ? '' : p.code)}>
            <span className="font-display text-lg">{p.name}</span>
            <span className="text-sm text-muted">{p.priceCents > 0 ? `${formatMoney(p.priceCents, p.currency)}/เดือน` : 'ฟรี'}</span>
            {p.badge && <Badge tone="pink">{p.badge}</Badge>}
            <span className="ml-auto text-xs text-muted">{p.features.widgets.length}/{all.length} วิดเจ็ต · {p.features.maxActionRules} กฎ · {p.features.noWatermark ? 'ไม่มีป้าย' : 'มีป้าย'} · <code>{p.code}</code></span>
          </button>
          {open === p.code && (
            <div className="space-y-4 border-t border-line p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="ชื่อแพลน"><Input value={p.name} maxLength={40} onChange={(e) => edit(p.code, (x) => ({ ...x, name: e.target.value }))} /></Field>
                <Field label="ราคา/เดือน (บาท)" hint={p.code === 'free' ? 'แพลนฟรีราคา 0 เสมอ' : undefined}>
                  <Input type="number" min={0} disabled={p.code === 'free'} value={p.priceCents / 100} onChange={(e) => edit(p.code, (x) => ({ ...x, priceCents: Math.max(0, Math.round(Number(e.target.value) * 100) || 0) }))} />
                </Field>
                <Field label="ป้ายเด่น" hint="เช่น ยอดนิยม · เว้นว่าง = ไม่แสดง"><Input value={p.badge} maxLength={30} onChange={(e) => edit(p.code, (x) => ({ ...x, badge: e.target.value }))} /></Field>
                <Field label="คำโปรยสั้น ๆ"><Input value={p.tagline} maxLength={120} onChange={(e) => edit(p.code, (x) => ({ ...x, tagline: e.target.value }))} /></Field>
              </div>
              <Field label="จุดเด่น (บรรทัดละ 1 ข้อ)" hint="แสดงบนการ์ดราคา · ลิมิตกฎ/ลิงก์/ป้าย แสดงให้อัตโนมัติ">
                <textarea rows={4} className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm" value={p.bullets.join('\n')}
                  onChange={(e) => edit(p.code, (x) => ({ ...x, bullets: e.target.value.split('\n') }))} onBlur={() => edit(p.code, (x) => ({ ...x, bullets: x.bullets.map((b) => b.trim()).filter(Boolean) }))} />
              </Field>

              <div>
                <h4 className="mb-2 text-sm font-semibold">ลิมิต</h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {NUMS.map(([k, label, unit]) => (
                    <Field key={k} label={label} hint={unit}>
                      <Input type="number" min={0} value={p.features[k] as number} onChange={(e) => edit(p.code, (x) => ({ ...x, features: { ...x.features, [k]: Math.max(0, Math.round(Number(e.target.value)) || 0) } }))} />
                    </Field>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  {FLAGS.map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={!!p.features[k]} onChange={(e) => edit(p.code, (x) => ({ ...x, features: { ...x.features, [k]: e.target.checked } }))} /> {label}</label>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-semibold">วิดเจ็ตที่ใช้ได้ ({p.features.widgets.length}/{all.length})</h4>
                  <button type="button" className="text-xs text-violet underline" onClick={() => edit(p.code, (x) => ({ ...x, features: { ...x.features, widgets: [...all] } }))}>เลือกทั้งหมด</button>
                  <button type="button" className="text-xs text-violet underline" onClick={() => edit(p.code, (x) => ({ ...x, features: { ...x.features, widgets: [] } }))}>ล้าง</button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {groups.map(([g, ws]) => (
                    <div key={g} className="rounded-xl border border-line p-3">
                      <div className="mb-1.5 text-xs font-semibold text-muted">{g}</div>
                      <div className="space-y-1.5">
                        {ws.map((w) => (
                          <label key={w} className="flex items-center gap-2 text-sm">
                            <input type="checkbox" className="size-4" checked={p.features.widgets.includes(w)}
                              onChange={(e) => edit(p.code, (x) => ({ ...x, features: { ...x.features, widgets: e.target.checked ? [...x.features.widgets, w] : x.features.widgets.filter((y) => y !== w) } }))} />
                            {WIDGET_LABELS[w] ?? w}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={save} loading={busy === 'save'} disabled={!dirty}><Save className="size-4" /> บันทึก</Button>
                <Button variant="secondary" onClick={() => reset(p.code)} loading={busy === 'reset'}><RotateCcw className="size-4" /> คืนค่าเริ่มต้น</Button>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
