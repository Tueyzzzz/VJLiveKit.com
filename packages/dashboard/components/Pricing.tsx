'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronDown, Lock } from 'lucide-react';
import { api, formatMoney, type Plan } from '@/lib/api';
import { Badge, Card, cx } from './ui';
import { useT } from '@/lib/i18n';

export const WIDGET_LABELS: Record<string, string> = {
  donate: 'โดเนทขึ้นจอ (พร้อมเพย์)',
  fxmenu: 'เมนูของขวัญ (บอกผู้ชมว่าส่งอะไร)',
  collect: 'สะสมของขวัญ (ลิงก์เดียว ทุกแบบ)',
  sign: 'ป้ายไฟ LED ข้อความวิ่ง',
  tugwar: 'เกมชักเย่อ 2 ทีม',
  mascot: 'ตัวแทนวีเจ (มาสคอต)',
  pile: 'กองทับกัน',
  coinjar: 'Coin Jar',
  giftjar: 'โหลแก้วของขวัญ',
  aquarium: 'ตู้ปลาของขวัญ',
  belly: 'ตัวละครกินของขวัญ',
  snowglobe: 'ลูกแก้วหิมะ',
  spacedome: 'โดมอวกาศ',
  vehicle: 'รถลากของขวัญ',
  garden: 'กระถางดอกไม้',
  tree: 'ต้นไม้ของขวัญ',
  alerts: 'แจ้งเตือนกิฟต์/ติดตาม',
  goal: 'แถบเป้าหมาย',
  chat: 'แชทสด',
  follower: 'ผู้ติดตามล่าสุด',
  topgifters: 'Top Gifters',
  toplikers: 'อันดับยอดไลค์',
  pkmvp: 'MVP ของ PK',
  timer: 'นาฬิกาจับเวลา (Subathon)',
  league: 'ปลดล็อกเป้าหมายลีก (TikTok League)',
  tts: 'อ่านแชทออกเสียง (TTS)',
  fx: 'Actions & Events (FX)',
};
const ALL_WIDGETS = Object.keys(WIDGET_LABELS);

/** ตารางแพลน (สาธารณะ ไม่ต้องล็อกอิน) — แอดมินแก้ที่หน้า Admin › แพลน แล้วเห็นทุกหน้าทันที */
export function usePlans() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    api<{ plans: Plan[]; enabled: boolean }>('/api/plans')
      .then((r) => { setPlans(r.plans); setEnabled(r.enabled); })
      .catch(() => setPlans([]));
  }, []);
  return { plans, billingEnabled: enabled };
}

/** การ์ดราคาแพลน (มือถือ 1 คอลัมน์ → จอกว้าง 5 คอลัมน์) */
export function PlanCards({ plans, currentPlan, renderAction }: {
  plans: Plan[];
  currentPlan?: string;
  renderAction: (plan: Plan) => React.ReactNode;
}) {
  const t = useT();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      {plans.map((p) => {
        const paid = p.priceCents > 0;
        const current = currentPlan === p.code;
        const hot = !!p.badge;
        const f = p.features;
        const widgets = ALL_WIDGETS.filter((w) => f.widgets.includes(w));
        return (
          <Card key={p.code} className={cx('relative flex flex-col', current ? 'border-mint/50 ring-2 ring-mint/25' : hot && 'border-pink/40 ring-2 ring-pink/20')}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-xl">{t(p.name)}</h3>
              <div className="flex flex-wrap gap-1">
                {current && <Badge tone="mint">{t('แพลนปัจจุบัน')}</Badge>}
                {hot && <Badge tone="pink">{t(p.badge!)}</Badge>}
              </div>
            </div>
            {p.tagline && <p className="mt-1 text-sm text-muted">{t(p.tagline)}</p>}
            <p className="mt-3">
              <span className="font-display text-4xl">{paid ? formatMoney(p.priceCents, p.currency) : t('ฟรี')}</span>
              {paid && <span className="text-sm text-muted"> {t('/ เดือน')}</span>}
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {(p.bullets ?? []).map((b) => (
                <li key={b} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-mint" /> <span>{t(b)}</span></li>
              ))}
              <li className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-mint" /> {t('กฎ Actions สูงสุด {n} ข้อ', { n: f.maxActionRules })}</li>
              <li className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-mint" /> {t('ลิงก์ overlay {n} ชุด', { n: f.maxTokens })}</li>
              <li className={cx('flex items-start gap-2', !f.noWatermark && 'text-muted/70')}>
                {f.noWatermark ? <Check className="mt-0.5 size-4 shrink-0 text-mint" /> : <Lock className="mt-0.5 size-4 shrink-0" />} {t('ไม่มีป้าย VJLiveKit บนจอ')}
              </li>
            </ul>
            <details className="group mt-3 flex-1 text-sm">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-violet">
                {t('วิดเจ็ตที่ใช้ได้ ({n}/{all})', { n: widgets.length, all: ALL_WIDGETS.length })} <ChevronDown className="size-4 transition group-open:rotate-180" />
              </summary>
              <ul className="mt-2 space-y-1.5">
                {ALL_WIDGETS.map((w) => {
                  const ok = f.widgets.includes(w);
                  return (
                    <li key={w} className={cx('flex items-center gap-2', !ok && 'text-muted/60')}>
                      {ok ? <Check className="size-4 shrink-0 text-mint" /> : <Lock className="size-4 shrink-0" />} {t(WIDGET_LABELS[w] ?? w)}
                    </li>
                  );
                })}
              </ul>
            </details>
            <div className="mt-5">{renderAction(p)}</div>
          </Card>
        );
      })}
    </div>
  );
}

/** ขอสมัครผ่านแชทซัพพอร์ต (ใช้ตอนยังไม่เปิดระบบตัดบัตร / เปลี่ยนแพลนที่จ่ายอยู่) */
export function askForPlan(planName: string, text: string) {
  window.dispatchEvent(new CustomEvent('vjl-open-support', { detail: { text: text.replace('{plan}', planName) } }));
}
