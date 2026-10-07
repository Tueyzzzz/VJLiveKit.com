'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Gift, Users } from 'lucide-react';
import { Alert, Button, Card, PageHeader, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';

interface Ref { link: string; perReward: number; rewardDays: number; signedUp: number; qualified: number; monthsEarned: number; toNext: number }

/** แนะนำเพื่อน: ครบทุก 10 คน (ตั้งชื่อ TikTok แล้ว) ได้ Pro ฟรี 1 เดือน */
export default function ReferralPage() {
  const [d, setD] = useState<Ref | null>(null);
  const t = useT();
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { api<Ref>('/api/referrals/me').then(setD).catch((e) => setErr((e as Error).message)); }, []);

  if (err) return <Alert>{err}</Alert>;
  if (!d) return <Spinner />;
  const inRound = d.qualified % d.perReward;
  return (
    <div>
      <PageHeader title={t('แนะนำเพื่อน')} description={t('ชวนเพื่อนสมัครครบทุก {n} คน รับ Pro ฟรี 1 เดือน — สะสมได้ไม่จำกัด', { n: d.perReward })} />

      <Card className="mb-6">
        <div className="mb-2 text-sm font-semibold text-violet">{t('ลิงก์แนะนำของคุณ')}</div>
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-canvas px-3 py-2 text-sm">{d.link}</code>
          <Button onClick={() => { void navigator.clipboard?.writeText(d.link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
            {copied ? <><Check className="size-4" /> {t('คัดลอกแล้ว')}</> : <><Copy className="size-4" /> {t('คัดลอกลิงก์')}</>}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted">{t('ส่งให้เพื่อนสตรีมเมอร์ เพื่อนสมัครผ่านลิงก์นี้แล้ว')} <b>{t('ตั้งชื่อ TikTok ในระบบ')}</b> {t('จึงนับเป็น 1 คน')}</p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="flex items-center gap-2 text-sm text-muted"><Users className="size-4" /> {t('นับสิทธิ์แล้ว')}</div>
          <div className="mt-1 font-display text-3xl">{d.qualified}<span className="text-base text-muted"> {t('คน')}</span></div>
          <div className="text-xs text-muted">{t('สมัครผ่านลิงก์ทั้งหมด {n} คน', { n: d.signedUp })}</div>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-sm text-muted"><Gift className="size-4" /> {t('ได้ Pro ฟรีไปแล้ว')}</div>
          <div className="mt-1 font-display text-3xl">{d.monthsEarned}<span className="text-base text-muted"> {t('เดือน')}</span></div>
          <div className="text-xs text-muted">{t('ต่อจากวันหมดสิทธิ์เดิมอัตโนมัติ')}</div>
        </Card>
        <Card>
          <div className="text-sm text-muted">{t('อีก {n} คน ได้เดือนถัดไป', { n: d.toNext })}</div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-canvas">
            <div className="h-full rounded-full brand-gradient transition-all" style={{ width: `${(inRound / d.perReward) * 100}%` }} />
          </div>
          <div className="mt-1 text-right text-xs text-muted">{inRound}/{d.perReward}</div>
        </Card>
      </div>
    </div>
  );
}
