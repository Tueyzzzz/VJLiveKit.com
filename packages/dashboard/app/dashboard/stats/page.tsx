'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Lightbulb, Minus } from 'lucide-react';
import { Alert, Card, PageHeader, Spinner, cx } from '@/components/ui';
import { api } from '@/lib/api';
import { useLang, useT } from '@/lib/i18n';

interface LiveSum {
  roomId: string; startedAt: string; endedAt: string; ended: boolean; durationMin: number;
  peakViewers: number; diamonds: number; gifts: number; likes: number;
  avgViewers: number | null; hasTimeline: boolean;
  joins: number | null; follows: number | null; shares: number | null; chats: number | null;
}
interface Sample { t: number; viewers: number; likes: number; diamonds: number; joins: number; follows: number; shares: number; chats: number; giftsCount: number }
type T = ReturnType<typeof useT>;

const DAY = 86_400_000;
const TZ = 'Asia/Bangkok';
const ms = (iso: string) => new Date(iso).getTime();
/** ชั่วโมงเริ่มไลฟ์ (เวลาไทย) */
const bkkHour = (iso: string) => new Date(ms(iso) + 7 * 3_600_000).getUTCHours();
const n0 = (v: number) => Math.round(v).toLocaleString();

function fmtDur(min: number, t: T): string {
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? t('{h} ชม. {m} นาที', { h, m }) : t('{m} นาที', { m });
}

/** สรุป 7 วันล่าสุด เทียบ 7 วันก่อนหน้า */
function windowStats(lives: LiveSum[], from: number, to: number) {
  const ls = lives.filter((l) => ms(l.startedAt) >= from && ms(l.startedAt) < to);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const fl = ls.filter((l) => l.follows !== null);
  return {
    count: ls.length,
    peak: avg(ls.map((l) => l.peakViewers)),
    dur: avg(ls.map((l) => l.durationMin)),
    diamonds: ls.length ? ls.reduce((a, l) => a + l.diamonds, 0) : null,
    follows: fl.length ? fl.reduce((a, l) => a + (l.follows ?? 0), 0) : null,
  };
}

/** ข้อแนะนำอัตโนมัติจากข้อมูลจริง */
function insights(lives: LiveSum[], t: T): string[] {
  const out: string[] = [];
  if (lives.length < 3) return out;

  // 1) ช่วงเวลาเริ่มไลฟ์ที่ดีที่สุด (ช่วงละ 3 ชม.) — ใช้คนดูเฉลี่ยถ้ามีพอ ไม่งั้นใช้คนดูสูงสุด
  const withAvg = lives.filter((l) => l.avgViewers !== null);
  const useAvg = withAvg.length >= 4;
  const pool = useAvg ? withAvg : lives;
  const buckets = new Map<number, number[]>();
  for (const l of pool) { const b = Math.floor(bkkHour(l.startedAt) / 3); buckets.set(b, [...(buckets.get(b) ?? []), useAvg ? l.avgViewers! : l.peakViewers]); }
  if (buckets.size >= 2) {
    const ranked = [...buckets.entries()].map(([b, xs]) => ({ b, v: xs.reduce((a, x) => a + x, 0) / xs.length, n: xs.length })).sort((a, b) => b.v - a.v);
    const best = ranked[0], worst = ranked[ranked.length - 1];
    if (best.v > worst.v * 1.15) {
      const range = `${String(best.b * 3).padStart(2, '0')}:00–${String((best.b * 3 + 3) % 24).padStart(2, '0')}:00`;
      out.push(useAvg
        ? t('เริ่มไลฟ์ช่วง {range} น. คนดูเฉลี่ยมากที่สุด (~{n} คน) ลองไลฟ์ช่วงนี้บ่อยขึ้นนะ', { range, n: n0(best.v) })
        : t('เริ่มไลฟ์ช่วง {range} น. คนดูสูงสุดมากที่สุด (~{n} คน) ลองไลฟ์ช่วงนี้บ่อยขึ้นนะ', { range, n: n0(best.v) }));
    }
  }

  // 2) ไลฟ์ยาว vs สั้น
  const long = lives.filter((l) => l.durationMin >= 60), short = lives.filter((l) => l.durationMin > 0 && l.durationMin < 60);
  if (long.length >= 2 && short.length >= 2) {
    const a = long.reduce((s, l) => s + l.peakViewers, 0) / long.length, b = short.reduce((s, l) => s + l.peakViewers, 0) / short.length;
    if (a > b * 1.2) out.push(t('ไลฟ์ 1 ชม.ขึ้นไป คนดูสูงสุดเฉลี่ย {a} คน มากกว่าไลฟ์สั้น ({b} คน) — ไลฟ์นานขึ้นอีกนิด คนจะทยอยเข้ามาเพิ่ม', { a: n0(a), b: n0(b) }));
    else if (b > a * 1.2) out.push(t('ไลฟ์สั้นได้คนดูสูงสุดดีกว่าไลฟ์ยาว ({b} vs {a} คน) — ไลฟ์ยาวอาจช่วงท้ายคนเริ่มหลุด ลองมีกิจกรรมกลางไลฟ์', { a: n0(a), b: n0(b) }));
  }

  // 3) คนแวะเข้ามาเยอะ แต่อยู่ดูน้อย (retention)
  const leaky = lives.filter((l) => l.joins !== null && l.avgViewers !== null && l.joins >= 20 && l.avgViewers / l.joins < 0.1);
  if (leaky.length) {
    const j = Math.round(leaky.reduce((s, l) => s + (l.joins ?? 0), 0) / leaky.length), a = Math.round(leaky.reduce((s, l) => s + (l.avgViewers ?? 0), 0) / leaky.length);
    out.push(t('{k} ไลฟ์ มีคนแวะเข้ามาเฉลี่ย {j} คน แต่อยู่ดูพร้อมกันแค่ ~{a} คน — ลองทักชื่อคนที่เพิ่งเข้า ตั้งเป้าหมาย/มินิเกม ให้เขาอยู่ต่อ', { k: leaky.length, j, a }));
  }

  // 4) ความสม่ำเสมอของตารางไลฟ์ (14 วันล่าสุด)
  const recent = lives.filter((l) => ms(l.startedAt) >= Date.now() - 14 * DAY);
  const days = new Set(recent.map((l) => new Date(ms(l.startedAt) + 7 * 3_600_000).toISOString().slice(0, 10))).size;
  if (recent.length >= 3) {
    // ค่าเฉลี่ยแบบวงกลม (23 น. กับ 01 น. ใกล้กัน)
    const ang = recent.map((l) => (bkkHour(l.startedAt) / 24) * 2 * Math.PI);
    const mean = Math.atan2(ang.reduce((s, a) => s + Math.sin(a), 0), ang.reduce((s, a) => s + Math.cos(a), 0));
    const dev = ang.reduce((s, a) => { const d = Math.abs(Math.atan2(Math.sin(a - mean), Math.cos(a - mean))); return s + (d / (2 * Math.PI)) * 24; }, 0) / ang.length;
    const meanH = Math.round((((mean / (2 * Math.PI)) * 24) + 24) % 24) % 24;
    if (dev > 2.5) out.push(t('เวลาเริ่มไลฟ์ยังไม่แน่นอน (คลาดกันเฉลี่ย ~{h} ชม.) — ไลฟ์เวลาเดิมทุกวัน ผู้ชมจะจำได้และรอดู', { h: dev.toFixed(1) }));
    else out.push(t('เยี่ยม! ไลฟ์ช่วงเวลาเดิมสม่ำเสมอ (ราว {hh}:00 น.) ทำต่อไปนะ', { hh: String(meanH).padStart(2, '0') }));
  }
  if (days > 0 && days < 5) out.push(t('14 วันล่าสุดไลฟ์ {d} วัน — ไลฟ์ถี่ขึ้น (เช่น 4–5 วัน/สัปดาห์) ช่วยให้ TikTok ดันคนดูให้มากขึ้น', { d: days }));
  return out;
}

// ---------- กราฟคนดูตามเวลา (SVG ล้วน) — คนดู = เส้น · คนเข้าใหม่ = แท่ง แยกกราฟ 2 ชั้น แกนเวลาเดียวกัน ----------
function useWidth<E extends HTMLElement>() {
  const ref = useRef<E>(null);
  const [w, setW] = useState(320);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth || 320)); ro.observe(el); setW(el.clientWidth || 320);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceMax(v: number): number {
  if (v <= 5) return 5;
  const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

function Timeline({ samples, t, locale }: { samples: Sample[]; t: T; locale: string }) {
  const [box, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const L = 36, R = 8, H1 = 160, H2 = 56, top = 8, gap = 22;
  const n = samples.length;
  const pw = Math.max(10, W - L - R);
  const x = (i: number) => L + (n <= 1 ? pw / 2 : (i / (n - 1)) * pw);
  const vMax = niceMax(Math.max(...samples.map((s) => s.viewers), 1));
  const jMax = niceMax(Math.max(...samples.map((s) => s.joins), 1));
  const y1 = (v: number) => top + H1 - (v / vMax) * H1;
  const base2 = top + H1 + gap + H2;
  const y2 = (v: number) => base2 - (v / jMax) * H2;
  const hhmm = (ts: number) => new Date(ts).toLocaleTimeString(locale, { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  const line = samples.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y1(s.viewers).toFixed(1)}`).join('');
  const bw = Math.max(1, Math.min(10, pw / Math.max(n, 1) - 2));
  const ticks = n > 1 ? [0, Math.floor((n - 1) / 2), n - 1] : [0];
  const peakI = samples.reduce((bi, s, i) => (s.viewers > samples[bi].viewers ? i : bi), 0);
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    setHover(n <= 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round(((px - L) / pw) * (n - 1)))));
  };
  const hs = hover !== null ? samples[hover] : null;
  return (
    <div ref={box} className="relative w-full select-none">
      <div className="mb-1 text-xs font-semibold text-ink">{t('คนดูพร้อมกัน (คน)')}</div>
      <svg width={W} height={base2 + 22} className="block touch-pan-y" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label={t('กราฟคนดูตามเวลา')}>
        {/* กริดจาง ๆ */}
        {[0, 0.5, 1].map((f) => (
          <g key={'g' + f}>
            <line x1={L} x2={L + pw} y1={y1(vMax * f)} y2={y1(vMax * f)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={L - 6} y={y1(vMax * f) + 4} textAnchor="end" fontSize={11} fill="var(--color-muted)">{n0(vMax * f)}</text>
          </g>
        ))}
        <path d={line} fill="none" stroke="var(--color-violet)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {n > 0 && <>
          <circle cx={x(peakI)} cy={y1(samples[peakI].viewers)} r={4} fill="var(--color-violet)" stroke="white" strokeWidth={2} />
          <text x={Math.min(Math.max(x(peakI), L + 30), L + pw - 30)} y={Math.max(y1(samples[peakI].viewers) - 8, 11)} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--color-ink)">{t('สูงสุด {n}', { n: n0(samples[peakI].viewers) })}</text>
        </>}
        {/* คนเข้าใหม่ต่อนาที */}
        <text x={L} y={top + H1 + gap - 6} fontSize={12} fontWeight={600} fill="var(--color-ink)">{t('คนเข้ามาใหม่ต่อนาที')}</text>
        <line x1={L} x2={L + pw} y1={base2} y2={base2} stroke="var(--color-line)" strokeWidth={1} />
        <text x={L - 6} y={y2(jMax) + 4} textAnchor="end" fontSize={11} fill="var(--color-muted)">{n0(jMax)}</text>
        {samples.map((s, i) => s.joins > 0 && (
          <rect key={'b' + i} x={x(i) - bw / 2} y={y2(s.joins)} width={bw} height={Math.max(1, base2 - y2(s.joins))} rx={Math.min(2, bw / 2)} fill="var(--color-pink)" opacity={hover === null || hover === i ? 1 : 0.55} />
        ))}
        {ticks.map((i) => (
          <text key={'x' + i} x={x(i)} y={base2 + 16} fontSize={11} fill="var(--color-muted)" textAnchor={i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle'}>{hhmm(samples[i].t)}</text>
        ))}
        {hs && hover !== null && <>
          <line x1={x(hover)} x2={x(hover)} y1={top} y2={base2} stroke="var(--color-muted)" strokeWidth={1} strokeDasharray="3 3" />
          <circle cx={x(hover)} cy={y1(hs.viewers)} r={4} fill="var(--color-violet)" stroke="white" strokeWidth={2} />
        </>}
      </svg>
      {hs && hover !== null && (
        <div className="pointer-events-none absolute top-6 z-10 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: Math.min(Math.max(x(hover) - 70, 0), W - 140), width: 140 }}>
          <div className="font-semibold text-ink">{hhmm(hs.t)}</div>
          <div className="text-muted">{t('คนดู')} <b className="text-ink">{n0(hs.viewers)}</b></div>
          <div className="text-muted">{t('เข้ามาใหม่')} <b className="text-ink">{n0(hs.joins)}</b></div>
          {(hs.follows > 0 || hs.giftsCount > 0) && <div className="text-muted">{t('ติดตาม')} <b className="text-ink">{hs.follows}</b> · {t('กิฟต์')} <b className="text-ink">{hs.giftsCount}</b></div>}
        </div>
      )}
    </div>
  );
}

function LiveDetail({ roomId, q, t, locale }: { roomId: string; q: string; t: T; locale: string }) {
  const [samples, setSamples] = useState<Sample[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api<{ samples: Sample[] }>(`/api/stats/lives/${encodeURIComponent(roomId)}${q}`).then((d) => setSamples(d.samples)).catch((e) => setErr((e as Error).message));
  }, [roomId, q]);
  if (err) return <Alert>{err}</Alert>;
  if (!samples) return <Spinner />;
  if (samples.length < 2) return <p className="py-4 text-center text-sm text-muted">{t('ไลฟ์นี้ยังไม่มีข้อมูลรายนาที (เก็บตั้งแต่เปิดฟีเจอร์นี้)')}</p>;
  return <Timeline samples={samples} t={t} locale={locale} />;
}

function Tile({ label, cur, prev, fmt, t }: { label: string; cur: number | null; prev: number | null; fmt: (v: number) => string; t: T }) {
  const pct = cur !== null && prev !== null && prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
  return (
    <Card className="!p-3 sm:!p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 font-display text-2xl leading-tight text-ink">{cur === null ? '—' : fmt(cur)}</div>
      <div className="mt-1 flex items-center gap-1 text-[11px] text-muted">
        {pct === null ? <span>{prev === null ? t('สัปดาห์ก่อนไม่มีข้อมูล') : t('สัปดาห์ก่อน {v}', { v: fmt(prev) })}</span> : <>
          <span className={cx('inline-flex items-center gap-0.5 font-semibold', pct > 0 ? 'text-[#2e8b75]' : pct < 0 ? 'text-red-500' : 'text-muted')}>
            {pct > 0 ? <ArrowUp className="size-3" /> : pct < 0 ? <ArrowDown className="size-3" /> : <Minus className="size-3" />}{Math.abs(pct)}%
          </span>
          <span>{t('จาก {v}', { v: fmt(prev!) })}</span>
        </>}
      </div>
    </Card>
  );
}

export default function StatsPage() {
  const t = useT();
  const [lang] = useLang();
  const locale = lang === 'en' ? 'en-GB' : 'th-TH';
  const [data, setData] = useState<{ username: string | null; lives: LiveSum[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    // แอดมินดูของคนอื่น: /dashboard/stats/?username=xxx
    const u = new URLSearchParams(window.location.search).get('username');
    const qs = u ? `?username=${encodeURIComponent(u)}` : '';
    setQ(qs);
    api<{ username: string | null; lives: LiveSum[] }>(`/api/stats/lives${qs}`).then(setData).catch((e) => setErr((e as Error).message));
  }, []);

  const lives = useMemo(() => data?.lives ?? [], [data]);
  const now = Date.now();
  const cur = useMemo(() => windowStats(lives, now - 7 * DAY, now + DAY), [lives]); // eslint-disable-line react-hooks/exhaustive-deps
  const prev = useMemo(() => windowStats(lives, now - 14 * DAY, now - 7 * DAY), [lives]); // eslint-disable-line react-hooks/exhaustive-deps
  const tips = useMemo(() => insights(lives, t), [lives, t]);

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(locale, { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  const dash = (v: number | null) => (v === null ? '—' : n0(v));

  if (err) return <Alert>{err}</Alert>;
  if (!data) return <Spinner />;
  return (
    <div>
      <PageHeader title={t('สถิติไลฟ์')} description={t('ดูว่าไลฟ์ไหนคนดูเยอะ ช่วงไหนคนเข้า-ออก และควรปรับอะไร')} />
      {!data.username ? <Alert tone="info">{t('ตั้งชื่อ TikTok ในหน้าภาพรวมก่อน ระบบจึงเก็บสถิติไลฟ์ให้ได้')}</Alert>
        : !lives.length ? <Alert tone="info">{t('ยังไม่มีไลฟ์ที่บันทึกไว้ — เริ่มไลฟ์พร้อมเปิดวิดเจ็ต แล้วสถิติจะขึ้นที่นี่')}</Alert> : <>

      <h2 className="mb-2 text-sm font-semibold text-violet">{t('7 วันล่าสุด เทียบกับ 7 วันก่อน')} <span className="font-normal text-muted">· {t('{n} ไลฟ์', { n: cur.count })}</span></h2>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile t={t} label={t('คนดูสูงสุดเฉลี่ย')} cur={cur.peak} prev={prev.peak} fmt={n0} />
        <Tile t={t} label={t('ไลฟ์นานเฉลี่ย')} cur={cur.dur} prev={prev.dur} fmt={(v) => fmtDur(Math.round(v), t)} />
        <Tile t={t} label={t('เพชรรวม')} cur={cur.diamonds} prev={prev.diamonds} fmt={n0} />
        <Tile t={t} label={t('ผู้ติดตามใหม่')} cur={cur.follows} prev={prev.follows} fmt={n0} />
      </div>

      <Card className="mb-6">
        <h2 className="mb-2 flex items-center gap-2 font-medium"><Lightbulb className="size-4 text-gold" /> {t('ข้อแนะนำ')}</h2>
        {tips.length ? (
          <ul className="space-y-2 text-sm">
            {tips.map((s, i) => <li key={i} className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-pink" /><span>{s}</span></li>)}
          </ul>
        ) : <p className="text-sm text-muted">{t('ไลฟ์อีกสัก 3–4 ครั้ง ระบบจะเริ่มมีข้อแนะนำให้')}</p>}
      </Card>

      <h2 className="mb-2 text-sm font-semibold text-violet">{t('ไลฟ์ล่าสุด')} <span className="font-normal text-muted">· {t('แตะเพื่อดูกราฟคนดู')}</span></h2>
      <div className="space-y-2">
        {/* หัวตาราง (จอใหญ่) */}
        <div className="hidden grid-cols-[1.6fr_repeat(7,1fr)_20px] gap-2 px-4 text-xs text-muted md:grid">
          <span>{t('วันที่ / เวลา')}</span><span className="text-right">{t('นาน')}</span><span className="text-right">{t('คนดูสูงสุด')}</span><span className="text-right">{t('คนดูเฉลี่ย')}</span>
          <span className="text-right">{t('คนเข้ามา')}</span><span className="text-right">{t('ติดตาม')}</span><span className="text-right">{t('ไลค์')}</span><span className="text-right">{t('เพชร')}</span><span />
        </div>
        {lives.map((l) => {
          const isOpen = open === l.roomId;
          const stats: [string, string][] = [
            [t('นาน'), fmtDur(l.durationMin, t)], [t('คนดูสูงสุด'), n0(l.peakViewers)], [t('คนดูเฉลี่ย'), dash(l.avgViewers)],
            [t('คนเข้ามา'), dash(l.joins)], [t('ติดตาม'), dash(l.follows)], [t('ไลค์'), n0(l.likes)], [t('เพชร'), n0(l.diamonds)],
          ];
          return (
            <div key={l.roomId} className={cx('rounded-2xl border bg-white shadow-sm transition', isOpen ? 'border-pink/50' : 'border-line')}>
              <button type="button" onClick={() => setOpen(isOpen ? null : l.roomId)} aria-expanded={isOpen}
                className="w-full px-4 py-3 text-left md:grid md:grid-cols-[1.6fr_repeat(7,1fr)_20px] md:items-center md:gap-2">
                <div className="flex items-center justify-between gap-2 md:block">
                  <div>
                    <div className="text-sm font-semibold text-ink">{fmtDate(l.startedAt)}</div>
                    <div className="text-xs text-muted">{fmtTime(l.startedAt)}–{l.ended ? fmtTime(l.endedAt) : t('ยังไลฟ์อยู่/ไม่ทราบ')}{!l.hasTimeline && <span className="ml-1 text-[10px]">· {t('สรุปเท่านั้น')}</span>}</div>
                  </div>
                  <ChevronDown className={cx('size-4 shrink-0 text-muted transition md:hidden', isOpen && 'rotate-180')} />
                </div>
                {/* มือถือ: การ์ดตัวเลข 4 ช่อง/แถว · จอใหญ่: คอลัมน์ตาราง */}
                <div className="mt-2 grid grid-cols-4 gap-x-2 gap-y-1.5 md:contents">
                  {stats.map(([k, v], i) => (
                    <div key={k} className={cx('min-w-0 md:text-right', i === 0 && 'col-span-2 md:col-span-1')}>
                      <div className="truncate text-[10px] text-muted md:hidden">{k}</div>
                      <div className="truncate text-sm font-medium tabular-nums text-ink">{v}</div>
                    </div>
                  ))}
                </div>
                <ChevronDown className={cx('hidden size-4 text-muted transition md:block', isOpen && 'rotate-180')} />
              </button>
              {isOpen && <div className="border-t border-line px-3 pb-3 pt-3 sm:px-4"><LiveDetail roomId={l.roomId} q={q} t={t} locale={locale} /></div>}
            </div>
          );
        })}
      </div>
      </>}
      <p className="mt-6 text-xs text-muted">{t('หมายเหตุ: กราฟรายนาที คนเข้ามา และผู้ติดตาม เริ่มเก็บตั้งแต่เปิดฟีเจอร์นี้ ไลฟ์ก่อนหน้านั้นจะมีเฉพาะสรุป (คนดูสูงสุด ไลค์ เพชร) · เวลาเป็นเวลาไทย')}</p>
    </div>
  );
}
