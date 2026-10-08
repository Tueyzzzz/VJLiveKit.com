'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Copy, RotateCcw, Save } from 'lucide-react';
import { WIDGET_LABELS } from '@/components/Pricing';

/** ไอคอนแถบสลับแบบสะสมของขวัญ */
const COLLECT_ICON: Record<string, string> = { pile: '🏔️', giftjar: '🫙', aquarium: '🐠', belly: '🐷', snowglobe: '❄️', spacedome: '🪐', vehicle: '🚗', tree: '🌳', garden: '🌷', coinjar: '⚙️' };
import { Alert, Button, Card, Field, Input, PageHeader, Select, Spinner } from '@/components/ui';
import { api, ApiError, type OverlayTokenRow } from '@/lib/api';
import { NumberInput } from '@/components/NumberInput';
import { GiftPicker, useGifts } from '@/components/GiftPicker';
import { useLang, useT } from '@/lib/i18n';
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

const COLLECT_TYPES = ['pile', 'giftjar', 'aquarium', 'belly', 'snowglobe', 'spacedome', 'vehicle', 'tree', 'garden', 'coinjar'];

function CopyLink({ url, label = 'คัดลอกลิงก์' }: { url: string; label?: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg bg-canvas px-3 py-2 text-xs text-muted">{url}</code>
      <Button variant="secondary" onClick={() => { void navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
        {copied ? <><Check className="size-4" /> {t('คัดลอกแล้ว')}</> : <><Copy className="size-4" /> {t(label)}</>}
      </Button>
    </div>
  );
}

/** ลิงก์ OBS ของวิดเจ็ตนี้ (จากชุดลิงก์แรก) + ปุ่มคัดลอก · แบบสะสมของขวัญ = แสดงลิงก์เดียว (collect) เป็นหลัก */
function WidgetLinkBox({ type }: { type: string }) {
  const t = useT();
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
    if (!isCollect) return;
    const f = () => api<{ config: Record<string, unknown> }>('/api/widgets/collect/config').then((r) => setActive(String(r.config?.style ?? 'giftjar'))).catch(() => {});
    void f(); window.addEventListener('vjl-collect-active', f);
    return () => window.removeEventListener('vjl-collect-active', f);
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
            {t('🔗 ลิงก์เดียว (สะสมของขวัญทุกแบบ)')}
            {active === type ? <span className="rounded-full bg-pink-soft px-2 py-0.5 text-xs text-pink">{t('✓ ลิงก์เดียวกำลังใช้แบบนี้')}</span>
              : <Button variant="secondary" className="px-3 py-1 text-xs" onClick={useThis}>{t('ใช้แบบนี้กับลิงก์เดียว')}</Button>}
          </div>
          <CopyLink url={collectUrl} />
          <p className="mt-2 text-xs text-muted">{t('ลิงก์นี้ลิงก์เดียวกับในหน้าวิดเจ็ต — ใส่ OBS ครั้งเดียว เปลี่ยนแบบได้ตลอดโดยไม่ต้องเปลี่ยนลิงก์ · ตั้งค่าด้านล่างมีผลกับแบบนี้')}</p>
          {url && (
            <details className="mt-3 text-xs text-muted">
              <summary className="cursor-pointer">{t('ลิงก์เฉพาะแบบนี้ (ใช้แยกได้ ถ้าอยากโชว์หลายแบบพร้อมกัน)')}</summary>
              <div className="mt-2"><CopyLink url={url} /></div>
            </details>
          )}
        </>
      ) : (
        <>
          <div className="mb-2 text-sm font-semibold text-violet">{t('ลิงก์สำหรับ OBS / TikTok Live Studio')}</div>
          {url ? <CopyLink url={url} /> : (
            <p className="text-sm text-muted">{t('ยังไม่มีลิงก์ —')} <Link href="/dashboard/" className="text-pink underline">{t('ตั้งชื่อ TikTok ที่หน้าภาพรวมก่อน แล้วลิงก์จะสร้างให้อัตโนมัติ')}</Link></p>
          )}
          <p className="mt-2 text-xs text-muted">{t('ลิงก์เดิมใช้ได้ตลอด — แก้แบบแล้วกดบันทึก จอใน OBS เปลี่ยนเองภายในไม่กี่วินาที ไม่ต้องรีเฟรช')}</p>
        </>
      )}
    </Card>
  );
}

interface MenuRow { id: string; event: string; gift?: string; th?: string; image?: string; minDiamonds?: number; keyword?: string; label: string }
/** รายการที่วีเจเพิ่มเอง (ไม่ต้องมีกฎ Actions) เช่น Rose → ร้องเพลง 1 เพลง */
interface MenuCustom { id: string; gift: string; image?: string; diamonds?: number; th?: string; label: string }
interface MenuSel { hide?: string[]; icons?: Record<string, string>; custom?: MenuCustom[]; labels?: Record<string, string> }

/** เลือกว่าจะโชว์กฎไหนในเมนูของขวัญ + เปลี่ยนรูปของขวัญที่แสดง (เช่น กฎ "ทุกกิฟต์ 99💎" ให้โชว์รูป Galaxy) */
function MenuItemsEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [rows, setRows] = useState<MenuRow[] | null>(null);
  const t = useT();
  const [lang] = useLang();
  const [picking, setPicking] = useState<string | null>(null);
  const gifts = useGifts();
  useEffect(() => { api<{ items: MenuRow[] }>('/api/actions/menu').then((r) => setRows(r.items)).catch(() => setRows([])); }, []);
  let sel: MenuSel = {}; try { sel = value ? JSON.parse(value) as MenuSel : {}; } catch { /* ค่าเสีย */ }
  const hide = new Set(sel.hide ?? []), icons = sel.icons ?? {}, labels = sel.labels ?? {};
  const put = (next: MenuSel) => onChange(JSON.stringify(next));
  if (!rows) return <Spinner />;
  const custom = sel.custom ?? [];
  const setCustom = (list: MenuCustom[]) => put({ ...sel, custom: list });
  const addCustom = (name: string) => {
    const g = gifts.find((x) => x.name === name); if (!g) return;
    setCustom([...custom, { id: 'c' + Date.now().toString(36), gift: g.name, image: g.image, diamonds: g.diamonds, th: g.th, label: '' }]);
  };
  return (
    <div className="space-y-2">
      {rows.length === 0 && <p className="text-xs text-muted">{t('ยังไม่มีกฎ —')} <Link href="/dashboard/actions/" className="text-pink underline">{t('ตั้งกฎที่ Actions & Events')}</Link> {t('หรือเพิ่มของขวัญเองด้านล่าง')}</p>}
      {rows.map((r) => {
        const img = icons[r.id] || r.image;
        const how = r.event === 'gift' ? (r.gift ? t('ส่ง {gift}', { gift: (lang === 'en' ? r.gift : r.th) || r.gift }) : r.minDiamonds ? t('กิฟต์ 💎{n}+', { n: r.minDiamonds }) : t('ทุกกิฟต์')) : r.event === 'chat' ? t('พิมพ์ “{keyword}”', { keyword: r.keyword ?? '' }) : r.event;
        return (
          <div key={r.id} className={`rounded-xl border border-line p-2 ${hide.has(r.id) ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-2">
              <input type="checkbox" className="size-4 accent-pink" checked={!hide.has(r.id)} aria-label={t('แสดงในเมนู')}
                onChange={(e) => { const h = new Set(hide); if (e.target.checked) h.delete(r.id); else h.add(r.id); put({ ...sel, hide: [...h] }); }} />
              <button type="button" title={t('เลือกรูปของขวัญที่จะแสดง')} onClick={() => setPicking(picking === r.id ? null : r.id)}
                className="grid size-10 shrink-0 place-items-center rounded-lg bg-pink-soft/60 ring-pink hover:ring-2">
                {img ? <img src={img} alt="" className="size-8 object-contain" /> : <span className="text-xl">🎁</span>}
              </button>
              <div className="min-w-0 flex-1">
                <Input value={labels[r.id] ?? r.label} maxLength={60} className="!py-1.5 text-sm font-medium" aria-label={t('คำในเมนู')}
                  onChange={(e) => { const next = { ...labels }; if (e.target.value === r.label) delete next[r.id]; else next[r.id] = e.target.value; put({ ...sel, labels: next }); }} />
                <div className="truncate text-xs text-muted">{how}{icons[r.id] ? ' · ' + t('รูปที่เลือกเอง') : ''}</div>
              </div>
            </div>
            {picking === r.id && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1"><GiftPicker value={gifts.find((g) => g.image === icons[r.id])?.name ?? ''} onChange={(name) => {
                  const g = gifts.find((x) => x.name === name); const next = { ...icons };
                  if (g?.image) next[r.id] = g.image; else delete next[r.id];
                  put({ ...sel, icons: next }); setPicking(null);
                }} /></div>
                {icons[r.id] && <Button type="button" variant="ghost" className="px-2 text-xs" onClick={() => { const next = { ...icons }; delete next[r.id]; put({ ...sel, icons: next }); setPicking(null); }}>{t('ใช้รูปเดิม')}</Button>}
              </div>
            )}
          </div>
        );
      })}
      {/* ของขวัญที่เพิ่มเอง: เลือกกิฟต์ + พิมพ์ว่าส่งแล้วได้อะไร */}
      {custom.map((c, i) => (
        <div key={c.id} className="flex items-center gap-2 rounded-xl border border-pink/40 bg-pink-soft/20 p-2">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white">{c.image ? <img src={c.image} alt="" className="size-8 object-contain" /> : '🎁'}</span>
          <div className="min-w-0 flex-1">
            <Input value={c.label} maxLength={60} placeholder={t('ส่งแล้วได้อะไร เช่น ร้องเพลง 1 เพลง')}
              onChange={(e) => { const next = custom.slice(); next[i] = { ...c, label: e.target.value }; setCustom(next); }} />
            <div className="mt-0.5 truncate text-xs text-muted">{t('ส่ง {gift}', { gift: (lang === 'en' ? c.gift : c.th) || c.gift })}{c.diamonds ? ` · 💎${c.diamonds}` : ''}</div>
          </div>
          <button type="button" aria-label={t('ลบ')} onClick={() => setCustom(custom.filter((x) => x.id !== c.id))} className="px-1 text-muted hover:text-red-600">✕</button>
        </div>
      ))}
      <div className="rounded-xl border border-dashed border-line p-2">
        <div className="mb-1.5 text-xs font-medium text-muted">{t('+ เพิ่มของขวัญเอง (ไม่ต้องตั้งกฎ)')}</div>
        <GiftPicker value="" onChange={(name) => { if (name) addCustom(name); }} />
      </div>
    </div>
  );
}

function FieldInput({ f, value, onChange }: { f: FieldDef; value: Values[string]; onChange: (v: Values[string]) => void }) {
  const t = useT();
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
              <button key={v} type="button" title={t(name)} aria-label={t(name)} aria-pressed={on} onClick={() => onChange(v)}
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
              {g && <div className="mb-1.5 text-xs font-semibold text-violet">{t(g)}</div>}
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {opts.map(([v, l, , thumb]) => {
                  const on = String(value) === v;
                  return (
                    <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={on} title={t(l)}
                      className={`flex flex-col items-center gap-1 rounded-xl border-2 p-1.5 text-center transition ${on ? 'border-pink bg-pink-soft' : 'border-line bg-white hover:border-pink/40'}`}>
                      <span className="grid aspect-square w-full place-items-center overflow-hidden rounded-lg bg-canvas">
                        {thumb
                          ? <img src={thumb.startsWith('/') ? `${API_BASE}${thumb}` : `${API_BASE}/overlay/themes/thumbs/${thumb}.webp`} alt="" loading="lazy" className="max-h-full max-w-full object-contain p-1" />
                          : <span className="text-2xl">✏️</span>}
                      </span>
                      <span className={`line-clamp-2 text-[11px] leading-tight ${on ? 'font-medium text-pink' : 'text-muted'}`}>{t(l)}</span>
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
            ? <optgroup key={g} label={t(g)}>{opts.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}</optgroup>
            : opts.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>))}
        </Select>
      );
    case 'color':
      return <input type="color" value={String(value)} onChange={(e) => onChange(e.target.value)} className="h-9 w-16 cursor-pointer rounded-lg border border-line bg-white" />;
    case 'text':
      return <Input value={String(value)} placeholder={f.placeholder ? t(f.placeholder) : f.placeholder} onChange={(e) => onChange(e.target.value)} />;
  }
}

function WidgetSettings() {
  const type = useSearchParams().get('type') ?? '';
  const [customMascots, setCustomMascots] = useState<{ code: string; name: string }[]>([]);
  useEffect(() => { if (type === 'mascot') api<{ mascots: { code: string; name: string }[] }>('/api/mascots/custom').then((r) => setCustomMascots(r.mascots)).catch(() => {}); }, [type]);
  // มาสคอตสั่งทำ (หน้าลูกค้าเอง) → เพิ่มเป็นตัวเลือกแรกในกลุ่ม "มาสคอตของฉัน"
  const def = useMemo(() => {
    const base = WIDGET_SETTINGS[type];
    if (!base || type !== 'mascot' || !customMascots.length) return base;
    return { ...base, sections: base.sections.map((s) => ({ ...s, fields: s.fields.map((f) => f.key === 'char' && f.type === 'select'
      ? { ...f, options: [...customMascots.map((m) => [m.code, m.name, '⭐ มาสคอตของฉัน', `/overlay/mascot/${m.code}/thumb.webp`] as [string, string, string, string]), ...f.options] } : f) })) };
  }, [type, customMascots]);
  const t = useT();
  const [values, setValues] = useState<Values | null>(null);
  const [saved, setSaved] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [previewSrc, setPreviewSrc] = useState('');
  const [zoom, setZoom] = useState(0); // ซูมพรีวิว: 0 = อัตโนมัติ (หาตำแหน่งวิดเจ็ตแล้วขยายให้เต็ม) · จำไว้ในเครื่อง
  useEffect(() => { try { const z = Number(localStorage.getItem('vjl-prev-zoom2')); if (z) setZoom(z); } catch { /* ignore */ } }, []);
  const [fit, setFit] = useState<{ z: number; cx: number; cy: number } | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  // อัตโนมัติ: วัดกรอบรวมของสิ่งที่มองเห็นในหน้าวิดเจ็ต (ไม่นับพื้นหลัง/แคนวาสเต็มจอ) ซ้ำช่วงแรกเพราะวิดเจ็ตค่อย ๆ โผล่
  const measure = useCallback(() => {
    const d = frameRef.current?.contentDocument; if (!d?.body) return;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const el of Array.from(d.body.querySelectorAll<HTMLElement>('*'))) {
      if (/^(SCRIPT|STYLE|IFRAME)$/.test(el.tagName)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || (r.width > 1700 && r.height > 950) || r.right < 0 || r.bottom < 0 || r.left > 1920 || r.top > 1080) continue; // นอกจอ/เต็มจอ ไม่นับ
      const cs = d.defaultView!.getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05) continue;
      if (!el.children.length || el.tagName === 'IMG' || el.tagName === 'CANVAS' || cs.backgroundImage !== 'none' || cs.backgroundColor !== 'rgba(0, 0, 0, 0)') {
        x0 = Math.min(x0, Math.max(0, r.left)); y0 = Math.min(y0, Math.max(0, r.top)); x1 = Math.max(x1, Math.min(1920, r.right)); y1 = Math.max(y1, Math.min(1080, r.bottom));
      }
    }
    if (x1 <= x0) { setFit({ z: 2, cx: 960, cy: 540 }); return; } // หาไม่เจอ (วาดบนแคนวาสเต็มจอ เช่น โหล) → ซูมกลางจอ
    const w = x1 - x0, h = y1 - y0;
    setFit({ z: Math.max(1, Math.min(3, 0.85 * Math.min(1920 / w, 1080 / h))), cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 });
  }, []);
  useEffect(() => { setFit(null); }, [previewSrc]);
  const [boxW, setBoxW] = useState(0);
  const roRef = useRef<ResizeObserver | null>(null);
  const boxRef = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    if (!el) return;
    setBoxW(el.clientWidth);
    roRef.current = new ResizeObserver(() => setBoxW(el.clientWidth)); roRef.current.observe(el);
  }, []);

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
    const tm = setTimeout(() => {
      const q = new URLSearchParams({ demo: '1', reset: '1', ...toOverlayParams(values) });
      setPreviewSrc(`${API_BASE}/overlay/${type}.html?${q.toString()}`);
    }, 400);
    return () => clearTimeout(tm);
  }, [values, type]);

  const dirty = useMemo(() => values !== null && JSON.stringify(values) !== saved, [values, saved]);

  async function save(extra: Record<string, unknown> = {}) {
    if (!values) return;
    setBusy(true); setMsg(null);
    try {
      await api(`/api/widgets/${type}/config`, { method: 'PUT', body: { ...toOverlayParams(values), ...extra } });
      // แก้แบบไหน = ใช้แบบนั้นกับลิงก์เดียว (เดิมแก้โหลแล้วจอยังโชว์แบบเก่า งง)
      if (COLLECT_TYPES.includes(type) && !extra.resetAt) {
        await api('/api/widgets/collect/config', { method: 'PUT', body: { style: type } });
        window.dispatchEvent(new Event('vjl-collect-active'));
      }
      setSaved(JSON.stringify(values));
      setMsg({ tone: 'success', text: extra.resetAt ? t('ล้างข้อมูลแล้ว — วิดเจ็ตบนจอเริ่มใหม่') : t('บันทึกแล้ว — วิดเจ็ตบนจอเปลี่ยนตามทันที (ไม่ต้องเปลี่ยนลิงก์)') });
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof ApiError ? err.message : t('บันทึกไม่สำเร็จ') });
    } finally { setBusy(false); }
  }

  if (!def) {
    return (
      <div>
        <PageHeader title={t('ตั้งค่าวิดเจ็ต')} />
        <Alert tone="info">{t('วิดเจ็ตนี้ไม่มีตั้งค่าเพิ่มเติม')}{type === 'fx' ? t(' — ตั้งกฎได้ที่หน้า Actions & Events') : ''}</Alert>
        <Link href="/dashboard/widgets/" className="mt-4 inline-flex items-center gap-1 text-sm text-pink hover:underline"><ArrowLeft className="size-4" /> {t('กลับหน้าวิดเจ็ต')}</Link>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('ตั้งค่า: {name}', { name: t(WIDGET_LABELS[type] ?? type) })}
        description={t('ตั้งค่าแล้วกดบันทึก — วิดเจ็ตที่เปิดอยู่ใน OBS / TikTok Live Studio จะเปลี่ยนตามทันที')}
        actions={<Link href="/dashboard/widgets/"><Button variant="secondary"><ArrowLeft className="size-4" /> {t('กลับ')}</Button></Link>} />

      {/* สะสมของขวัญ: แถบสลับประเภท (โหล ตู้ปลา ลูกแก้ว …) ไม่ต้องกลับไปหน้าโอเวอร์เลย์ */}
      {COLLECT_TYPES.includes(type) && (
        <div className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex w-max gap-1.5 rounded-2xl border border-line bg-white p-1.5 shadow-sm">
            {COLLECT_TYPES.map((k) => (
              <Link key={k} href={`/dashboard/widgets/settings/?type=${k}`}
                className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-sm transition ${k === type ? 'bg-pink font-medium text-white' : 'text-muted hover:bg-pink-soft hover:text-ink'}`}>
                {COLLECT_ICON[k]} {t(WIDGET_LABELS[k] ?? k)}
              </Link>
            ))}
          </div>
        </div>
      )}

      {type === 'mascot' && (
        <Card className="mb-6 flex flex-col gap-3 border-pink/30 bg-gradient-to-r from-pink-soft/70 to-violet-soft/60 sm:flex-row sm:items-center">
          <div className="text-4xl">🎨</div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{t('อยากได้มาสคอตเป็นหน้าตัวเอง?')}</div>
            <p className="text-sm text-muted">{t('ส่งรูปหน้าตรงชัด ๆ 1–3 รูป บอกสไตล์ที่ชอบ — ทีมงานวาดเป็นตัวละครของคุณ ครบทุกท่า (รับของขวัญ เต้น เดิน ส่งจุ๊บ) แจ้งราคาและระยะเวลาในแชท')}</p>
          </div>
          <Button onClick={() => window.dispatchEvent(new CustomEvent('vjl-open-support', { detail: { text: t('สนใจสั่งทำมาสคอตหน้าตัวเองค่ะ/ครับ 🎨 สไตล์ที่อยากได้: ') } }))}>
            {t('🛒 สั่งทำมาสคอตหน้าตัวเอง')}
          </Button>
        </Card>
      )}

      <WidgetLinkBox type={type} />

      {!values ? <Spinner /> : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div className="space-y-4">
            {def.sections.map((s) => {
              const fields = s.fields.filter((f) => !f.when || f.when(values));
              if (!fields.length) return null;
              return (
                <Card key={s.title}>
                  <h2 className="mb-3 text-sm font-semibold text-violet">{t(s.title)}</h2>
                  <div className="space-y-4">
                    {fields.map((f) => f.type === 'toggle' ? (
                      <div key={f.key} className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-ink">{t(f.label)}</span>
                        <FieldInput f={f} value={values[f.key]} onChange={(v) => setValues({ ...values, [f.key]: v })} />
                      </div>
                    ) : (
                      <Field key={f.key} label={t(f.label)} hint={f.hint ? t(f.hint) : f.hint}>
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
              <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted">
                <span>{t('พรีวิว (ข้อมูลจำลอง)')}</span>
                {/* ซูม: วิดเจ็ตส่วนใหญ่อยู่กลางจอ → ขยายให้เต็มกรอบ */}
                <span className="flex items-center gap-1">
                  {[0, 1, 1.5, 2, 2.5].map((z) => (
                    <button key={z} onClick={() => { setZoom(z); try { localStorage.setItem('vjl-prev-zoom2', String(z)); } catch { /* ignore */ } }}
                      className={`rounded-md px-1.5 py-0.5 ${zoom === z ? 'bg-pink text-white' : 'hover:bg-canvas'}`}>{z === 0 ? t('อัตโนมัติ') : z === 1 ? t('เต็มจอ') : `${z}×`}</button>
                  ))}
                </span>
              </div>
              <div ref={boxRef} className="relative aspect-video overflow-hidden rounded-xl"
                style={{ background: 'repeating-conic-gradient(#ece6f5 0% 25%, #f8f5fc 0% 50%) 50% / 24px 24px' }}>
                {previewSrc && boxW > 0 && (() => {
                  const f = zoom === 0 ? (fit ?? { z: 1, cx: 960, cy: 540 }) : { z: zoom, cx: 960, cy: 540 };
                  const S = (boxW / 1920) * f.z, boxH = (boxW * 9) / 16;
                  // เลื่อนให้ตรงกลางวิดเจ็ตอยู่กลางกรอบ แต่ไม่เลยขอบจอจำลอง
                  const tx = Math.min(0, Math.max(boxW - 1920 * S, boxW / 2 - f.cx * S)), ty = Math.min(0, Math.max(boxH - 1080 * S, boxH / 2 - f.cy * S));
                  return <iframe key={previewSrc} ref={frameRef} src={previewSrc} title={t('พรีวิววิดเจ็ต')}
                    onLoad={() => { for (const ms of [600, 1500, 3000]) setTimeout(measure, ms); }}
                    className="absolute left-0 top-0 h-[1080px] w-[1920px] origin-top-left border-0"
                    style={{ transform: `translate(${tx}px, ${ty}px) scale(${S})`, transition: 'transform .4s ease' }} />;
                })()}
              </div>
            </Card>
            {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => save()} loading={busy} className={dirty ? '' : 'opacity-80'}><Save className="size-4" /> {t('บันทึก')}</Button>
              <Button variant="secondary" onClick={() => setValues(defaultsOf(def))}><RotateCcw className="size-4" /> {t('คืนค่าเริ่มต้น')}</Button>
              {def.resettable && (
                <Button variant="danger" onClick={() => { if (confirm(t('{action}? (ทำย้อนกลับไม่ได้)', { action: t(def.resettable!) }))) void save({ resetAt: Date.now() }); }} loading={busy}>
                  {t(def.resettable)}
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
