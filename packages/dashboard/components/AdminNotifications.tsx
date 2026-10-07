'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Alert, Badge, Button, Card, Field, Input, Select, Spinner } from './ui';

interface Note { id: string; title: string; body: string; link?: string; icon?: string; audience: string; createdAt: string; by: string }
const AUD: Record<string, string> = { all: 'ทุกคน', trial: 'ช่วงทดลองฟรี', pro: 'Pro', free: 'Free' };
const ICONS = ['📢', '🎉', '✨', '🆕', '🛠️', '⚠️', '💖', '🎁', '🔮', '🦋'];

/** หลังบ้าน: เขียนการแจ้งเตือน → ขึ้นที่กระดิ่งบนแดชบอร์ดลูกค้า */
export function AdminNotifications() {
  const [list, setList] = useState<Note[] | null>(null);
  const [f, setF] = useState({ icon: '📢', title: '', body: '', link: '', audience: 'all' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const load = useCallback(() => api<{ notifications: Note[] }>('/api/admin/notifications').then((r) => setList(r.notifications)).catch((e) => setMsg({ tone: 'error', text: (e as Error).message })), []);
  useEffect(() => { void load(); }, [load]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!confirm(`ส่งการแจ้งเตือนถึง “${AUD[f.audience]}”?`)) return;
    setBusy(true); setMsg(null);
    try { await api('/api/admin/notifications', { method: 'POST', body: f }); setF({ ...f, title: '', body: '', link: '' }); setMsg({ tone: 'success', text: 'ส่งแล้ว ✓ ลูกค้าจะเห็นที่กระดิ่งภายใน 2 นาที' }); await load(); }
    catch (err) { setMsg({ tone: 'error', text: (err as Error).message }); } finally { setBusy(false); }
  }
  async function del(n: Note) {
    if (!confirm(`ลบ “${n.title}”? ลูกค้าจะไม่เห็นอีก`)) return;
    try { await api(`/api/admin/notifications/${n.id}`, { method: 'DELETE' }); await load(); } catch (err) { setMsg({ tone: 'error', text: (err as Error).message }); }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h2 className="mb-3 font-medium">เขียนการแจ้งเตือน</h2>
        <form onSubmit={send} className="space-y-3">
          <Field label="ไอคอน">
            <div className="flex flex-wrap gap-1.5">{ICONS.map((i) => (
              <button key={i} type="button" onClick={() => setF({ ...f, icon: i })} className={`grid size-10 place-items-center rounded-xl border text-lg ${f.icon === i ? 'border-pink bg-pink-soft' : 'border-line bg-white'}`}>{i}</button>
            ))}</div>
          </Field>
          <Field label="หัวข้อ"><Input required maxLength={80} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="เช่น ✨ เพิ่มธีมป้ายไฟใหม่ 8 แบบ!" /></Field>
          <Field label="รายละเอียด (ไม่บังคับ)">
            <textarea maxLength={500} rows={4} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="อธิบายสั้น ๆ ว่ามีอะไรใหม่ / ต้องทำอะไร"
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-pink" />
          </Field>
          <Field label="ลิงก์เมื่อกด (ไม่บังคับ)" hint="ในเว็บ เช่น /dashboard/sounds/ · เว็บอื่นต้องขึ้นต้นด้วย https://">
            <Input maxLength={300} value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} placeholder="/dashboard/widgets/" />
          </Field>
          <Field label="ส่งถึง">
            <Select value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}>
              {Object.entries(AUD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          {msg && <Alert tone={msg.tone === 'error' ? undefined : msg.tone}>{msg.text}</Alert>}
          <Button type="submit" loading={busy} className="w-full sm:w-auto"><Send className="size-4" /> ส่งการแจ้งเตือน</Button>
        </form>
        {f.title && (
          <div className="mt-4 rounded-2xl border border-dashed border-line p-3">
            <div className="mb-1 text-xs text-muted">ตัวอย่างที่ลูกค้าเห็น</div>
            <div className="flex gap-3"><span className="text-xl">{f.icon}</span><div><div className="text-sm font-medium">{f.title}</div>{f.body && <p className="whitespace-pre-line text-sm text-muted">{f.body}</p>}</div></div>
          </div>
        )}
      </Card>
      <Card className="p-0">
        <h2 className="px-5 pt-5 font-medium">ส่งไปแล้ว</h2>
        {!list ? <div className="p-5"><Spinner /></div> : list.length === 0 ? <p className="p-5 text-sm text-muted">ยังไม่เคยส่ง</p> : (
          <ul className="mt-2 divide-y divide-line">{list.map((n) => (
            <li key={n.id} className="flex gap-3 px-5 py-3">
              <span className="text-xl">{n.icon || '📢'}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium">{n.title} <Badge tone="violet">{AUD[n.audience] ?? n.audience}</Badge></div>
                {n.body && <p className="line-clamp-2 text-xs text-muted">{n.body}</p>}
                <div className="mt-0.5 text-[11px] text-muted">{new Date(n.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })} · {n.by}{n.link ? ` · ${n.link}` : ''}</div>
              </div>
              <button onClick={() => del(n)} aria-label="ลบ" className="text-muted hover:text-red-600"><Trash2 className="size-4" /></button>
            </li>
          ))}</ul>
        )}
      </Card>
    </div>
  );
}
