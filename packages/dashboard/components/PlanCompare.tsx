'use client';

import { Check, Minus } from 'lucide-react';
import { formatMoney, type Plan } from '@/lib/api';
import { WIDGET_SETTINGS } from '@/lib/widgetSettings';
import { WIDGET_LABELS } from './Pricing';
import { cx } from './ui';
import { useT } from '@/lib/i18n';

/** จำนวนแบบให้เลือกของวิดเจ็ต (นับตัวเลือกหน้าตา: ทรง/รถ/กรอบ/ตัวละคร/ธีม) — โชว์ว่าแต่ละวิดเจ็ตมีให้เลือกเยอะแค่ไหน */
function styleCount(type: string): number {
  const def = WIDGET_SETTINGS[type];
  if (!def) return 0;
  let best = 0;
  for (const sec of def.sections) for (const f of sec.fields as { key: string; type: string; options?: unknown[] }[]) {
    if (f.type === 'select' && ['shape', 'car', 'frame', 'char', 'skin', 'style', 'theme', 'pot'].includes(f.key) && f.options) best = Math.max(best, f.options.length);
  }
  return best;
}

/** หมวดวิดเจ็ตในตารางเทียบ */
const GROUPS: [string, string[]][] = [
  ['🎁 สะสมของขวัญบนจอ', ['collect', 'pile', 'giftjar', 'aquarium', 'belly', 'snowglobe', 'spacedome', 'vehicle', 'garden', 'tree', 'coinjar']],
  ['🏆 อันดับ & PK', ['topgifters', 'toplikers', 'pkmvp', 'league']],
  ['🔔 แจ้งเตือน & แชท', ['alerts', 'follower', 'chat', 'goal', 'timer', 'sign', 'tts']],
  ['✨ Actions & ตัวแทนวีเจ', ['fx', 'fxmenu', 'mascot']],
  ['💸 รายได้', ['donate']],
];

/** ตารางเทียบแพลนแบบละเอียด — มือถือเลื่อนซ้ายขวาได้ คอลัมน์แรกค้างไว้ */
export function PlanCompare({ plans }: { plans: Plan[] }) {
  const t = useT();
  if (!plans.length) return null;
  const yes = <Check className="mx-auto size-5 text-mint" />, no = <Minus className="mx-auto size-4 text-muted/40" />;
  const cell = (v: React.ReactNode, i: number, hot?: boolean) => <td key={i} className={cx('min-w-[76px] px-1.5 py-2.5 text-center text-xs sm:px-3 sm:text-sm', hot && 'bg-pink-soft/40')}>{v}</td>;
  const hotIdx = plans.findIndex((p) => !!p.badge);
  const row = (label: React.ReactNode, vals: React.ReactNode[], sub?: string) => (
    <tr className="border-t border-line/70">
      <th scope="row" className="sticky left-0 z-10 w-[132px] max-w-[132px] bg-white px-2 py-2.5 text-left text-xs font-normal leading-snug shadow-[2px_0_4px_-2px_rgba(0,0,0,.08)] sm:w-auto sm:max-w-none sm:px-3 sm:text-sm">{label}{sub && <div className="text-[11px] text-muted">{sub}</div>}</th>
      {vals.map((v, i) => cell(v, i, i === hotIdx))}
    </tr>
  );
  const head = (title: string) => (
    <tr className="bg-canvas"><th colSpan={plans.length + 1} className="sticky left-0 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-violet">{t(title)}</th></tr>
  );
  const lim = (n: number, unit = '') => (n >= 999 ? t('ไม่จำกัด') : n ? `${n.toLocaleString()}${unit}` : no);

  return (
    <div className="mt-10">
      <h3 className="mb-1 text-center font-display text-2xl">{t('เทียบทุกแพลนแบบละเอียด')}</h3>
      <p className="mb-4 text-center text-sm text-muted">{t('ตัวเลขในวงเล็บ = จำนวนแบบให้เลือกของวิดเจ็ตนั้น · ทุกแพลนใช้ลิงก์เดียวใส่ OBS / TikTok LIVE Studio ได้ทั้งจอแนวตั้งและแนวนอน')}</p>
      <p className="mb-2 text-right text-xs text-pink sm:hidden">{t('เลื่อนไปทางขวาเพื่อดูแพลนอื่น →')}</p>
      <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-sm">
        <table className="w-full min-w-[540px] text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 w-[132px] bg-white px-2 py-3 text-left align-bottom text-xs text-muted sm:w-auto sm:px-3">{t('ฟีเจอร์')}</th>
              {plans.map((p, i) => (
                <th key={p.code} className={cx('min-w-[76px] px-1.5 py-3 text-center align-bottom sm:px-3', i === hotIdx && 'bg-pink-soft/40')}>
                  {p.badge && <div className="mb-1 inline-block rounded-full bg-pink px-2 py-0.5 text-[10px] font-semibold text-white">{t(p.badge)}</div>}
                  <div className="font-display text-base">{t(p.name)}</div>
                  <div className="text-xs text-muted">{p.priceCents > 0 ? `${formatMoney(p.priceCents, p.currency)}${t('/ เดือน')}` : t('ฟรี')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GROUPS.map(([g, ws]) => (
              <Frag key={g}>
                {head(g)}
                {ws.filter((w) => WIDGET_LABELS[w]).map((w) => {
                  const n = styleCount(w);
                  return <Frag key={w}>{row(<>{t(WIDGET_LABELS[w])}{n > 1 && <span className="ml-1 text-xs text-pink">({n})</span>}</>, plans.map((p) => (p.features.widgets.includes(w) ? yes : no)))}</Frag>;
                })}
              </Frag>
            ))}
            {head('⚙️ ลิมิต & สิทธิพิเศษ')}
            {row(t('เสียงแจ้งเตือน'), plans.map((p) => { const n = (p.features as { soundRules?: number }).soundRules; return n == null ? '-' : n >= 999 ? t('ไม่จำกัด') : `${n} ${t('เสียง')}`; }))}
            {row(t('แบบให้เลือกต่อวิดเจ็ต'), plans.map((p) => { const n = (p.features as { styleLimit?: number }).styleLimit ?? 999; return n >= 999 ? t('ทุกแบบ') : `${n} ${t('แบบ')}`; }), t('เช่น โหล 93 แบบ · ต้นไม้ · รถลาก · กรอบ MVP'))}
            {row(t('กฎ Actions & Events'), plans.map((p) => lim(p.features.maxActionRules, ' ' + t('ข้อ'))), t('เช่น ได้ Rose → ผีเสื้อ · PK ชนะ → ฉลอง'))}
            {row(t('ลิงก์ overlay'), plans.map((p) => lim(p.features.maxTokens, ' ' + t('ชุด'))))}
            {row(t('อัปโหลดเสียง/วิดีโอของตัวเอง'), plans.map((p) => (p.features.soundMaxFiles ? `${p.features.soundMaxFiles} ${t('ไฟล์')} · ${p.features.soundMaxMB}MB` : no)))}
            {row(t('ไพ่ทาโร่ & ดูดวง'), plans.map((p) => (p.features.tarot ? yes : no)))}
            {row(t('สถิติไลฟ์ย้อนหลัง'), plans.map((p) => (p.features.liveStats ? yes : no)))}
            {row(t('จอสะอาด ไม่มีโลโก้'), plans.map((p) => (p.features.noWatermark ? yes : no)))}
            {row(t('ซัพพอร์ตด่วน (ตอบก่อน)'), plans.map((p) => (p.features.prioritySupport ? yes : no)))}
            {row(t('ส่วนลดสั่งทำมาสคอตหน้าตัวเอง'), plans.map((p) => (p.features.mascotDiscountPct ? `${p.features.mascotDiscountPct}%` : no)))}
          </tbody>
        </table>
      </div>
      <ul className="mx-auto mt-4 max-w-3xl space-y-1 text-xs text-muted">
        <li>• {t('สมัครใหม่ใช้ฟรีทุกฟีเจอร์ 1 เดือน (นับต่อชื่อ TikTok 1 ชื่อ) — ไม่ต้องใส่บัตร')}</li>
        <li>• {t('ชวนเพื่อนครบ 10 คน (สมัคร + ตั้งชื่อ TikTok) รับ Pro ฟรี 30 วัน วนได้เรื่อย ๆ')}</li>
        <li>• {t('เปลี่ยน/ยกเลิกแพลนได้ทุกเมื่อ · ของขวัญที่สะสมไว้ไม่หายเมื่อเปลี่ยนแพลน')}</li>
      </ul>
    </div>
  );
}
const Frag = ({ children }: { children: React.ReactNode }) => <>{children}</>;
