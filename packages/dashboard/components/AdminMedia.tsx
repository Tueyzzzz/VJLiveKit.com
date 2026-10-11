'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { Alert, Card, Input, Spinner } from './ui';
import { api } from '@/lib/api';
import { Pager, usePaged } from './Pager';

interface MediaFile { id: string; name: string; size: number; createdAt: string; kind: 'audio' | 'video' | 'image'; ext: string; url: string; userId: string; email: string; displayName: string; tiktok: string | null }

const fmtSize = (b: number) => b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
const KINDS: [MediaFile['kind'] | 'all', string][] = [['all', 'ทั้งหมด'], ['audio', '🎵 เสียง/เพลง'], ['video', '🎬 วิดีโอ'], ['image', '🖼️ รูป/สติกเกอร์']];

/** ไฟล์ที่ลูกค้าอัปโหลด (เสียง Beat Pad / เสียงกฎ / วิดีโอ / รูป) — ดู ฟัง และดูว่าใครอัปโหลด */
export function AdminMedia() {
  const [data, setData] = useState<{ files: MediaFile[]; totalBytes: number } | null>(null);
  const [err, setErr] = useState('');
  const [kind, setKind] = useState<MediaFile['kind'] | 'all'>('audio');
  const [q, setQ] = useState('');
  useEffect(() => { api<{ files: MediaFile[]; totalBytes: number }>('/api/admin/media').then(setData).catch((e) => setErr((e as Error).message)); }, []);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.files ?? []).filter((f) => (kind === 'all' || f.kind === kind) && (!s || [f.name, f.email, f.displayName, f.tiktok ?? ''].some((x) => x.toLowerCase().includes(s))));
  }, [data, kind, q]);
  const pg = usePaged(list, 20);
  if (err) return <Alert>{err}</Alert>;
  if (!data) return <Spinner />;
  const users = new Set(data.files.map((f) => f.userId)).size;

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="text-sm text-muted">ไฟล์ทั้งหมด <b className="text-ink">{data.files.length}</b> ไฟล์ จาก <b className="text-ink">{users}</b> คน · ใช้พื้นที่ <b className="text-ink">{fmtSize(data.totalBytes)}</b></div>
        <Alert tone="info">ไฟล์เป็นของลูกค้าที่อัปโหลดมาใช้เอง — ถ้าจะเอาไปใส่เป็นเสียงกลางให้ทุกคนใช้ ต้องขออนุญาตเจ้าของก่อน และระวังเพลงที่มีลิขสิทธิ์ (เพลงค่าย/เพลงดัง ใช้ไม่ได้)</Alert>
        <div className="flex flex-wrap gap-1.5">
          {KINDS.map(([k, l]) => (
            <button key={k} onClick={() => setKind(k)} className={`rounded-full px-3 py-1 text-sm ${kind === k ? 'bg-pink text-white' : 'bg-canvas text-muted hover:text-ink'}`}>
              {l} <span className="opacity-70">{k === 'all' ? data.files.length : data.files.filter((f) => f.kind === k).length}</span>
            </button>
          ))}
        </div>
        <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อไฟล์ อีเมล หรือชื่อ TikTok" /></div>
      </Card>

      {list.length === 0 ? <Card className="py-8 text-center text-sm text-muted">ไม่มีไฟล์</Card> : (
        <div className="space-y-2">
          {pg.items.map((f) => (
            <Card key={f.userId + f.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{f.name} <span className="text-xs font-normal uppercase text-muted">.{f.ext}</span></div>
                <div className="truncate text-xs text-muted">{f.tiktok ? `@${f.tiktok} · ` : ''}{f.displayName || f.email} · {fmtSize(f.size)} · {new Date(f.createdAt).toLocaleDateString('th-TH')}</div>
              </div>
              {f.kind === 'audio' && <audio controls preload="none" src={f.url} className="h-9 w-full sm:w-64" />}
              {f.kind === 'video' && <video controls preload="none" src={f.url} className="max-h-40 w-full rounded-lg sm:w-64" />}
              {f.kind === 'image' && <img src={f.url} alt="" loading="lazy" className="max-h-24 rounded-lg object-contain" />}
              <a href={f.url} download={f.name} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 self-start rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:text-pink sm:self-auto"><Download className="size-3.5" /> ดาวน์โหลด</a>
            </Card>
          ))}
          <Pager {...pg} />
        </div>
      )}
    </div>
  );
}
