'use client';

import { useEffect, useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { api, formatMoney, type Plan } from '@/lib/api';
import { Badge, Card, cx } from './ui';

export const WIDGET_LABELS: Record<string, string> = {
  donate: 'โดเนทขึ้นจอ (พร้อมเพย์)',
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
  timer: 'นาฬิกาจับเวลา (Subathon)',
  league: 'ปลดล็อกเป้าหมายลีก (TikTok League)',
  tts: 'อ่านแชทออกเสียง (TTS)',
  fx: 'Actions & Events (FX)',
};
const ALL_WIDGETS = Object.keys(WIDGET_LABELS);

export function usePlans() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    api<{ plans: Plan[]; enabled: boolean }>('/api/billing/plans')
      .then((r) => { setPlans(r.plans); setEnabled(r.enabled); })
      .catch(() => setPlans([]));
  }, []);
  return { plans, billingEnabled: enabled };
}

export function PlanCards({ plans, currentPlan, renderAction }: {
  plans: Plan[];
  currentPlan?: string;
  renderAction: (plan: Plan) => React.ReactNode;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {plans.map((p) => {
        const pro = p.priceCents > 0;
        return (
          <Card key={p.code} className={cx('flex flex-col', pro && 'border-pink/40 ring-2 ring-pink/15')}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl">{p.name}</h3>
              {currentPlan === p.code ? <Badge tone="mint">แพลนปัจจุบัน</Badge> : pro && <Badge tone="pink">แนะนำ</Badge>}
            </div>
            <p className="mt-3">
              <span className="font-display text-4xl">{pro ? formatMoney(p.priceCents, p.currency) : 'ฟรี'}</span>
              {pro && <span className="text-sm text-muted"> / เดือน</span>}
            </p>
            {pro && <p className="mt-1 text-sm font-medium text-pink">🎁 สมัครใหม่ใช้ฟรีทุกฟีเจอร์ 30 วันแรก</p>}
            <ul className="mt-5 flex-1 space-y-2 text-sm">
              {ALL_WIDGETS.map((w) => {
                const ok = p.features.widgets.includes(w);
                return (
                  <li key={w} className={cx('flex items-center gap-2', !ok && 'text-muted/70')}>
                    {ok ? <Check className="size-4 text-mint" /> : <Lock className="size-4" />} {WIDGET_LABELS[w]}
                  </li>
                );
              })}
              <li className="flex items-center gap-2"><Check className="size-4 text-mint" /> กฎ Actions สูงสุด {p.features.maxActionRules} ข้อ</li>
              <li className="flex items-center gap-2"><Check className="size-4 text-mint" /> ลิงก์ overlay {p.features.maxTokens} ชุด</li>
              <li className={cx('flex items-center gap-2', !p.features.noWatermark && 'text-muted/70')}>
                {p.features.noWatermark ? <Check className="size-4 text-mint" /> : <Lock className="size-4" />} ไม่มีป้าย VJLiveKit บนจอ
              </li>
            </ul>
            <div className="mt-6">{renderAction(p)}</div>
          </Card>
        );
      })}
    </div>
  );
}
