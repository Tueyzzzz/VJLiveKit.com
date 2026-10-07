'use client';

import { useCallback, useEffect, useState } from 'react';
import { Ban, Gift, KeyRound, Link2Off, Shield, X, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { WIDGET_SETTINGS } from '@/lib/widgetSettings';
import { WIDGET_LABELS } from './Pricing';
import { SFX, playSound } from '@/lib/sounds';
import { Alert, Badge, Button, Card, Spinner } from './ui';

interface Detail {
  user: {
    id: string; email: string; displayName: string | null; tiktokUsername: string | null; role: string; createdAt: string;
    subscription: { status: string; provider: string | null; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; plan: { code: string } } | null;
    payments: { id: string; provider: string; amountCents: number; currency: string; status: string; createdAt: string }[];
    overlayTokens: { id: string; label: string | null; revoked: boolean; createdAt: string }[];
    actionRules: { id: string; name: string; enabled: boolean; trigger: { event: string; giftName?: string; minDiamonds?: number; keyword?: string }; action: { type: string; sound?: string; url?: string; text?: string; cards?: number; signStyle?: string; volume?: number; key?: string; repeat?: number } }[];
    widgetConfigs: { type: string; updatedAt: string; settings: Record<string, unknown> | null }[];
  };
  entitlements: { plan: string; trialEndsAt?: string; widgets: string[] };
  trialEnd: string; admin: boolean; adminByEnv: boolean;
  suspended: { at: string; reason: string } | null;
  live: { connected: boolean; viewers: number; diamonds: number; widgets: number } | null;
  webOpen: boolean;
  sounds: { id: string; name: string; size: number; url: string }[];
  lives: { roomId: string; startedAt: string; lastSeenAt: string; diamonds: number; peakViewers: number }[];
}

/** ค่าตั้งของวิดเจ็ต → ข้อความอ่านง่าย (ใช้ชื่อช่องจากหน้าตั้งค่า) */
function describeSettings(type: string, s: Record<string, unknown> | null): [string, string][] {
  if (!s) return [];
  const fields = new Map((WIDGET_SETTINGS[type]?.sections ?? []).flatMap((sec) => sec.fields).map((f) => [f.key, f]));
  return Object.entries(s).filter(([k]) => k !== 'resetAt').map(([k, v]) => {
    const f = fields.get(k);
    let val = typeof v === 'boolean' ? (v ? 'เปิด' : 'ปิด') : typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (f && f.type === 'select') val = f.options.find((o) => o[0] === String(v))?.[1] ?? val;
    if (f && f.type === 'swatch') val = f.options.find((o) => o[0] === Number(v))?.[2] ?? val;
    if (f && f.type === 'menuItems') { try { const j = JSON.parse(String(v)) as { hide?: string[]; icons?: Record<string, string> }; val = `ซ่อน ${j.hide?.length ?? 0} ข้อ · เปลี่ยนรูป ${Object.keys(j.icons ?? {}).length} ข้อ`; } catch { /* ignore */ } }
    return [f?.label ?? k, val.length > 120 ? val.slice(0, 120) + '…' : val];
  });
}
const actionText = (a: Detail['user']['actionRules'][number]['action']) =>
  a.type === 'sound' ? `🔊 ${a.sound ? (SFX.find(([id]) => id === a.sound)?.[1] ?? a.sound) : 'ไฟล์ของลูกค้า'}${a.volume != null ? ` · ${Math.round(a.volume * 100)}%` : ''}${a.key ? ` · ปุ่มลัด ${a.key}` : ''}`
    : a.type === 'tarot' ? `🔮 ไพ่ ${a.cards ?? 1} ใบ` : a.type === 'sign' ? `💡 ป้ายไฟ ${a.signStyle ?? 'led'}` : a.type === 'effect' ? '🦋 ผีเสื้อ' : a.type;

const d = (s?: string | null) => (s ? new Date(s).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '-');
const PLAN: Record<string, string> = { pro: 'Pro', trial: 'ทดลองฟรี', free: 'Free' };

/** หลังบ้าน: ดูลูกค้ารายคนแบบครบ + ปุ่มจัดการ (ทุกการกระทำถูกบันทึกในแท็บ "บันทึกแอดมิน") */
export function AdminUserDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [x, setX] = useState<Detail | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => api<Detail>(`/api/admin/users/${id}`).then(setX).catch((e) => setMsg({ tone: 'error', text: (e as Error).message })), [id]);
  useEffect(() => { void load(); }, [load]);

  async function act(key: string, path: string, body: unknown, ok: (r: Record<string, unknown>) => string, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(key); setMsg(null);
    try { const r = await api<Record<string, unknown>>(`/api/admin/users/${id}/${path}`, { method: 'POST', body }); setMsg({ tone: 'success', text: ok(r) }); await load(); }
    catch (e) { setMsg({ tone: 'error', text: (e as Error).message }); }
    finally { setBusy(null); }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-canvas p-4 shadow-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-xl">{x?.user.displayName ?? x?.user.email ?? 'ลูกค้า'}</h2>
            <p className="truncate text-sm text-muted">{x?.user.email} {x?.user.tiktokUsername && `· @${x.user.tiktokUsername}`}</p>
          </div>
          <Button variant="ghost" className="px-2" onClick={onClose} aria-label="ปิด"><X className="size-5" /></Button>
        </div>
        {msg && <div className="mb-3"><Alert tone={msg.tone === 'error' ? undefined : msg.tone}>{msg.text}</Alert></div>}
        {!x ? <Spinner /> : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge tone={x.entitlements.plan === 'pro' ? 'pink' : x.entitlements.plan === 'trial' ? 'mint' : 'gray'}>{PLAN[x.entitlements.plan] ?? x.entitlements.plan}</Badge>
              {x.admin && <Badge tone="violet">แอดมิน{x.adminByEnv ? ' (ADMIN_EMAILS)' : ''}</Badge>}
              {x.suspended && <Badge tone="gray">⛔ ถูกระงับ</Badge>}
              {x.live?.connected ? <Badge tone="mint">🔴 ไลฟ์อยู่ · 👀 {x.live.viewers} · 💎 {x.live.diamonds}</Badge> : x.webOpen ? <Badge tone="violet">เปิดเว็บอยู่</Badge> : <Badge tone="gray">ออฟไลน์</Badge>}
            </div>
            {x.suspended && <Alert>ระงับเมื่อ {d(x.suspended.at)}{x.suspended.reason ? ` — ${x.suspended.reason}` : ''}</Alert>}

            <Card className="p-4">
              <h3 className="mb-2 text-sm font-semibold">จัดการ</h3>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" loading={busy === 'grant'} onClick={() => { const v = prompt('แจก Pro กี่วัน?', '30'); const n = Number(v); if (v && n > 0) void act('grant', 'grant', { days: n }, () => `แจก Pro ${n} วันแล้ว ✓`); }}><Gift className="size-4" /> แจก Pro</Button>
                <Button variant="secondary" loading={busy === 'revoke'} onClick={() => act('revoke', 'revoke-pro', {}, () => 'ยกเลิก Pro แล้ว ✓', 'ยกเลิก Pro ของลูกค้าคนนี้?')}><XCircle className="size-4" /> ยกเลิก Pro</Button>
                <Button variant="secondary" loading={busy === 'pw'} onClick={() => act('pw', 'reset-password', {}, (r) => `รหัสชั่วคราว: ${String(r.tempPassword)} — ส่งให้ลูกค้าแล้วให้เปลี่ยนเอง`, 'รีเซ็ตรหัสผ่าน?')}><KeyRound className="size-4" /> รีเซ็ตรหัส</Button>
                <Button variant="secondary" loading={busy === 'tok'} onClick={() => act('tok', 'revoke-tokens', {}, (r) => `เพิกถอนลิงก์ ${String(r.count)} ชุดแล้ว ✓`, 'เพิกถอนลิงก์วิดเจ็ตทั้งหมดของลูกค้าคนนี้? วิดเจ็ตในไลฟ์จะหยุดทันที')}><Link2Off className="size-4" /> เพิกถอนลิงก์ทั้งหมด</Button>
                {!x.adminByEnv && <Button variant="secondary" loading={busy === 'role'} onClick={() => act('role', 'role', { admin: !x.admin }, () => (x.admin ? 'ถอดแอดมินแล้ว ✓' : 'ตั้งเป็นแอดมินแล้ว ✓'), x.admin ? 'ถอดสิทธิ์แอดมิน?' : 'ตั้งเป็นแอดมิน? (เห็นหลังบ้านทั้งหมด)')}><Shield className="size-4" /> {x.admin ? 'ถอดแอดมิน' : 'ตั้งเป็นแอดมิน'}</Button>}
                {x.suspended
                  ? <Button variant="secondary" loading={busy === 'sus'} onClick={() => act('sus', 'suspend', { on: false }, () => 'ยกเลิกระงับแล้ว ✓')}><Ban className="size-4" /> ยกเลิกระงับ</Button>
                  : <Button variant="danger" loading={busy === 'sus'} onClick={() => { const r = prompt('เหตุผลที่ระงับบัญชี (ลูกค้าจะล็อกอินและใช้วิดเจ็ตไม่ได้)', ''); if (r !== null) void act('sus', 'suspend', { on: true, reason: r }, () => 'ระงับบัญชีแล้ว ✓'); }}><Ban className="size-4" /> ระงับบัญชี</Button>}
              </div>
            </Card>

            <Card className="p-4 text-sm">
              <h3 className="mb-2 font-semibold">ข้อมูลบัญชี</h3>
              <dl className="grid grid-cols-[8rem_1fr] gap-y-1.5">
                <dt className="text-muted">สมัครเมื่อ</dt><dd>{d(x.user.createdAt)}</dd>
                <dt className="text-muted">ทดลองฟรีถึง</dt><dd>{d(x.trialEnd)}</dd>
                <dt className="text-muted">Pro</dt><dd>{x.user.subscription ? `${x.user.subscription.status} · ${x.user.subscription.provider ?? 'แอดมินแจก'} · ถึง ${d(x.user.subscription.currentPeriodEnd)}` : '-'}</dd>
                <dt className="text-muted">วิดเจ็ตที่ตั้งค่า</dt><dd>{x.user.widgetConfigs.length} ตัว (ดูรายละเอียดด้านล่าง)</dd>
                <dt className="text-muted">ลิงก์วิดเจ็ต</dt><dd>{x.user.overlayTokens.filter((t) => !t.revoked).length} ชุดใช้งาน · {x.user.overlayTokens.filter((t) => t.revoked).length} ชุดเพิกถอน</dd>
              </dl>
            </Card>

            <Card className="p-4 text-sm">
              <h3 className="mb-2 font-semibold">กฎ Actions ({x.user.actionRules.length})</h3>
              {x.user.actionRules.length === 0 ? <p className="text-muted">ยังไม่มีกฎ</p> : (
                <ul className="space-y-1">{x.user.actionRules.map((r) => (
                  <li key={r.id} className={r.enabled ? '' : 'text-muted line-through'}>{r.name} <span className="text-xs text-muted">— {r.trigger.event}{r.trigger.giftName ? ` ${r.trigger.giftName}` : ''}{r.trigger.minDiamonds ? ` ≥${r.trigger.minDiamonds}💎` : ''}{r.trigger.keyword ? ` “${r.trigger.keyword}”` : ''} → {actionText(r.action)}{r.action.repeat && r.action.repeat > 1 ? ` ×${r.action.repeat}` : ''}{r.action.text ? ` “${r.action.text}”` : ''}</span></li>
                ))}</ul>
              )}
            </Card>

            <Card className="p-4 text-sm">
              <h3 className="mb-2 font-semibold">การตั้งค่าวิดเจ็ต ({x.user.widgetConfigs.length})</h3>
              {x.user.widgetConfigs.length === 0 ? <p className="text-muted">ยังไม่ได้ปรับตั้งค่าวิดเจ็ตไหนเลย (ใช้ค่าเริ่มต้น)</p> : (
                <div className="space-y-2">{x.user.widgetConfigs.map((w) => {
                  const rows = describeSettings(w.type, w.settings);
                  return (
                    <details key={w.type} className="rounded-xl border border-line px-3 py-2">
                      <summary className="cursor-pointer font-medium">{WIDGET_LABELS[w.type] ?? w.type} <span className="text-xs font-normal text-muted">· {rows.length} ค่า · แก้ล่าสุด {d(w.updatedAt)}</span></summary>
                      <dl className="mt-2 grid grid-cols-[minmax(0,10rem)_1fr] gap-x-3 gap-y-1 text-xs">
                        {rows.map(([k, v]) => <><dt key={k + 'k'} className="truncate text-muted" title={k}>{k}</dt><dd key={k + 'v'} className="break-words">{v}</dd></>)}
                      </dl>
                    </details>
                  );
                })}</div>
              )}
            </Card>

            <Card className="p-4 text-sm">
              <h3 className="mb-2 font-semibold">เสียงที่อัปโหลด ({x.sounds.length})</h3>
              {x.sounds.length === 0 ? <p className="text-muted">ยังไม่มี</p> : (
                <ul className="space-y-1">{x.sounds.map((s) => (
                  <li key={s.id} className="flex items-center gap-2"><button onClick={() => void playSound({ url: s.url })} className="text-pink hover:underline">▶</button> {s.name} <span className="text-xs text-muted">{(s.size / 1048576).toFixed(1)} MB</span></li>
                ))}</ul>
              )}
            </Card>

            <Card className="p-4 text-sm">
              <h3 className="mb-2 font-semibold">ไลฟ์ล่าสุด ({x.lives.length})</h3>
              {x.lives.length === 0 ? <p className="text-muted">ยังไม่มีข้อมูล (เริ่มเก็บตั้งแต่ 7 ต.ค. 2569)</p> : (
                <ul className="space-y-1">{x.lives.map((l) => {
                  const mins = Math.max(1, Math.round((new Date(l.lastSeenAt).getTime() - new Date(l.startedAt).getTime()) / 60000));
                  return <li key={l.roomId}>{d(l.startedAt)} · {mins >= 60 ? `${Math.floor(mins / 60)} ชม. ${mins % 60} น.` : `${mins} นาที`} · 💎 {l.diamonds.toLocaleString('th-TH')} · คนดูสูงสุด {l.peakViewers}</li>;
                })}</ul>
              )}
            </Card>

            <Card className="p-4 text-sm">
              <h3 className="mb-2 font-semibold">การชำระเงิน ({x.user.payments.length})</h3>
              {x.user.payments.length === 0 ? <p className="text-muted">ยังไม่มี</p> : (
                <ul className="space-y-1">{x.user.payments.map((p) => <li key={p.id}>{d(p.createdAt)} · ฿{(p.amountCents / 100).toLocaleString('th-TH')} · {p.status} · {p.provider}</li>)}</ul>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
