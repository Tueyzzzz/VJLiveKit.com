'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Check, Copy, ExternalLink, Lock, Plus, Trash2 } from 'lucide-react';
import { WIDGET_LABELS } from '@/components/Pricing';
import { Alert, Badge, Button, Card, Input, PageHeader, Spinner } from '@/components/ui';
import { api, ApiError, type OverlayTokenRow } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/** พารามิเตอร์เสริมที่ต่อท้าย URL ได้ (แสดงเป็นคำแนะนำ) */
const PARAM_HINTS: Record<string, string> = {
  coinjar: '&goal=10000',
  giftjar: '&scale=1&giftScale=1&x=0&y=0&alert=1&board=0&top=5&total=0&full=spill&minCoins=0&font=Kanit',
  goal: '&type=like|follow|share|diamond|gift&target=10000&label=...',
  chat: '&max=8',
  follower: '&label=...&showCount=0',
  topgifters: '&max=5&label=...&bg=35',
  tts: '&lang=th-TH&rate=1&readChat=1&readGift=1&minGift=1',
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="secondary" className="px-3" aria-label="คัดลอกลิงก์"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); } catch { window.prompt('คัดลอกลิงก์นี้', text); return; }
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}>
      {copied ? <Check className="size-4 text-mint" /> : <Copy className="size-4" />}
      <span className="hidden sm:inline">{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
    </Button>
  );
}

export default function WidgetsPage() {
  const { user } = useAuth();
  const [tokens, setTokens] = useState<OverlayTokenRow[] | null>(null);
  const [maxTokens, setMaxTokens] = useState(0);
  const [error, setError] = useState<{ text: string; upgrade?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ tokens: OverlayTokenRow[]; maxTokens: number }>('/api/overlay-tokens');
      setTokens(res.tokens);
      setMaxTokens(res.maxTokens);
    } catch (err) {
      setError({ text: (err as Error).message });
      setTokens([]);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const label = String(new FormData(form).get('label') ?? '').trim();
    setBusy(true);
    setError(null);
    try {
      await api('/api/overlay-tokens', { method: 'POST', body: label ? { label } : {} });
      form.reset();
      await load();
    } catch (err) {
      setError({ text: (err as Error).message, upgrade: err instanceof ApiError && err.upgrade });
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm('เพิกถอนลิงก์ชุดนี้? overlay ที่ใช้ลิงก์นี้ใน OBS จะหยุดทำงานทันที')) return;
    try {
      await api(`/api/overlay-tokens/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError({ text: (err as Error).message });
    }
  }

  if (!user) return null;

  return (
    <div>
      <PageHeader title="วิดเจ็ต & ลิงก์ OBS"
        description="คัดลอกลิงก์ไปวางใน OBS → Sources → Browser (แนะนำขนาด 1920×1080) ลิงก์เป็นความลับ อย่าแชร์ให้ใคร" />

      {!user.tiktokUsername && (
        <div className="mb-5">
          <Alert tone="info">ยังไม่ได้ตั้งชื่อ TikTok — <Link href="/dashboard/" className="font-medium text-pink underline">ตั้งที่หน้าภาพรวม</Link> ก่อนสร้างลิงก์</Alert>
        </div>
      )}

      <Card className="mb-6">
        <form onSubmit={create} className="flex flex-wrap items-center gap-3">
          <Input name="label" placeholder="ชื่อชุดลิงก์ (เช่น OBS คอมบ้าน)" maxLength={60} className="max-w-xs flex-1" />
          <Button type="submit" loading={busy} disabled={!user.tiktokUsername}><Plus className="size-4" /> สร้างลิงก์ชุดใหม่</Button>
          <span className="text-xs text-muted">ใช้แล้ว {tokens?.length ?? 0}/{maxTokens} ชุด</span>
        </form>
        {error && (
          <div className="mt-4">
            <Alert>{error.text} {error.upgrade && <Link href="/dashboard/billing/" className="font-medium underline">อัปเกรด</Link>}</Alert>
          </div>
        )}
      </Card>

      {!tokens ? <Spinner /> : tokens.length === 0 ? (
        <Card className="py-10 text-center text-sm text-muted">ยังไม่มีลิงก์ — กด “สร้างลิงก์ชุดใหม่”</Card>
      ) : (
        <div className="space-y-6">
          {tokens.map((t) => (
            <Card key={t.id}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-medium">{t.label || 'ลิงก์ไม่มีชื่อ'}</h2>
                  <p className="text-xs text-muted">สร้างเมื่อ {new Date(t.createdAt).toLocaleString('th-TH')}</p>
                </div>
                <Button variant="danger" onClick={() => revoke(t.id)}><Trash2 className="size-4" /> เพิกถอน</Button>
              </div>
              <ul className="divide-y divide-line">
                {t.urls.map((w) => (
                  <li key={w.type} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="w-44 shrink-0">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {WIDGET_LABELS[w.type] ?? w.type}
                        {w.locked && <Badge tone="pink"><Lock className="size-3" /> Pro</Badge>}
                      </div>
                      {PARAM_HINTS[w.type] && <div className="mt-0.5 truncate text-xs text-muted" title={PARAM_HINTS[w.type]}>เสริม: {PARAM_HINTS[w.type]}</div>}
                    </div>
                    {w.locked ? (
                      <Link href="/dashboard/billing/" className="text-sm text-pink hover:underline">อัปเกรดเป็น Pro เพื่อใช้วิดเจ็ตนี้</Link>
                    ) : (
                      <>
                        <code className="min-w-0 flex-1 truncate rounded-lg bg-canvas px-3 py-2 text-xs text-muted blur-[3px] transition hover:blur-none">{w.url}</code>
                        <CopyButton text={w.url} />
                        <a href={w.url} target="_blank" rel="noreferrer" aria-label="เปิดดูตัวอย่าง">
                          <Button variant="ghost" className="px-3"><ExternalLink className="size-4" /></Button>
                        </a>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
