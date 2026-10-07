'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Play, Zap } from 'lucide-react';
import { api, type Rule } from '@/lib/api';
import { translate, useT } from '@/lib/i18n';
import { GiftCell } from './GiftPicker';
import { Badge, Button, Card, Spinner, cx } from './ui';

const ACTION: Record<string, string> = { sound: '🔊 เล่นเสียง', image: '🖼️ แสดงรูป', video: '🎬 เล่นวิดีโอ', text: '✏️ ข้อความ', tarot: '🔮 เปิดไพ่ทาโร่', effect: '🦋 ผีเสื้อ', sign: '💡 ป้ายไฟ', glove: '🥊 ส่งนวม' };

function when(r: Rule, t: typeof translate): string {
  const tr = r.trigger;
  if (tr.event === 'gift') return tr.giftName ? t('ส่ง {gift}', { gift: tr.giftName }) : tr.minDiamonds ? t('กิฟต์ 💎{n}+', { n: tr.minDiamonds }) : t('ทุกกิฟต์');
  if (tr.event === 'chat') return t('แชท “{kw}”', { kw: tr.keyword ?? '' });
  const ev = ({ follow: 'มีคนติดตาม', share: 'มีคนแชร์', like: 'มีคนกดไลก์' } as Record<string, string>)[tr.event];
  return ev ? t(ev) : tr.event;
}

/** หน้าภาพรวม: กฎ Actions ที่ตั้งไว้ — เปิด/ปิด และทดลองเล่นได้จากตรงนี้ */
export function ActiveRules() {
  const t = useT();
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const load = useCallback(() => api<{ rules: Rule[] }>('/api/actions').then((r) => setRules(r.rules)).catch(() => setRules([])), []);
  useEffect(() => { void load(); }, [load]);

  async function toggle(r: Rule) {
    setRules((rs) => rs?.map((x) => (x.id === r.id ? { ...x, enabled: !x.enabled } : x)) ?? rs);
    try { await api(`/api/actions/${r.id}`, { method: 'PUT', body: { enabled: !r.enabled } }); } catch { void load(); }
  }
  async function test(r: Rule) {
    try {
      const res = await api<{ screens: number }>(`/api/actions/${r.id}/test`, { method: 'POST' });
      setNote(res.screens > 0 ? t('ส่ง “{name}” ไปที่จอแล้ว ✓', { name: r.name }) : t('ยังไม่มีจอเอฟเฟกต์ (FX) เปิดอยู่ — ใส่ลิงก์ FX ในโปรแกรมไลฟ์ก่อน'));
    } catch (e) { setNote((e as Error).message); }
    setTimeout(() => setNote(null), 4000);
  }

  const on = rules?.filter((r) => r.enabled).length ?? 0;
  return (
    <Card className="mb-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-medium"><Zap className="size-4 text-pink" /> {t('กฎ Actions ที่ตั้งไว้')} {rules && <Badge tone={on ? 'mint' : 'gray'}>{t('เปิดอยู่ {on}/{total}', { on, total: rules.length })}</Badge>}</h2>
        <Link href="/dashboard/actions/" className="inline-flex items-center gap-1 text-sm font-medium text-pink hover:underline">{t('จัดการกฎ')} <ArrowRight className="size-4" /></Link>
      </div>
      {note && <p className="mb-3 rounded-xl bg-pink-soft px-3 py-2 text-sm">{note}</p>}
      {!rules ? <Spinner /> : rules.length === 0 ? (
        <p className="text-sm text-muted">{t('ยังไม่มีกฎ —')} <Link href="/dashboard/actions/" className="text-pink underline">{t('เลือกเทมเพลตยอดนิยม')}</Link> {t('กดครั้งเดียวใช้ได้เลย เช่น ได้กุหลาบ → เล่นเสียง')}</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rules.map((r) => (
            <div key={r.id} className={cx('flex items-center gap-2 rounded-2xl border border-line p-2', !r.enabled && 'opacity-50')}>
              <div className="scale-90"><GiftCell name={r.trigger.giftName} event={r.trigger.event} /></div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.name}</div>
                <div className="truncate text-xs text-muted">{when(r, t)} → {ACTION[r.action.type] ? t(ACTION[r.action.type]) : r.action.type}</div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <button role="switch" aria-checked={r.enabled} aria-label={t('เปิด/ปิดกฎ')} onClick={() => toggle(r)}
                    className={cx('relative h-5 w-9 shrink-0 rounded-full transition', r.enabled ? 'bg-mint' : 'bg-gray-200')}>
                    <span className={cx('absolute top-0.5 size-4 rounded-full bg-white shadow transition', r.enabled ? 'left-4.5' : 'left-0.5')} />
                  </button>
                  <Button variant="ghost" className="h-7 px-2 text-xs" title={t('ทดลองเล่นบนจอ')} onClick={() => test(r)}><Play className="size-3.5" /> {t('ทดลอง')}</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
