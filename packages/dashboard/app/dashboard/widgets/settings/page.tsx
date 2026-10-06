'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Copy, RotateCcw, Save } from 'lucide-react';
import { WIDGET_LABELS } from '@/components/Pricing';
import { Alert, Button, Card, Field, Input, PageHeader, Select, Spinner } from '@/components/ui';
import { api, ApiError, type OverlayTokenRow } from '@/lib/api';
import { NumberInput } from '@/components/NumberInput';
import { GiftPicker, useGifts } from '@/components/GiftPicker';
import { WIDGET_SETTINGS, defaultsOf, toOverlayParams, type FieldDef, type Values } from '@/lib/widgetSettings';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

/** จัดตัวเลือกเป็นกลุ่มตามลำดับที่เจอ (ตัวเลือกที่ไม่มีกลุ่มอยู่นอก optgroup) */
type Opt = [string, string, string?, string?];
function groupOptions(options: Opt[]): [string, Opt[]][] {
  const out: [string, Opt[]][] = [];
  for (const o of options) {
    const g = o[2] ?? '';
    const hit = out.find(([k]) => k === g);
    if (hit) hit[1].push(o); else out.push([g, [o]]);
  }
  return out;
}

const COLLECT_TYPES = ['giftjar', 'aquarium', 'belly', 'snowglobe', 'spacedome', 'vehicle', 'tree', 'garden', 'coinjar'];

function CopyLink({ url, label = 'คัดลอกลิงก์' }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg bg-canvas px-3 py-2 text-xs text-muted">{url}</code>
      <Button variant="secondary" onClick={() => { void navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
        {copied ? <><Check className="size-4" /> คัดลอกแล้ว</> : <><Copy className="size-4" /> {label}</>}
      </Button>
    </div>
  );
}

/** ลิงก์ OBS ของวิดเจ็ตนี้ (จากชุดลิงก์แรก) + ปุ่มคัดลอก · แบบสะสมของขวัญ = แสดงลิงก์เดียว (collect) เป็นหลัก */
function WidgetLinkBox({ type }: { type: string }) {
  const isCollect = COLLECT_TYPES.includes(type);
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const [collectUrl, setCollectUrl] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    api<{ tokens: OverlayTokenRow[] }>('/api/overlay-tokens')
      .then((r) => {
        const urls = r.tokens[0]?.urls ?? [];
        const w = urls.find((u) => u.type === type); setUrl(w && !w.locked ? w.url : null);
        const c = urls.find((u) => u.type === 'collect'); setCollectUrl(c && !c.locked ? c.url : null);
      })
      .catch(() => setUrl(null));
    if (isCollect) api<{ config: Record<string, unknown> }>('/api/widgets/collect/config').then((r) => setActive(String(r.config?.style ?? 'giftjar'))).catch(() => {});
  }, [type, isCollect]);
  async function useThis() {
    try { await api('/api/widgets/collect/config', { method: 'PUT', body: { style: type } }); setActive(type); } catch { /* ignore */ }
  }
  if (url === undefined) return null;
  return (
    <Card className="mb-6">
      {isCollect && collectUrl ? (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-violet">
            🔗 ลิงก์เดียว (สะสมของขวัญทุกแบบ)
            {active === type ? <span className="rounded-full bg-pink-soft px-2 py-0.5 text-xs text-pink">✓ ลิงก์เดียวกำลังใช้แบบนี้</span>
              : <Button variant="secondary" className="px-3 py-1 text-xs" onClick={useThis}>ใช้แบบนี้กับลิงก์เดียว</Button>}
          </div>
          <CopyLink url={collectUrl} />
          <p className="mt-2 text-xs text-muted">ลิงก์นี้ลิงก์เดียวกับในหน้าวิดเจ็ต — ใส่ OBS ครั้งเดียว เปลี่ยนแบบได้ตลอดโดยไม่ต้องเปลี่ยนลิงก์ · ตั้งค่าด้านล่างมีผลกับแบบนี้</p>
          {url && (
            <details className="mt-3 text-xs text-muted">
              <summary className="cursor-pointer">ลิงก์เฉพาะแบบนี้ (ใช้แยกได้ ถ้าอยากโชว์หลายแบบพร้อมกัน)</summary>
              <div className="mt-2"><CopyLink url={url} /></div>
            </details>
          )}
        </>
      ) : (
        <>
          <div className="mb-2 text-sm font-semibold text-violet">ลิงก์สำหรับ OBS / TikTok Live Studio</div>
          {url ? <CopyLink url={url} /> : (
            <p className="text-sm text-muted">ยังไม่มีลิงก์ — <Link href="/dashboard/widgets/" className="text-pink underline">สร้างชุดลิงก์ที่หน้าวิดเจ็ต</Link> ก่อน</p>
          )}
          <p className="mt-2 text-xs text-muted">ลิงก์เดิมใช้ได้ตลอด — แก้แบบแล้วกดบันทึก จอใน OBS เปลี่ยนเองภายในไม่กี่วินาที ไม่ต้องรีเฟรช</p>
        </>
      )}
    </Card>
  );
}

interface MenuRow { id: string; event: string; gift?: string; th?: string; image?: string; minDiamonds?: number; keyword?: string; label: string }
interface MenuSel { hide?: string[]; icons?: Record<string, string> }

/** เลือกว่าจะโชว์กฎไหนในเมนูของขวัญ + เปลี่ยนรูปของขวัญที่แสดง (เช่น กฎ "ทุกกิฟต์ 99💎" ให้โชว์รูป Galaxy) */
function MenuItemsEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [rows, setRows] = useState<MenuRow[] | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const gifts = useGifts();
  useEffect(() => { api<{ items: MenuRow[] }>('/api/actions/menu').then((r) => setRows(r.items)).catch(() => setRows([])); }, []);
  let sel: MenuSel = {}; try { sel = value ? JSON.parse(value) as MenuSel : {}; } catch { /* ค่าเสีย */ }
  const hide = new Set(sel.hide ?? []), icons = sel.icons ?? {};
  const put = (next: MenuSel) => onChange(JSON.stringify(next));
  if (!rows) return <Spinner />;
  if (!rows.length) return <p className="text-sm text-muted">ยังไม่มีกฎ — <Link href="/dashboard/actions/" className="text-pink underline">ตั้งกฎที่ Actions &amp; Events</Link></p>;
  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const img = icons[r.id] || r.image;
        const how = r.event === 'gift' ? (r.gift ? `ส่ง ${r.th || r.gift}` : r.minDiamonds ? `กิฟต์ 💎${r.minDiamonds}+` : 'ทุกกิฟต์') : r.event === 'chat' ? `พิมพ์ “${r.keyword ?? ''}”` : r.event;
        return (
          <div key={r.id} className={`rounded-xl border border-line p-2 ${hide.has(r.id) ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-2">
              <input type="checkbox" className="size-4 accent-pink" checked={!hide.has(r.id)} aria-label="แสดงในเมนู"
                onChange={(e) => { const h = new Set(hide); if (e.target.checked) h.delete(r.id); else h.add(r.id); put({ ...sel, hide: [...h] }); }} />
              <button type="button" title="เลือกรูปของขวัญที่จะแสดง" onClick={() => setPicking(picking === r.id ? null : r.id)}
                className="grid size-10 shrink-0 place-items-center rounded-lg bg-pink-soft/60 ring-pink hover:ring-2">
                {img ? <img src={img} alt="" className="size-8 object-contain" /> : <span className="text-xl">🎁</span>}
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.label}</div>
                <div className="truncate text-xs text-muted">{how}{icons[r.id] ? ' · รูปที่เลือกเอง' : ''}</div>
              </div>
            </div>
            {picking === r.id && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1"><GiftPicker value={gifts.find((g) => g.image === icons[r.id])?.name ?? ''} onChange={(name) => {
                  const g = gifts.find((x) => x.name === name); const next = { ...icons };
                  if (g?.image) next[r.id] = g.image; else delete next[r.id];
                  put({ ...sel, icons: next }); setPicking(null);
                }} /></div>
                {icons[r.id] && <Button type="button" variant="ghost" className="px-2 text-xs" onClick={() => { const next = { ...icons }; delete next[r.id]; put({ ...sel, icons: next }); setPicking(null); }}>ใช้รูปเดิม</Button>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FieldInput({ f, value, onChange }: { f: FieldDef; value: Values[string]; onChange: (v: Values[string]) => void }) {
  switch (f.type) {
    case 'menuItems':
      return <MenuItemsEditor value={String(value ?? '')} onChange={onChange} />;
    case 'toggle':
      return (
        <button type="button" role="switch" aria-checked={!!value} onClick={() => onChange(!value)}
          className={`relative h-6 w-11 rounded-full transition ${value ? 'bg-pink' : 'bg-gray-300'}`}>
          <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${value ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      );
    case 'range':
      return (
        <div className="flex items-center gap-3">
          <input type="range" min={f.min} max={f.max} step={f.step} value={Number(value)} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-pink" />
          <span className="w-16 text-right text-sm tabular-nums text-muted">{Number(value)}{f.unit ?? ''}</span>
        </div>
      );
    case 'swatch':
      return (
        <div className="flex flex-wrap gap-2">
          {f.options.map(([v, color, name]) => {
            const on = Number(value) === v;
            return (
              <button key={v} type="button" title={name} aria-label={name} aria-pressed={on} onClick={() => onChange(v)}
                className={`size-9 rounded-full border-2 shadow-sm transition ${on ? 'scale-110 border-ink ring-2 ring-pink/40' : 'border-white hover:scale-105'}`}
                style={{ background: color }} />
            );
          })}
        </div>
      );
    case 'number':
      return <NumberInput min={f.min} max={f.max} value={value as number} onChange={(n) => onChange(n)} />;
    case 'select':
      // มีรูปย่อ → กางเป็นการ์ดรูปตามหมวด ให้เห็นทุกแบบแล้วกดเลือกได้เลย
      if (f.options.some((o) => o[3])) return (
        <div className="space-y-3">
          {groupOptions(f.options).map(([g, opts]) => (
            <div key={g || '-'}>
              {g && <div className="mb-1.5 text-xs font-semibold text-violet">{g}</div>}
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {opts.map(([v, l, , thumb]) => {
                  const on = String(value) === v;
                  return (
                    <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={on} title={l}
                      className={`flex flex-col items-center gap-1 rounded-xl border-2 p-1.5 text-center transition ${on ? 'border-pink bg-pink-soft' : 'border-line bg-white hover:border-pink/40'}`}>
                      <span className="grid aspect-square w-full place-items-center overflow-hidden rounded-lg bg-canvas">
                        {thumb
                          ? <img src={thumb.startsWith('/') ? `${API_BASE}${thumb}` : `${API_BASE}/overlay/themes/thumbs/${thumb}.webp`} alt="" loading="lazy" className="max-h-full max-w-full object-contain p-1" />
                          : <span className="text-2xl">✏️</span>}
                      </span>
                      <span className={`line-clamp-2 text-[11px] leading-tight ${on ? 'font-medium text-pink' : 'text-muted'}`}>{l}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      );
      return (
        <Select value={String(value)} onChange={(e) => onChange(e.target.value)}>
          {groupOptions(f.options).map(([g, opts]) => g
            ? <optgroup key={g} label={g}>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</optgroup>
            : opts.map(([v, l]) => <option key={v} value={v}>{l}</option>))}
        </Select>
      );
    case 'color':
      return <input type="color" value={String(value)} onChange={(e) => onChange(e.target.value)} className="h-9 w-16 cursor-pointer rounded-lg border border-line bg-white" />;
    case 'text':
      return <Input value={String(value)} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />;
  }
}

function WidgetSettings() {
  const type = useSearchParams().get('type') ?? '';
  const def = WIDGET_SETTINGS[type];
  const [values, setValues] = useState<Values | null>(null);
  const [saved, setSaved] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [previewSrc, setPreviewSrc] = useState('');

  // โหลดค่าที่บันทึกไว้ (รวมกับค่าเริ่มต้น)
  useEffect(() => {
    if (!def) return;
    const base = defaultsOf(def);
    api<{ config: Record<string, unknown> }>(`/api/widgets/${type}/config`)
      .then(({ config }) => {
        const v: Values = { ...base };
        for (const k of Object.keys(base)) {
          const c = config?.[k];
          if (c === undefined || c === null) continue;
          v[k] = typeof base[k] === 'boolean' ? c === true || c === '1' || c === 1 : typeof base[k] === 'number' ? Number(c) : String(c);
        }
        setValues(v); setSaved(JSON.stringify(v));
      })
      .catch(() => { setValues(base); setSaved(JSON.stringify(base)); });
  }, [type, def]);

  // พรีวิวสด (โหมดเดโม) — หน่วงเล็กน้อยกันโหลดถี่ตอนลากสไลเดอร์
  useEffect(() => {
    if (!values) return;
    const t = setTimeout(() => {
      const q = new URLSearchParams({ demo: '1', reset: '1', ...toOverlayParams(values) });
      setPreviewSrc(`${API_BASE}/overlay/${type}.html?${q.toString()}`);
    }, 400);
    return () => clearTimeout(t);
  }, [values, type]);

  const dirty = useMemo(() => values !== null && JSON.stringify(values) !== saved, [values, saved]);

  async function save(extra: Record<string, unknown> = {}) {
    if (!values) return;
    setBusy(true); setMsg(null);
    try {
      await api(`/api/widgets/${type}/config`, { method: 'PUT', body: { ...toOverlayParams(values), ...extra } });
      setSaved(JSON.stringify(values));
      setMsg({ tone: 'success', text: extra.resetAt ? 'ล้างข้อมูลแล้ว — วิดเจ็ตบนจอเริ่มใหม่' : 'บันทึกแล้ว — วิดเจ็ตบนจอเปลี่ยนตามทันที (ไม่ต้องเปลี่ยนลิงก์)' });
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof ApiError ? err.message : 'บันทึกไม่สำเร็จ' });
    } finally { setBusy(false); }
  }

  if (!def) {
    return (
      <div>
        <PageHeader title="ตั้งค่าวิดเจ็ต" />
        <Alert tone="info">วิดเจ็ตนี้ไม่มีตั้งค่าเพิ่มเติม{type === 'fx' ? ' — ตั้งกฎได้ที่หน้า Actions & Events' : ''}</Alert>
        <Link href="/dashboard/widgets/" className="mt-4 inline-flex items-center gap-1 text-sm text-pink hover:underline"><ArrowLeft className="size-4" /> กลับหน้าวิดเจ็ต</Link>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={`ตั้งค่า: ${WIDGET_LABELS[type] ?? type}`}
        description="ตั้งค่าแล้วกดบันทึก — วิดเจ็ตที่เปิดอยู่ใน OBS / TikTok Live Studio จะเปลี่ยนตามทันที"
        actions={<Link href="/dashboard/widgets/"><Button variant="secondary"><ArrowLeft className="size-4" /> กลับ</Button></Link>} />

      <WidgetLinkBox type={type} />

      {!values ? <Spinner /> : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div className="space-y-4">
            {def.sections.map((s) => {
              const fields = s.fields.filter((f) => !f.when || f.when(values));
              if (!fields.length) return null;
              return (
                <Card key={s.title}>
                  <h2 className="mb-3 text-sm font-semibold text-violet">{s.title}</h2>
                  <div className="space-y-4">
                    {fields.map((f) => f.type === 'toggle' ? (
                      <div key={f.key} className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-ink">{f.label}</span>
                        <FieldInput f={f} value={values[f.key]} onChange={(v) => setValues({ ...values, [f.key]: v })} />
                      </div>
                    ) : (
                      <Field key={f.key} label={f.label} hint={f.hint}>
                        <FieldInput f={f} value={values[f.key]} onChange={(v) => setValues({ ...values, [f.key]: v })} />
                      </Field>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <Card className="p-3">
              <div className="mb-2 flex items-center justify-between text-xs text-muted">
                <span>พรีวิว (ข้อมูลจำลอง)</span><span>16:9</span>
              </div>
              <div className="relative aspect-video overflow-hidden rounded-xl"
                style={{ background: 'repeating-conic-gradient(#ece6f5 0% 25%, #f8f5fc 0% 50%) 50% / 24px 24px' }}>
                {previewSrc && (
                  <iframe key={previewSrc} src={previewSrc} title="พรีวิววิดเจ็ต"
                    className="absolute left-0 top-0 h-[1080px] w-[1920px] origin-top-left border-0"
                    style={{ transform: 'scale(var(--s))' }}
                    ref={(el) => { if (el?.parentElement) el.style.setProperty('--s', String(el.parentElement.clientWidth / 1920)); }} />
                )}
              </div>
            </Card>
            {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => save()} loading={busy} disabled={!dirty}><Save className="size-4" /> บันทึก</Button>
              <Button variant="secondary" onClick={() => setValues(defaultsOf(def))}><RotateCcw className="size-4" /> คืนค่าเริ่มต้น</Button>
              {def.resettable && (
                <Button variant="danger" onClick={() => { if (confirm(`${def.resettable}? (ทำย้อนกลับไม่ได้)`)) void save({ resetAt: Date.now() }); }} loading={busy}>
                  {def.resettable}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WidgetSettingsPage() {
  return <Suspense fallback={<Spinner />}><WidgetSettings /></Suspense>;
}
