'use client';

import { Fragment, useCallback, useEffect, useState, type FormEvent } from 'react';
import { Activity, BarChart3, Bell, CreditCard, Download, Gift, History, KeyRound, Radio, RefreshCw, Search, Settings2, Users, MessageCircle, Smile } from 'lucide-react';
import { AdminUserDetail } from '@/components/AdminUserDetail';
import { AdminSupport } from '@/components/AdminSupport';
import { AdminMascots } from '@/components/AdminMascots';
import { AdminNotifications } from '@/components/AdminNotifications';
import { AdminServer } from '@/components/AdminServer';
import { AdminErrors } from '@/components/AdminErrors';
import { WIDGET_LABELS } from '@/components/Pricing';
import { Alert, Badge, Button, Card, Input, PageHeader, Spinner } from '@/components/ui';
import { api, getToken } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Overview {
  users: number; signupsToday: number; signups7d: number; paidActive: number; inTrial: number; liveNow: number;
  tiktok: { day: string; attempts: number; success: number; failed: number; skipped?: number; signKey: boolean };
  server: { uptimeMin: number; rssMB: number; heapMB: number; load1: number; cpus: number; freeMemMB: number; totalMemMB: number };
}
interface UserRow {
  id: string; email: string; displayName: string | null; tiktokUsername: string | null; createdAt: string; admin: boolean;
  plan: string; trialEndsAt: string | null; subscription: { status: string; provider: string | null; currentPeriodEnd: string | null } | null;
  live?: { status: 'live' | 'online' | 'offline'; viewers?: number; diamonds?: number; since?: number | null }; lastLiveAt?: string | null; lives30?: number;
}
interface Reports {
  signupsByDay: { day: string; n: number }[];
  plans: { pro: number; trial: number; free: number; total: number };
  revenueByMonth: { month: string; baht: number }[];
  topReferrers: { email: string; tiktok: string | null; referred: number }[];
  usage?: { widgetUse: Record<string, number>; actionUse: Record<string, number>; triggerUse: Record<string, number>; topGifts: [string, number][]; rules: number; usersWithRules: number };
}
interface Room {
  username: string; connected: boolean; widgets: number; owners: number; diamonds: number; gifts: number; likes: number; viewers: number; topGifter: string | null;
  attempts: number; connectedAt: number | null; lastError: string | null; lastErrorAt: number | null; retrying: boolean;
}
interface Lives {
  totals: { today: number; d7: number; d30: number; all: number; streamers30: number; liveNow: number };
  daily: { date: string; lives: number; streamers: number }[];
  top: { username: string; lives: number; diamonds: number; last: string }[];
  recent: { roomId: string; username: string; startedAt: string; lastSeenAt: string; diamonds: number; peakViewers: number; ended: boolean }[];
}
type SysSettings = Record<string, number | boolean | string>;
/** ช่องในหน้าตั้งค่าระบบ: [คีย์, ชื่อ, คำอธิบาย, หน่วย] */
const SYS_FIELDS: [string, string, string, string?][] = [
  ['presenceLock', 'ล็อกวิดเจ็ต (แบบ TikFinity)', 'วิดเจ็ตในโปรแกรมไลฟ์ทำงานเฉพาะตอนวีเจล็อกอินเปิดเว็บไว้ — ประหยัดเซิร์ฟเวอร์'],
  ['presenceGraceSec', 'ปิดเว็บแล้วรอก่อนพักวิดเจ็ต', 'กันรีเฟรช/เปลี่ยนหน้าแล้วจอดับ', 'วินาที'],
  ['trialDays', 'ทดลองฟรีหลังสมัคร', 'ใช้ได้ทุกอย่างเท่า Pro (มีผลกับทุกคน รวมคนที่สมัครแล้ว)', 'วัน'],
  ['freeMaxRules', 'แพลนฟรี: กฎ Actions สูงสุด', '', 'ข้อ'],
  ['freeMaxTokens', 'แพลนฟรี: ชุดลิงก์สูงสุด', '', 'ชุด'],
  ['soundMaxMB', 'อัปโหลดเสียง: ขนาดต่อไฟล์', '', 'MB'],
  ['soundMaxFiles', 'อัปโหลดเสียง: จำนวนไฟล์ต่อคน', '', 'ไฟล์'],
  ['donateDefaultMin', 'โดเนท: ขั้นต่ำเริ่มต้น', 'ใช้เมื่อวีเจยังไม่ได้ตั้งเอง', 'บาท'],
  ['brandEveryMin', 'ป้าย vjlivekit.com โผล่ทุก', 'เฉพาะแพลนฟรี/ทดลอง (โผล่ครั้งละ 6 วินาที)', 'นาที'],
  ['announcement', 'ประกาศบนแดชบอร์ด', 'ขึ้นแถบบนสุดของแดชบอร์ดทุกคน · เว้นว่าง = ไม่แสดง'],
];
const ago = (t: number | null) => { if (!t) return '-'; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'เมื่อกี้' : m < 60 ? `${m} นาทีที่แล้ว` : `${Math.floor(m / 60)} ชม. ${m % 60} นาที`; };
const EULER_DAILY = 2500; // โควตาแพ็กเกจฟรีของ EulerStream (คำขอ/วัน)

const d = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString('th-TH', { dateStyle: 'medium' }) : '-');
const PLAN: Record<string, [string, 'pink' | 'mint' | 'gray']> = { pro: ['Pro', 'pink'], trial: ['ทดลองฟรี', 'mint'], free: ['Free', 'gray'] };

/** หลังบ้านแอดมิน: ภาพรวม · ผู้ใช้ (แจก Pro / รีเซ็ตรหัส) · ไลฟ์ที่ออนไลน์ */
export default function AdminPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<'overview' | 'reports' | 'users' | 'live' | 'lives' | 'settings' | 'payments' | 'audit' | 'notify' | 'support' | 'mascots'>('overview');
  const [detail, setDetail] = useState<string | null>(null); // ลูกค้าที่เปิดดูรายละเอียด
  const [payments, setPayments] = useState<{ id: string; provider: string; providerRef: string; amountCents: number; status: string; createdAt: string; user: { id: string; email: string; tiktokUsername: string | null } }[] | null>(null);
  const [auditLog, setAuditLog] = useState<{ at: string; admin: string; action: string; target?: string; detail?: string }[] | null>(null);
  const [sys, setSys] = useState<{ settings: SysSettings; defaults: SysSettings; limits: Record<string, [number, number]> } | null>(null);
  const [sysDraft, setSysDraft] = useState<SysSettings | null>(null);
  const [lives, setLives] = useState<Lives | null>(null);
  const [rep, setRep] = useState<Reports | null>(null);
  const [ov, setOv] = useState<Overview | null>(null);
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [giftsOf, setGiftsOf] = useState<{ room: string; list: { ts: number; user: string; gift: string; img: string; d: number; n: number }[] | null } | null>(null);
  // ช่วยลูกค้าเงียบ ๆ: สั่งวิดเจ็ตบนจอรีโหลดเอง (ของขวัญไม่หาย — บันทึกก่อนรีโหลด + เติมชิ้นที่พลาด)
  async function reloadRoom(room: string | null) {
    setBusy('reload:' + (room ?? '*'));
    try {
      const r = await api<{ screens: number }>(room ? `/api/admin/live/${encodeURIComponent(room)}/reload` : '/api/admin/live-reload-all', { method: 'POST' });
      setMsg({ tone: 'success', text: `สั่งรีโหลดแล้ว ${r.screens} จอ${room ? ` (@${room})` : ' (ทุกห้อง)'} — ของขวัญบนจอไม่หาย` });
    } catch (e) { setMsg({ tone: 'error', text: (e as Error).message }); } finally { setBusy(null); }
  }
  const [pkOf, setPkOf] = useState<{ room: string; list: { t: number; kind: string; raw: string }[] | null } | null>(null);
  async function togglePk(room: string) { // อีเวนต์ PK ดิบ (นวม/สายฟ้า/คะแนน) — ไว้ตรวจว่า TikTok ส่งอะไรมา
    if (pkOf?.room === room) return setPkOf(null);
    setPkOf({ room, list: null });
    try { const r = await api<{ pk: { t: number; kind: string; raw: string }[] }>(`/api/admin/live/${encodeURIComponent(room)}/pk`); setPkOf({ room, list: r.pk }); }
    catch (e) { setPkOf(null); setMsg({ tone: 'error', text: (e as Error).message }); }
  }
  async function toggleGifts(room: string) {
    if (giftsOf?.room === room) return setGiftsOf(null);
    setGiftsOf({ room, list: null });
    try { const r = await api<{ gifts: NonNullable<NonNullable<typeof giftsOf>['list']> }>(`/api/admin/live/${encodeURIComponent(room)}/gifts`); setGiftsOf({ room, list: r.gifts }); }
    catch (e) { setGiftsOf(null); setMsg({ tone: 'error', text: (e as Error).message }); }
  }

  const loadOv = useCallback(() => api<Overview>('/api/admin/overview').then(setOv).catch((e) => setMsg({ tone: 'error', text: (e as Error).message })), []);
  const loadUsers = useCallback((query = '') => api<{ users: UserRow[] }>(`/api/admin/users?q=${encodeURIComponent(query)}`).then((r) => setUsers(r.users)).catch((e) => setMsg({ tone: 'error', text: (e as Error).message })), []);
  const loadLive = useCallback(() => api<{ rooms: Room[] }>('/api/admin/live').then((r) => setRooms(r.rooms)).catch((e) => setMsg({ tone: 'error', text: (e as Error).message })), []);

  useEffect(() => {
    if (!isAdmin) return;
    if (tab === 'overview') { void loadOv(); const t = setInterval(loadOv, 15_000); return () => clearInterval(t); }
    if (tab === 'users') { if (!users) void loadUsers(q); const t = setInterval(() => void loadUsers(q), 20_000); return () => clearInterval(t); } // สถานะไลฟ์อัปเดตเอง
    if (tab === 'reports') api<Reports>('/api/admin/reports').then(setRep).catch((e) => setMsg({ tone: 'error', text: (e as Error).message }));
    if (tab === 'payments') api<{ payments: NonNullable<typeof payments> }>('/api/admin/payments').then((r) => setPayments(r.payments)).catch((e) => setMsg({ tone: 'error', text: (e as Error).message }));
    if (tab === 'audit') api<{ audit: NonNullable<typeof auditLog> }>('/api/admin/audit').then((r) => setAuditLog(r.audit)).catch((e) => setMsg({ tone: 'error', text: (e as Error).message }));
    if (tab === 'settings') api<{ settings: SysSettings; defaults: SysSettings; limits: Record<string, [number, number]> }>('/api/admin/settings').then((r) => { setSys(r); setSysDraft(r.settings); }).catch((e) => setMsg({ tone: 'error', text: (e as Error).message }));
    if (tab === 'lives') { const f = () => api<Lives>('/api/admin/lives').then(setLives).catch((e) => setMsg({ tone: 'error', text: (e as Error).message })); void f(); const t = setInterval(f, 30_000); return () => clearInterval(t); }
    if (tab === 'live') { void loadLive(); const t = setInterval(loadLive, 10_000); return () => clearInterval(t); }
  }, [isAdmin, tab, users, loadOv, loadUsers, loadLive]);

  if (!isAdmin) return <Alert>หน้านี้สำหรับแอดมินเท่านั้น</Alert>;

  async function grant(u: UserRow) {
    const v = window.prompt(`แจก Pro ให้ ${u.email} กี่วัน?`, '30'); if (!v) return;
    setBusy(u.id + 'g'); setMsg(null);
    try { await api(`/api/admin/users/${u.id}/grant`, { method: 'POST', body: { days: Number(v) } }); setMsg({ tone: 'success', text: `แจก Pro ${v} วันให้ ${u.email} แล้ว` }); await loadUsers(q); }
    catch (e) { setMsg({ tone: 'error', text: (e as Error).message }); } finally { setBusy(null); }
  }
  async function resetPw(u: UserRow) {
    if (!window.confirm(`รีเซ็ตรหัสผ่านของ ${u.email}? รหัสเดิมจะใช้ไม่ได้ทันที`)) return;
    setBusy(u.id + 'r'); setMsg(null);
    try {
      const r = await api<{ tempPassword: string }>(`/api/admin/users/${u.id}/reset-password`, { method: 'POST', body: {} });
      setMsg({ tone: 'info', text: `รหัสชั่วคราวของ ${u.email}: ${r.tempPassword} — ส่งให้ผู้ใช้ทางแชทส่วนตัว แล้วให้เปลี่ยนรหัสในหน้าภาพรวมทันที (รหัสนี้จะไม่แสดงอีก)` });
    } catch (e) { setMsg({ tone: 'error', text: (e as Error).message }); } finally { setBusy(null); }
  }
  const onSearch = (e: FormEvent) => { e.preventDefault(); void loadUsers(q); };
  async function downloadCsv() {
    setBusy('csv');
    try {
      const API = process.env.NEXT_PUBLIC_API_BASE ?? '';
      const res = await fetch(`${API}/api/admin/users.csv`, { headers: { Authorization: `Bearer ${getToken() ?? ''}` } });
      if (!res.ok) throw new Error('ดาวน์โหลดไม่สำเร็จ');
      const url = URL.createObjectURL(await res.blob()), a = document.createElement('a');
      a.href = url; a.download = `vjlivekit-users-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { setMsg({ tone: 'error', text: (e as Error).message }); } finally { setBusy(null); }
  }

  return (
    <div>
      <PageHeader title="หลังบ้าน (แอดมิน)" description="ภาพรวมระบบ · จัดการผู้ใช้ · ไลฟ์ที่ออนไลน์อยู่" />
      <div className="mb-5 flex flex-wrap gap-2">
        {([['overview', 'ภาพรวม', Activity], ['reports', 'รายงาน', BarChart3], ['users', 'ลูกค้า', Users], ['live', 'ไลฟ์ตอนนี้', RefreshCw], ['lives', 'จำนวนไลฟ์', Radio], ['payments', 'การชำระเงิน', CreditCard], ['support', 'แชทลูกค้า', MessageCircle], ['mascots', 'มาสคอตสั่งทำ', Smile], ['notify', 'แจ้งเตือน', Bell], ['settings', 'ตั้งค่าระบบ', Settings2], ['audit', 'บันทึกแอดมิน', History]] as const).map(([k, l, Icon]) => (
          <Button key={k} variant={tab === k ? 'primary' : 'secondary'} onClick={() => setTab(k)}><Icon className="size-4" /> {l}</Button>
        ))}
      </div>
      {msg && <div className="mb-4"><Alert tone={msg.tone === 'error' ? undefined : msg.tone}>{msg.text}</Alert></div>}

      {tab === 'overview' && (!ov ? <Spinner /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {[['ผู้ใช้ทั้งหมด', ov.users], ['สมัครวันนี้', ov.signupsToday], ['สมัคร 7 วัน', ov.signups7d], ['ช่วงทดลองฟรี', ov.inTrial], ['Pro ที่ใช้งานอยู่', ov.paidActive], ['ไลฟ์ตอนนี้', ov.liveNow]].map(([l, v]) => (
              <Card key={String(l)} className="p-4"><div className="text-xs text-muted">{l}</div><div className="mt-1 font-display text-3xl">{Number(v).toLocaleString('th-TH')}</div></Card>
            ))}
          </div>
          <Card>
            <h2 className="mb-2 font-medium">การเชื่อมต่อ TikTok วันนี้</h2>
            <div className="grid gap-2 text-sm sm:grid-cols-4">
              <div>พยายามต่อ <b>{ov.tiktok.attempts.toLocaleString('th-TH')}</b> ครั้ง</div>
              <div>สำเร็จ <b className="text-mint">{ov.tiktok.success.toLocaleString('th-TH')}</b></div>
              <div>ไม่สำเร็จ <b className="text-pink">{ov.tiktok.failed.toLocaleString('th-TH')}</b> <span className="text-xs text-muted">(ส่วนใหญ่ = ยังไม่ขึ้นไลฟ์)</span></div>
              <div>Sign key {ov.tiktok.signKey ? <Badge tone="mint">ตั้งแล้ว</Badge> : <Badge tone="pink">ยังไม่ตั้ง</Badge>}</div>
              <div className="sm:col-span-4 text-xs text-muted">เช็กแล้วยังไม่ไลฟ์ (ไม่ใช้โควตา EulerStream) <b className="text-ink">{(ov.tiktok.skipped ?? 0).toLocaleString('th-TH')}</b> ครั้ง</div>
            </div>
            {(() => { const used = Math.min(1, (ov.tiktok.attempts * 1.5) / EULER_DAILY); return (
              <>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-canvas"><div className={`h-full ${used > 0.8 ? 'bg-pink' : 'bg-violet'}`} style={{ width: `${used * 100}%` }} /></div>
                <p className="mt-1 text-xs text-muted">โควตา EulerStream โดยประมาณ ~{Math.round(ov.tiktok.attempts * 1.5).toLocaleString('th-TH')} / {EULER_DAILY.toLocaleString('th-TH')} คำขอ (แพ็กเกจฟรี · นับจากเซิร์ฟเวอร์เปิดวันนี้) — ยอดจริงดูที่ dashboard ของ EulerStream</p>
              </>
            ); })()}
          </Card>
          {/* ตัวเลขผู้ใช้ + การเชื่อมต่อ TikTok อยู่บนสุด → สถานะเซิร์ฟเวอร์ (ละเอียด) → Error log */}
          <AdminServer />
          <AdminErrors />
        </div>
      ))}

      {tab === 'reports' && (!rep ? <Spinner /> : (() => {
        const maxN = Math.max(1, ...rep.signupsByDay.map((x) => x.n)), maxB = Math.max(1, ...rep.revenueByMonth.map((x) => x.baht));
        const P = rep.plans, pct = (n: number) => (P.total ? Math.round((n / P.total) * 100) : 0);
        const U = rep.usage, bars = (o: Record<string, number>, label: (k: string) => string) => {
          const e = Object.entries(o).sort((a, b) => b[1] - a[1]), m = Math.max(1, ...e.map((x) => x[1]));
          return <ul className="space-y-1.5">{e.map(([k, n]) => <li key={k} className="flex items-center gap-2 text-xs"><span className="w-36 shrink-0 truncate" title={k}>{label(k)}</span><span className="h-2 rounded-full bg-pink/70" style={{ width: `${(n / m) * 60}%` }} /><span className="text-muted">{n}</span></li>)}</ul>;
        };
        return (
          <div className="space-y-4">
            {U && (
              <Card>
                <h2 className="mb-1 font-medium">ลูกค้าใช้ฟีเจอร์อะไรบ้าง</h2>
                <p className="mb-3 text-xs text-muted">กฎ Actions ทั้งหมด {U.rules} ข้อ จาก {U.usersWithRules} คน · กดชื่อลูกค้าในแท็บ “ลูกค้า” เพื่อดูการตั้งค่ารายคน</p>
                <div className="grid gap-5 md:grid-cols-2">
                  <div><h3 className="mb-2 text-sm font-semibold">วิดเจ็ตที่ปรับตั้งค่า (คน)</h3>{bars(U.widgetUse, (k) => WIDGET_LABELS[k] ?? k)}</div>
                  <div><h3 className="mb-2 text-sm font-semibold">กฎ Actions แยกตามสิ่งที่ทำ</h3>{bars(U.actionUse, (k) => ({ sound: '🔊 เล่นเสียง', tarot: '🔮 ไพ่ทาโร่', sign: '💡 ป้ายไฟ', effect: '🦋 ผีเสื้อ', text: '✏️ ข้อความ', image: '🖼️ รูป', video: '🎬 วิดีโอ' } as Record<string, string>)[k] ?? k)}</div>
                  <div><h3 className="mb-2 text-sm font-semibold">เงื่อนไขที่ใช้</h3>{bars(U.triggerUse, (k) => ({ gift: '🎁 กิฟต์', follow: '➕ ติดตาม', share: '🔁 แชร์', like: '❤️ ไลก์', chat: '💬 แชท' } as Record<string, string>)[k] ?? k)}</div>
                  <div><h3 className="mb-2 text-sm font-semibold">กิฟต์ที่ตั้งกฎมากที่สุด</h3>{bars(Object.fromEntries(U.topGifts), (k) => k)}</div>
                </div>
              </Card>
            )}
            <Card>
              <h2 className="mb-3 font-medium">ผู้สมัครรายวัน (30 วัน) · รวม {rep.signupsByDay.reduce((a, x) => a + x.n, 0).toLocaleString('th-TH')} คน</h2>
              <div className="flex h-40 items-end gap-1">
                {rep.signupsByDay.map((x) => (
                  <div key={x.day} className="group relative flex-1">
                    <div className="w-full rounded-t brand-gradient" style={{ height: `${(x.n / maxN) * 150 + 2}px` }} />
                    <div className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-[10px] text-white group-hover:block">{x.day.slice(5)} · {x.n}</div>
                  </div>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-muted"><span>{rep.signupsByDay[0]?.day.slice(5)}</span><span>วันนี้</span></div>
            </Card>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <h2 className="mb-3 font-medium">ลูกค้าตามแพลน · ทั้งหมด {P.total.toLocaleString('th-TH')} คน</h2>
                <div className="flex h-4 overflow-hidden rounded-full">
                  <div className="bg-pink" style={{ width: `${pct(P.pro)}%` }} /><div className="bg-mint" style={{ width: `${pct(P.trial)}%` }} /><div className="bg-gray-300" style={{ width: `${pct(P.free)}%` }} />
                </div>
                <ul className="mt-3 space-y-1 text-sm">
                  <li><span className="mr-2 inline-block size-3 rounded-full bg-pink" />Pro <b>{P.pro}</b> ({pct(P.pro)}%)</li>
                  <li><span className="mr-2 inline-block size-3 rounded-full bg-mint" />ทดลองฟรี <b>{P.trial}</b> ({pct(P.trial)}%)</li>
                  <li><span className="mr-2 inline-block size-3 rounded-full bg-gray-300" />Free <b>{P.free}</b> ({pct(P.free)}%)</li>
                </ul>
              </Card>
              <Card>
                <h2 className="mb-3 font-medium">รายได้รายเดือน (12 เดือน)</h2>
                {rep.revenueByMonth.length === 0 ? <p className="text-sm text-muted">ยังไม่มีรายการชำระเงิน</p> : (
                  <ul className="space-y-1.5 text-sm">
                    {rep.revenueByMonth.map((m) => (
                      <li key={m.month} className="flex items-center gap-2">
                        <span className="w-16 text-xs text-muted">{m.month}</span>
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-canvas"><div className="h-full brand-gradient" style={{ width: `${(m.baht / maxB) * 100}%` }} /></div>
                        <span className="w-24 text-right">฿{m.baht.toLocaleString('th-TH')}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
            <Card>
              <h2 className="mb-3 font-medium">แนะนำเพื่อนเยอะที่สุด</h2>
              {rep.topReferrers.length === 0 ? <p className="text-sm text-muted">ยังไม่มีการแนะนำ</p> : (
                <ol className="space-y-1 text-sm">
                  {rep.topReferrers.map((r, i) => <li key={r.email}>{i + 1}. {r.email}{r.tiktok ? ` (@${r.tiktok})` : ''} — <b>{r.referred}</b> คน</li>)}
                </ol>
              )}
            </Card>
          </div>
        );
      })())}

      {tab === 'users' && (
        <div>
          <form onSubmit={onSearch} className="mb-4 flex gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาอีเมล / ชื่อ TikTok / ชื่อที่แสดง" className="max-w-md" />
            <Button type="submit"><Search className="size-4" /> ค้นหา</Button>
            <Button type="button" variant="secondary" loading={busy === 'csv'} onClick={downloadCsv}><Download className="size-4" /> ดาวน์โหลดรายชื่อ (Excel)</Button>
          </form>
          {!users ? <Spinner /> : users.length === 0 ? <Card className="py-8 text-center text-sm text-muted">ไม่พบผู้ใช้</Card> : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-line text-left text-xs text-muted">
                  <tr><th className="px-4 py-3 font-normal">ผู้ใช้</th><th className="px-4 py-3 font-normal">TikTok</th><th className="px-4 py-3 font-normal">สถานะไลฟ์</th><th className="px-4 py-3 font-normal">แพลน</th><th className="px-4 py-3 font-normal">หมดสิทธิ์</th><th className="px-4 py-3 font-normal">สมัคร</th><th className="px-4 py-3" /></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="px-4 py-3"><button onClick={() => setDetail(u.id)} className="text-left hover:text-pink"><div className="font-medium underline-offset-2 hover:underline">{u.displayName ?? '-'} {u.admin && <Badge tone="pink">แอดมิน</Badge>}</div><div className="text-xs text-muted">{u.email}</div></button></td>
                      <td className="px-4 py-3">{u.tiktokUsername ? `@${u.tiktokUsername}` : '-'}</td>
                      <td className="px-4 py-3 text-xs">
                        {u.live?.status === 'live' ? <Badge tone="mint">🔴 ไลฟ์อยู่</Badge> : u.live?.status === 'online' ? <Badge tone="violet">เปิดเว็บ รอไลฟ์</Badge> : <Badge tone="gray">ออฟไลน์</Badge>}
                        {u.live?.status === 'live' && <div className="mt-1 text-muted">👀 {(u.live.viewers ?? 0).toLocaleString('th-TH')} · 💎 {(u.live.diamonds ?? 0).toLocaleString('th-TH')} · {ago(u.live.since ?? null)}</div>}
                        <div className="mt-1 text-muted">ไลฟ์ล่าสุด {u.lastLiveAt ? d(u.lastLiveAt) : '-'} · 30 วัน {u.lives30 ?? 0} ครั้ง</div>
                      </td>
                      <td className="px-4 py-3"><Badge tone={PLAN[u.plan]?.[1] ?? 'gray'}>{PLAN[u.plan]?.[0] ?? u.plan}</Badge></td>
                      <td className="px-4 py-3 text-xs">{u.plan === 'trial' ? d(u.trialEndsAt) : u.plan === 'pro' ? d(u.subscription?.currentPeriodEnd) : '-'}{u.subscription?.provider ? <div className="text-muted">{u.subscription.provider}</div> : null}</td>
                      <td className="px-4 py-3 text-xs">{d(u.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <Button variant="secondary" loading={busy === u.id + 'g'} onClick={() => grant(u)}><Gift className="size-4" /> แจก Pro</Button>
                          <Button variant="secondary" loading={busy === u.id + 'r'} onClick={() => resetPw(u)}><KeyRound className="size-4" /> รีเซ็ตรหัส</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
          <p className="mt-2 text-xs text-muted">แสดงล่าสุด 100 คน — ใช้ช่องค้นหาเพื่อหาคนอื่น</p>
        </div>
      )}

      {detail && <AdminUserDetail id={detail} onClose={() => { setDetail(null); void loadUsers(q); }} />}

      {tab === 'notify' && <AdminNotifications />}
      {tab === 'support' && <AdminSupport />}
      {tab === 'mascots' && <AdminMascots />}

      {tab === 'payments' && (!payments ? <Spinner /> : payments.length === 0 ? <Card className="py-8 text-center text-sm text-muted">ยังไม่มีการชำระเงิน</Card> : (
        <Card className="overflow-x-auto p-0">
          <div className="border-b border-line px-4 py-3 text-sm">รับชำระแล้ว (PAID) รวม <b>฿{(payments.filter((x) => x.status === 'PAID').reduce((a, x) => a + x.amountCents, 0) / 100).toLocaleString('th-TH')}</b> จาก {payments.length} รายการล่าสุด</div>
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs text-muted"><tr><th className="px-4 py-3 font-normal">วันที่</th><th className="px-4 py-3 font-normal">ลูกค้า</th><th className="px-4 py-3 font-normal">ยอด</th><th className="px-4 py-3 font-normal">สถานะ</th><th className="px-4 py-3 font-normal">ช่องทาง</th></tr></thead>
            <tbody className="divide-y divide-line">
              {payments.map((x) => (
                <tr key={x.id}>
                  <td className="px-4 py-3 text-xs">{new Date(x.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className="px-4 py-3"><button onClick={() => setDetail(x.user.id)} className="text-left hover:text-pink hover:underline">{x.user.email}</button>{x.user.tiktokUsername && <div className="text-xs text-muted">@{x.user.tiktokUsername}</div>}</td>
                  <td className="px-4 py-3">฿{(x.amountCents / 100).toLocaleString('th-TH')}</td>
                  <td className="px-4 py-3"><Badge tone={x.status === 'PAID' ? 'mint' : x.status === 'PENDING' ? 'violet' : 'gray'}>{x.status}</Badge></td>
                  <td className="px-4 py-3 text-xs">{x.provider}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}

      {tab === 'audit' && (!auditLog ? <Spinner /> : auditLog.length === 0 ? <Card className="py-8 text-center text-sm text-muted">ยังไม่มีบันทึก — ทุกการแจก Pro / รีเซ็ตรหัส / ระงับบัญชี / แก้ตั้งค่า จะถูกบันทึกที่นี่</Card> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs text-muted"><tr><th className="px-4 py-3 font-normal">เวลา</th><th className="px-4 py-3 font-normal">แอดมิน</th><th className="px-4 py-3 font-normal">ทำอะไร</th><th className="px-4 py-3 font-normal">รายละเอียด</th></tr></thead>
            <tbody className="divide-y divide-line">
              {auditLog.map((a, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 text-xs">{new Date(a.at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className="px-4 py-3 text-xs">{a.admin}</td>
                  <td className="px-4 py-3">{a.action} {a.target && <button onClick={() => setDetail(a.target!)} className="text-xs text-pink hover:underline">ดูลูกค้า</button>}</td>
                  <td className="max-w-md px-4 py-3 text-xs text-muted">{a.detail ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}

      {tab === 'settings' && (!sys || !sysDraft ? <Spinner /> : (
        <Card className="space-y-4">
          {SYS_FIELDS.map(([k, label, hint, unit]) => {
            const v = sysDraft[k], def = sys.defaults[k], lim = sys.limits[k];
            return (
              <div key={k} className="flex flex-wrap items-center gap-3 border-b border-line pb-4 last:border-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs text-muted">{hint}{hint && ' · '}ค่าเริ่มต้น {typeof def === 'boolean' ? (def ? 'เปิด' : 'ปิด') : String(def || '-')}{lim ? ` · ${lim[0]}–${lim[1]}` : ''}</div>
                </div>
                {typeof def === 'boolean' ? (
                  <button type="button" role="switch" aria-checked={!!v} onClick={() => setSysDraft({ ...sysDraft, [k]: !v })}
                    className={`relative h-6 w-11 rounded-full transition ${v ? 'bg-pink' : 'bg-gray-300'}`}>
                    <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition ${v ? 'left-5.5' : 'left-0.5'}`} />
                  </button>
                ) : typeof def === 'number' ? (
                  <div className="flex items-center gap-2"><Input className="w-28 text-right" inputMode="numeric" value={String(v)} onChange={(e) => setSysDraft({ ...sysDraft, [k]: e.target.value.replace(/[^\d]/g, '') })} /><span className="w-12 text-sm text-muted">{unit}</span></div>
                ) : (
                  <Input className="w-full sm:w-96" maxLength={300} value={String(v ?? '')} onChange={(e) => setSysDraft({ ...sysDraft, [k]: e.target.value })} placeholder="เช่น 🎉 เพิ่มเสียงสำเร็จรูป 12 แบบแล้ว!" />
                )}
              </div>
            );
          })}
          <div className="flex gap-2 pt-2">
            <Button onClick={async () => {
              const body = Object.fromEntries(Object.entries(sysDraft).map(([k, v]) => [k, typeof sys.defaults[k] === 'number' ? Number(v) : v]));
              try { const r = await api<{ settings: SysSettings }>('/api/admin/settings', { method: 'PUT', body }); setSys({ ...sys, settings: r.settings }); setSysDraft(r.settings); setMsg({ tone: 'success', text: 'บันทึกแล้ว ✓ มีผลทันที' }); }
              catch (e) { setMsg({ tone: 'error', text: (e as Error).message }); }
            }}>บันทึก</Button>
            <Button variant="secondary" onClick={() => setSysDraft(sys.defaults)}>คืนค่าเริ่มต้นทั้งหมด</Button>
          </div>
        </Card>
      ))}

      {tab === 'lives' && (!lives ? <Spinner /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {[['ไลฟ์อยู่ตอนนี้', lives.totals.liveNow], ['ไลฟ์วันนี้', lives.totals.today], ['ไลฟ์ 7 วัน', lives.totals.d7], ['ไลฟ์ 30 วัน', lives.totals.d30], ['ไลฟ์ทั้งหมด', lives.totals.all], ['วีเจที่ไลฟ์ (30 วัน)', lives.totals.streamers30]].map(([l, v]) => (
              <Card key={String(l)} className="p-4"><div className="text-xs text-muted">{l}</div><div className="mt-1 font-display text-3xl">{Number(v).toLocaleString('th-TH')}</div></Card>
            ))}
          </div>
          <Card>
            <h3 className="mb-3 text-sm font-semibold">ไลฟ์ต่อวัน (14 วันล่าสุด)</h3>
            <div className="flex h-36 items-end gap-1.5">
              {lives.daily.map((x) => { const max = Math.max(1, ...lives.daily.map((y) => y.lives)); return (
                <div key={x.date} className="flex flex-1 flex-col items-center gap-1" title={`${x.date}: ${x.lives} ไลฟ์ · ${x.streamers} วีเจ`}>
                  <span className="text-[10px] text-muted">{x.lives || ''}</span>
                  <div className="w-full rounded-t-md bg-pink/70" style={{ height: `${(x.lives / max) * 100}px` }} />
                  <span className="text-[10px] text-muted">{x.date.slice(8)}</span>
                </div>); })}
            </div>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="overflow-x-auto p-0">
              <h3 className="px-4 pt-4 text-sm font-semibold">วีเจที่ไลฟ์บ่อย (30 วัน)</h3>
              <table className="mt-2 w-full text-sm"><tbody className="divide-y divide-line">
                {lives.top.length === 0 ? <tr><td className="px-4 py-6 text-center text-muted">ยังไม่มีข้อมูล</td></tr> : lives.top.map((t) => (
                  <tr key={t.username}><td className="px-4 py-2 font-medium">@{t.username}</td><td className="px-4 py-2">{t.lives} ไลฟ์</td><td className="px-4 py-2">💎 {t.diamonds.toLocaleString('th-TH')}</td><td className="px-4 py-2 text-xs text-muted">{d(t.last)}</td></tr>
                ))}
              </tbody></table>
            </Card>
            <Card className="overflow-x-auto p-0">
              <h3 className="px-4 pt-4 text-sm font-semibold">ไลฟ์ล่าสุด</h3>
              <table className="mt-2 w-full text-sm"><tbody className="divide-y divide-line">
                {lives.recent.length === 0 ? <tr><td className="px-4 py-6 text-center text-muted">ยังไม่มีข้อมูล</td></tr> : lives.recent.map((r) => {
                  const mins = Math.max(1, Math.round((new Date(r.lastSeenAt).getTime() - new Date(r.startedAt).getTime()) / 60000));
                  return <tr key={r.roomId}><td className="px-4 py-2 font-medium">@{r.username}</td><td className="px-4 py-2 text-xs">{new Date(r.startedAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</td><td className="px-4 py-2 text-xs">{mins >= 60 ? `${Math.floor(mins / 60)} ชม. ${mins % 60} น.` : `${mins} นาที`}</td><td className="px-4 py-2">💎 {r.diamonds.toLocaleString('th-TH')}</td><td className="px-4 py-2">{!r.ended && Date.now() - new Date(r.lastSeenAt).getTime() < 3 * 60_000 ? <Badge tone="mint">ไลฟ์อยู่</Badge> : <Badge tone="gray">จบแล้ว</Badge>}</td></tr>;
                })}
              </tbody></table>
            </Card>
          </div>
          <p className="text-xs text-muted">นับเฉพาะไลฟ์ที่วีเจเปิดวิดเจ็ต/เว็บไว้ (ระบบต่อเข้าไลฟ์ได้) · 1 รหัสห้องไลฟ์ของ TikTok = 1 ไลฟ์ · เริ่มนับตั้งแต่วันนี้</p>
        </div>
      ))}

      {tab === 'live' && (!rooms ? <Spinner /> : rooms.length === 0 ? <Card className="py-8 text-center text-sm text-muted">ยังไม่มีใครเปิดวิดเจ็ตตอนนี้</Card> : (
        <Card className="overflow-x-auto p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <span className="text-xs text-muted">ลูกค้าไม่ต้องกดอะไร — สั่งรีโหลดวิดเจ็ตบนจอจากตรงนี้ได้ ของขวัญไม่หาย</span>
            <Button variant="secondary" loading={busy === 'reload:*'} onClick={() => { if (confirm('รีโหลดวิดเจ็ตทุกห้องตอนนี้?')) void reloadRoom(null); }}><RefreshCw className="size-4" /> รีโหลดทุกห้อง</Button>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs text-muted">
              <tr><th className="px-4 py-3 font-normal">TikTok</th><th className="px-4 py-3 font-normal">สถานะ</th><th className="px-4 py-3 font-normal">การเชื่อมต่อ</th><th className="px-4 py-3 font-normal">วิดเจ็ตเปิด</th><th className="px-4 py-3 font-normal">คนดู</th><th className="px-4 py-3 font-normal">เพชร</th><th className="px-4 py-3 font-normal">ไลค์</th><th className="px-4 py-3 font-normal">ส่งเยอะสุด</th><th className="px-4 py-3 font-normal">จัดการ</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rooms.map((r) => (<Fragment key={r.username}>
                <tr>
                  <td className="px-4 py-3 font-medium">@{r.username}</td>
                  <td className="px-4 py-3"><Badge tone={r.connected ? 'mint' : r.lastError ? 'pink' : 'gray'}>{r.connected ? 'ไลฟ์อยู่' : r.retrying ? 'รอไลฟ์ (ลองใหม่อัตโนมัติ)' : 'กำลังต่อ'}</Badge></td>
                  <td className="max-w-xs px-4 py-3 text-xs">{r.connected ? <>ต่อได้ {ago(r.connectedAt)}</> : r.lastError ? <span className="text-pink" title={r.lastError}>{r.lastError.slice(0, 80)} · {ago(r.lastErrorAt)}</span> : '-'}<div className="text-muted">พยายามต่อ {r.attempts} ครั้ง</div></td>
                  <td className="px-4 py-3">{r.widgets}</td>
                  <td className="px-4 py-3">{r.viewers.toLocaleString('th-TH')}</td>
                  <td className="px-4 py-3">💎 {r.diamonds.toLocaleString('th-TH')}</td>
                  <td className="px-4 py-3">{r.likes.toLocaleString('th-TH')}</td>
                  <td className="px-4 py-3">{r.topGifter ?? '-'}</td>
                  <td className="px-4 py-3"><div className="flex gap-1.5 whitespace-nowrap">
                    <Button variant="secondary" className="px-2.5 py-1.5 text-xs" loading={busy === 'reload:' + r.username} onClick={() => void reloadRoom(r.username)} title="สั่งวิดเจ็ตบนจอของห้องนี้รีโหลด"><RefreshCw className="size-3.5" /> รีโหลดจอ</Button>
                    <Button variant="ghost" className="px-2.5 py-1.5 text-xs" onClick={() => void toggleGifts(r.username)}><Gift className="size-3.5" /> ของขวัญ</Button>
                    <Button variant="ghost" className="px-2.5 py-1.5 text-xs" onClick={() => void togglePk(r.username)}>⚔️ PK</Button>
                  </div></td>
                </tr>
                {pkOf?.room === r.username && (
                  <tr><td colSpan={9} className="bg-canvas px-4 py-3">
                    {!pkOf.list ? <Spinner /> : pkOf.list.length === 0 ? <span className="text-xs text-muted">ยังไม่มีอีเวนต์ PK ในไลฟ์นี้ (เริ่ม PK แล้วกดดูใหม่)</span> : (
                      <div className="grid max-h-80 gap-1 overflow-y-auto">
                        {pkOf.list.map((p, i) => (
                          <div key={i} className="rounded-lg bg-white px-2 py-1 font-mono text-[11px]">
                            <b className="text-pink">{p.kind}</b> · {new Date(p.t).toLocaleTimeString('th-TH')} · <span className="break-all text-muted">{p.raw.slice(0, 400)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td></tr>
                )}
                {giftsOf?.room === r.username && (
                  <tr><td colSpan={9} className="bg-canvas px-4 py-3">
                    {!giftsOf.list ? <Spinner /> : giftsOf.list.length === 0 ? <span className="text-xs text-muted">ไลฟ์นี้ยังไม่มีของขวัญ</span> : (
                      <div className="grid max-h-80 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                        {giftsOf.list.map((g, i) => (
                          <div key={i} className="flex items-center gap-2 rounded-lg bg-white px-2 py-1 text-xs">
                            {/^https:\/\//.test(g.img) ? <img src={g.img} alt="" className="size-6 object-contain" /> : <span>🎁</span>}
                            <span className="min-w-0 flex-1 truncate"><b>{g.user}</b> · {g.gift} <b className="text-pink">×{g.n}</b></span>
                            <span className="text-muted">💎{(g.d * g.n).toLocaleString('th-TH')}</span>
                            <span className="text-muted">{g.ts ? new Date(g.ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td></tr>
                )}
              </Fragment>))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}
