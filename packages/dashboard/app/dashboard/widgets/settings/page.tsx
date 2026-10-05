'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, RotateCcw, Save } from 'lucide-react';
import { WIDGET_LABELS } from '@/components/Pricing';
import { Alert, Button, Card, Field, Input, PageHeader, Select, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
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

function FieldInput({ f, value, onChange }: { f: FieldDef; value: Values[string]; onChange: (v: Values[string]) => void }) {
  switch (f.type) {
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
      return <Input type="number" min={f.min} max={f.max} value={String(value)} onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))} />;
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
                          ? <img src={`${API_BASE}/overlay/themes/thumbs/${thumb}.webp`} alt="" loading="lazy" className="max-h-full max-w-full object-contain p-1" />
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
