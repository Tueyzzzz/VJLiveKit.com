'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Alert, Badge, Button, Card, PageHeader, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Row {
  id: string; amount: number; status: string; createdAt: string; months: number; note: string | null; auto: boolean;
  email: string; tiktok: string | null; slip: string | null; slipAmount: number | null; ref: string;
}

/** แอดมิน: ตรวจสลิปโอนเงิน → อนุมัติ (เปิด Pro ตามจำนวนเดือน) / ปฏิเสธ */
export default function AdminPage() {
  const { isAdmin } = useAuth();
  const [all, setAll] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ transfers: Row[] }>(`/api/admin/transfers${all ? '?status=all' : ''}`).then((r) => setRows(r.transfers)).catch((e) => { setError((e as Error).message); setRows([]); });
  }, [all]);
  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  async function act(id: string, action: 'approve' | 'reject') {
    setBusy(id + action); setError(null);
    try { await api(`/api/admin/transfers/${id}/${action}`, { method: 'POST', body: {} }); load(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }

  if (!isAdmin) return <Alert>หน้านี้สำหรับแอดมินเท่านั้น</Alert>;
  return (
    <div>
      <PageHeader title="ตรวจสลิปโอนเงิน" description="อนุมัติ = เปิด Pro ให้ผู้ใช้ตามจำนวนเดือนทันที (นับต่อจากวันหมดอายุเดิม)" />
      <div className="mb-4 flex gap-2">
        <Button variant={all ? 'secondary' : 'primary'} onClick={() => setAll(false)}>รอตรวจ</Button>
        <Button variant={all ? 'primary' : 'secondary'} onClick={() => setAll(true)}>ทั้งหมด</Button>
      </div>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {!rows ? <Spinner /> : rows.length === 0 ? <Card className="py-10 text-center text-sm text-muted">ไม่มีรายการ</Card> : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((r) => (
            <Card key={r.id} className="flex gap-4">
              {r.slip
                ? <button type="button" onClick={() => setZoom(r.slip)} className="shrink-0"><img src={r.slip} alt="สลิป" className="h-48 w-32 rounded-lg border border-line object-cover" /></button>
                : <div className="grid h-48 w-32 shrink-0 place-items-center rounded-lg bg-canvas text-xs text-muted">ไม่มีรูป</div>}
              <div className="min-w-0 flex-1 space-y-1 text-sm">
                <div className="font-medium">{r.email}</div>
                {r.tiktok && <div className="text-muted">TikTok: @{r.tiktok}</div>}
                <div>{r.months} เดือน · ต้องจ่าย <b>{r.amount.toLocaleString('th-TH')}</b> บาท{r.slipAmount != null && <> · สลิป <b>{r.slipAmount}</b> บาท</>}</div>
                <div className="text-xs text-muted">{new Date(r.createdAt).toLocaleString('th-TH')}</div>
                <div className="truncate text-xs text-muted" title={r.ref}>อ้างอิง: {r.ref}</div>
                {r.note && <div className="text-xs text-pink">{r.note}</div>}
                {r.status === 'PENDING' ? (
                  <div className="flex gap-2 pt-2">
                    <Button loading={busy === r.id + 'approve'} onClick={() => act(r.id, 'approve')}><Check className="size-4" /> อนุมัติ</Button>
                    <Button variant="danger" loading={busy === r.id + 'reject'} onClick={() => act(r.id, 'reject')}><X className="size-4" /> ปฏิเสธ</Button>
                  </div>
                ) : <Badge tone={r.status === 'PAID' ? 'mint' : 'pink'}>{r.status === 'PAID' ? (r.auto ? 'ผ่าน (อัตโนมัติ)' : 'อนุมัติแล้ว') : 'ปฏิเสธ'}</Badge>}
              </div>
            </Card>
          ))}
        </div>
      )}
      {zoom && (
        <button type="button" onClick={() => setZoom(null)} className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
          <img src={zoom} alt="สลิป" className="max-h-full max-w-full rounded-xl" />
        </button>
      )}
    </div>
  );
}
