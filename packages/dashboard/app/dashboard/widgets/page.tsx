'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Copy, ExternalLink, Lock, Plus, Settings, Trash2 } from 'lucide-react';
import { WIDGET_LABELS } from '@/components/Pricing';
import { Alert, Badge, Button, Card, Input, PageHeader, Spinner } from '@/components/ui';
import { api, ApiError, type OverlayTokenRow } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/** พารามิเตอร์เสริมที่ต่อท้าย URL ได้ (แสดงเป็นคำแนะนำ) */
const PARAM_HINTS: Record<string, string> = {
  coinjar: '&goal=10000&scale=1&giftScale=1&x=0&y=0&counter=1',
  giftjar: '&shape=jar|bowl|mason&scale=1&giftScale=1&x=0&y=0&alert=1&board=1&top=1&total=0&full=spill&minCoins=0&font=Kanit',
  goal: '&type=like|follow|share|diamond|gift&target=10000&next=0&label=...&bg=35',
  chat: '&max=8&fade=0&pos=bl&bg=35&fontSize=17',
  alerts: '&gift=1&follow=1&share=1&minCoins=1&duration=5&big=1000&pos=top&bg=35',
  follower: '&label=...&showCount=0',
  topgifters: '&max=5&label=...&bg=35&pos=tr',
  toplikers: '&max=5&label=...&bg=35&pos=tr',
  timer: '&start=60&coin=5&like=0&follow=30&share=10&max=0&label=...&fontSize=90&bg=35',
  league: '&tier=B&level=1&levels=3&target=44999&start=0&label=...',
  tts: '&lang=th-TH&rate=1&readChat=1&readGift=1&minGift=1',
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

/** จัดหมวดวิดเจ็ตในแกลเลอรี (ประเภทเดียวกันอยู่ด้วยกัน) */
const WIDGET_GROUPS: [string, string[]][] = [
  ['🎁 สะสมของขวัญ — โหล ตู้ ต้นไม้ เครื่องจักร', ['giftjar', 'tree', 'garden', 'coinjar']],
  ['🏆 เป้าหมายและลีก', ['league', 'goal', 'timer']],
  ['🔔 แจ้งเตือนและแชท', ['alerts', 'chat', 'follower', 'tts']],
  ['🥇 อันดับผู้ชม', ['topgifters', 'toplikers']],
  ['✨ เอฟเฟกต์', ['fx']],
];

/** คำอธิบายสั้นในแกลเลอรี */
const WIDGET_BLURB: Record<string, string> = {
  coinjar: 'เครื่องจักรพาสเทล ของขวัญวิ่งบนสายพานแล้วกองเป็นภูเขา',
  giftjar: 'ของขวัญจริงตกลงโหล — มีทรงโหล รถ ลูกแก้วหิมะ',
  garden: 'กระถางที่ของขวัญงอกเป็นดอกไม้บนกิ่งแกว่งตามลม',
  tree: 'ต้นไม้ใหญ่ ของขวัญบานบนพุ่มใบ เต็มแล้วร่วงกองพื้น',
  alerts: 'แจ้งเตือนของขวัญ/ติดตาม/แชร์ พร้อมรูปจริง',
  goal: 'แถบเป้าหมายไลค์ / เพชร / ผู้ติดตาม',
  chat: 'แชทสดแบบฟองกระจก',
  follower: 'ผู้ติดตามล่าสุด',
  topgifters: 'อันดับคนส่งของขวัญ (จำทั้งไลฟ์)',
  toplikers: 'อันดับคนกดไลค์',
  timer: 'นาฬิกานับถอยหลัง ผู้ชมเติมเวลาได้',
  league: 'โดมโล่พลังงาน ของขวัญพุ่งชน ปลดล็อกลีก B1 → B2 → A1',
  tts: 'อ่านแชท/ของขวัญออกเสียง',
  fx: 'เล่นเสียง/รูป/วิดีโอตามกฎ Actions',
};

/** พรีวิวสดของวิดเจ็ต (โหมดเดโม) — ย่อจาก 1920×1080 ให้พอดีการ์ด, โหลดเฉพาะตอนเลื่อนมาเห็น */
/** ความกว้างจอจำลองของตัวอย่าง (ยิ่งแคบ = วิดเจ็ตดูใหญ่ขึ้น) — วิดเจ็ตเล็ก ๆ ไม่ต้องย่อจากจอ 1920 */
const PREVIEW_W: Record<string, number> = { goal: 760, chat: 820, follower: 640, alerts: 900, timer: 760, topgifters: 900, toplikers: 900, tts: 900, fx: 1100, league: 1400 };

function WidgetPreview({ type }: { type: string }) {
  const FW = PREVIEW_W[type] ?? 1920, FH = Math.round(FW * 9 / 16);
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / FW));
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting), { rootMargin: '200px' });
    ro.observe(el); io.observe(el);
    return () => { ro.disconnect(); io.disconnect(); };
  }, [FW]);
  return (
    <div ref={ref} className="relative aspect-video overflow-hidden rounded-xl"
      style={{ background: 'radial-gradient(circle at 30% 20%, #3a2d52, #17121f 70%)' }}>
      {visible && scale > 0 && (
        <iframe src={`${API_BASE}/overlay/${type}.html?demo=1&reset=1`} title={`ตัวอย่าง ${type}`} loading="lazy"
          className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
          style={{ width: FW, height: FH, transform: `scale(${scale})` }} />
      )}
    </div>
  );
}

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

      <h2 className="mb-3 text-sm font-semibold text-violet">ตัวอย่างวิดเจ็ตทั้งหมด</h2>
      {(() => {
        const all = tokens?.[0]?.urls ?? Object.keys(WIDGET_BLURB).map((type) => ({ type, url: '', locked: false }));
        const grouped = new Set(WIDGET_GROUPS.flatMap(([, t]) => t));
        const groups: [string, typeof all][] = WIDGET_GROUPS.map(([title, types]) => [title, types.flatMap((t) => all.filter((w) => w.type === t))]);
        const rest = all.filter((w) => !grouped.has(w.type));
        if (rest.length) groups.push(['อื่น ๆ', rest]);
        return groups.filter(([, list]) => list.length).map(([title, list]) => (
      <section key={title} className="mb-8">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((w) => (
          <Card key={w.type} className="p-3">
            <WidgetPreview type={w.type} />
            <div className="mt-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {WIDGET_LABELS[w.type] ?? w.type}
                  {w.locked && <Badge tone="pink"><Lock className="size-3" /> Pro</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-muted">{WIDGET_BLURB[w.type] ?? ''}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {w.url && !w.locked && <CopyButton text={w.url} />}
                <Link href={`/dashboard/widgets/settings/?type=${w.type}`} aria-label="ตั้งค่าวิดเจ็ต">
                  <Button variant="secondary" className="px-3"><Settings className="size-4" /></Button>
                </Link>
              </div>
            </div>
          </Card>
        ))}
      </div>
      </section>
        ));
      })()}
      {tokens && tokens.length === 0 && <p className="-mt-5 mb-6 text-xs text-muted">สร้างลิงก์ชุดแรกด้านล่างก่อน จึงจะมีปุ่มคัดลอกลิงก์ในแต่ละการ์ด</p>}

      <h2 className="mb-3 text-sm font-semibold text-violet">ชุดลิงก์ของคุณ</h2>
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
                      {PARAM_HINTS[w.type] && <div className="mt-0.5 truncate text-xs text-muted" title={`ปรับผ่านลิงก์ได้ด้วย: ${PARAM_HINTS[w.type]}`}>กด “ตั้งค่า” เพื่อปรับแต่ง</div>}
                    </div>
                    {w.locked ? (
                      <Link href="/dashboard/billing/" className="text-sm text-pink hover:underline">อัปเกรดเป็น Pro เพื่อใช้วิดเจ็ตนี้</Link>
                    ) : (
                      <>
                        <code className="min-w-0 flex-1 truncate rounded-lg bg-canvas px-3 py-2 text-xs text-muted">{w.url}</code>
                        <CopyButton text={w.url} />
                        <Link href={`/dashboard/widgets/settings/?type=${w.type}`} aria-label="ตั้งค่าวิดเจ็ต">
                          <Button variant="secondary" className="px-3"><Settings className="size-4" /><span className="hidden sm:inline">ตั้งค่า</span></Button>
                        </Link>
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
