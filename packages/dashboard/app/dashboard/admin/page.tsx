'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Activity, BarChart3, Download, Gift, KeyRound, RefreshCw, Search, Users } from 'lucide-react';
import { Alert, Badge, Button, Card, Input, PageHeader, Spinner } from '@/components/ui';
import { api, getToken } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Overview {
  users: number; signupsToday: number; signups7d: number; paidActive: number; inTrial: number; liveNow: number;
  server: { uptimeMin: number; rssMB: number; heapMB: number; load1: number; cpus: number; freeMemMB: number; totalMemMB: number };
}
interface UserRow {
  id: string; email: string; displayName: string | null; tiktokUsername: string | null; createdAt: string; admin: boolean;
  plan: string; trialEndsAt: string | null; subscription: { status: string; provider: string | null; currentPeriodEnd: string | null } | null;
}
interface Reports {
  signupsByDay: { day: string; n: number }[];
  plans: { pro: number; trial: number; free: number; total: number };
  revenueByMonth: { month: string; baht: number }[];
  topReferrers: { email: string; tiktok: string | null; referred: number }[];
}
interface Room { username: string; connected: boolean; widgets: number; owners: number; diamonds: number; gifts: number; likes: number; viewers: number; topGifter: string | null }

const d = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString('th-TH', { dateStyle: 'medium' }) : '-');
const PLAN: Record<string, [string, 'pink' | 'mint' | 'gray']> = { pro: ['Pro', 'pink'], trial: ['ทดลองฟรี', 'mint'], free: ['Free', 'gray'] };

/** หลังบ้านแอดมิน: ภาพรวม · ผู้ใช้ (แจก Pro / รีเซ็ตรหัส) · ไลฟ์ที่ออนไลน์ */
export default function AdminPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<'overview' | 'reports' | 'users' | 'live'>('overview');
  const [rep, setRep] = useState<Reports | null>(null);
  const [ov, setOv] = useState<Overview | null>(null);
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadOv = useCallback(() => api<Overview>('/api/admin/overview').then(setOv).catch((e) => setMsg({ tone: 'error', text: (e as Error).message })), []);
  const loadUsers = useCallback((query = '') => api<{ users: UserRow[] }>(`/api/admin/users?q=${encodeURIComponent(query)}`).then((r) => setUsers(r.users)).catch((e) => setMsg({ tone: 'error', text: (e as Error).message })), []);
  const loadLive = useCallback(() => api<{ rooms: Room[] }>('/api/admin/live').then((r) => setRooms(r.rooms)).catch((e) => setMsg({ tone: 'error', text: (e as Error).message })), []);

  useEffect(() => {
    if (!isAdmin) return;
    if (tab === 'overview') { void loadOv(); const t = setInterval(loadOv, 15_000); return () => clearInterval(t); }
    if (tab === 'users' && !users) void loadUsers();
    if (tab === 'reports') api<Reports>('/api/admin/reports').then(setRep).catch((e) => setMsg({ tone: 'error', text: (e as Error).message }));
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
        {([['overview', 'ภาพรวม', Activity], ['reports', 'รายงาน', BarChart3], ['users', 'ลูกค้า', Users], ['live', 'ไลฟ์ตอนนี้', RefreshCw]] as const).map(([k, l, Icon]) => (
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
            <h2 className="mb-2 font-medium">เซิร์ฟเวอร์</h2>
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>แอปใช้ RAM <b>{ov.server.rssMB} MB</b> (heap {ov.server.heapMB} MB)</div>
              <div>RAM เครื่องว่าง <b>{ov.server.freeMemMB}</b> / {ov.server.totalMemMB} MB</div>
              <div>โหลด CPU (1 นาที) <b>{ov.server.load1}</b> / {ov.server.cpus} คอร์</div>
              <div>เปิดมาแล้ว <b>{Math.floor(ov.server.uptimeMin / 60)} ชม. {ov.server.uptimeMin % 60} นาที</b></div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-canvas">
              <div className={`h-full ${ov.server.freeMemMB / ov.server.totalMemMB < 0.15 ? 'bg-pink' : 'bg-mint'}`} style={{ width: `${(1 - ov.server.freeMemMB / ov.server.totalMemMB) * 100}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted">RAM เครื่องที่ใช้ไป — ถ้าเกิน 85% บ่อย ๆ ควรอัปเกรดเครื่องที่ Vultr (รีเฟรชทุก 15 วินาที)</p>
          </Card>
        </div>
      ))}

      {tab === 'reports' && (!rep ? <Spinner /> : (() => {
        const maxN = Math.max(1, ...rep.signupsByDay.map((x) => x.n)), maxB = Math.max(1, ...rep.revenueByMonth.map((x) => x.baht));
        const P = rep.plans, pct = (n: number) => (P.total ? Math.round((n / P.total) * 100) : 0);
        return (
          <div className="space-y-4">
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
                  <tr><th className="px-4 py-3 font-normal">ผู้ใช้</th><th className="px-4 py-3 font-normal">TikTok</th><th className="px-4 py-3 font-normal">แพลน</th><th className="px-4 py-3 font-normal">หมดสิทธิ์</th><th className="px-4 py-3 font-normal">สมัคร</th><th className="px-4 py-3" /></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="px-4 py-3"><div className="font-medium">{u.displayName ?? '-'} {u.admin && <Badge tone="pink">แอดมิน</Badge>}</div><div className="text-xs text-muted">{u.email}</div></td>
                      <td className="px-4 py-3">{u.tiktokUsername ? `@${u.tiktokUsername}` : '-'}</td>
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

      {tab === 'live' && (!rooms ? <Spinner /> : rooms.length === 0 ? <Card className="py-8 text-center text-sm text-muted">ยังไม่มีใครเปิดวิดเจ็ตตอนนี้</Card> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs text-muted">
              <tr><th className="px-4 py-3 font-normal">TikTok</th><th className="px-4 py-3 font-normal">สถานะ</th><th className="px-4 py-3 font-normal">วิดเจ็ตเปิด</th><th className="px-4 py-3 font-normal">คนดู</th><th className="px-4 py-3 font-normal">เพชร</th><th className="px-4 py-3 font-normal">ไลค์</th><th className="px-4 py-3 font-normal">ส่งเยอะสุด</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rooms.map((r) => (
                <tr key={r.username}>
                  <td className="px-4 py-3 font-medium">@{r.username}</td>
                  <td className="px-4 py-3"><Badge tone={r.connected ? 'mint' : 'gray'}>{r.connected ? 'ไลฟ์อยู่' : 'รอไลฟ์'}</Badge></td>
                  <td className="px-4 py-3">{r.widgets}</td>
                  <td className="px-4 py-3">{r.viewers.toLocaleString('th-TH')}</td>
                  <td className="px-4 py-3">💎 {r.diamonds.toLocaleString('th-TH')}</td>
                  <td className="px-4 py-3">{r.likes.toLocaleString('th-TH')}</td>
                  <td className="px-4 py-3">{r.topGifter ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}
