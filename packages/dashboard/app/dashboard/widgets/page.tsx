'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Copy, ExternalLink, Lock, Plus, Settings, Trash2 } from 'lucide-react';
import { WIDGET_LABELS } from '@/components/Pricing';
import { Alert, Badge, Button, Card, Input, PageHeader, Spinner } from '@/components/ui';
import { api, ApiError, type OverlayTokenRow } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLang, useT } from '@/lib/i18n';
import { WIDGET_SETTINGS } from '@/lib/widgetSettings';

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

/** วิดเจ็ตที่กำลังพัฒนา — ลูกค้าเห็นเป็นสีเทา ใช้ไม่ได้ (แอดมินยังใช้ทดสอบได้) */
const SOON = new Set(['league']);

const COLLECT_GROUP = '🎁 สะสมของขวัญ — โหล ตู้ ต้นไม้ เครื่องจักร';

/** จัดหมวดวิดเจ็ตในแกลเลอรี (ประเภทเดียวกันอยู่ด้วยกัน) */
const WIDGET_GROUPS: [string, string[]][] = [
  [COLLECT_GROUP, ['pile', 'giftjar', 'aquarium', 'belly', 'snowglobe', 'spacedome', 'vehicle', 'tree', 'garden', 'coinjar']],
  ['🏆 เป้าหมายและลีก', ['league', 'goal', 'timer']],
  ['🔔 แจ้งเตือนและแชท', ['alerts', 'chat', 'follower']],
  ['🥇 อันดับผู้ชม', ['topgifters', 'toplikers']],
  ['✨ เอฟเฟกต์', ['fx', 'fxmenu', 'sign']],
];

/** คำอธิบายสั้นในแกลเลอรี */
const WIDGET_BLURB: Record<string, string> = {
  donate: 'แจ้งเตือนโดเนทผ่านพร้อมเพย์ — ตั้งค่าที่เมนู “โดเนทขึ้นจอ”',
  pile: 'ไม่มีโหล ของขวัญตกลงมากองทับกันเป็นภูเขาที่ขอบล่างจอ ของแพงอยู่บนสุด',
  coinjar: 'เครื่องจักรพาสเทล ของขวัญวิ่งบนสายพานแล้วกองเป็นภูเขา',
  giftjar: 'ของขวัญจริงตกลงโหล — มีทรงโหล รถ ลูกแก้วหิมะ',
  belly: 'หมู แมว ไดโน หมี กบ อ้าปากงับของขวัญ แล้วไปกองในท้องใส',
  spacedome: 'ของขวัญลอยไร้แรงโน้มถ่วงหมุนวนในโดม · 10 แบบ (มีสายเท่)',
  snowglobe: 'ของขวัญตกลงในลูกแก้วหน้าบ้านกระต่าย หิมะโปรยในโดม',
  aquarium: 'ของขวัญตกลงน้ำ จมช้า ๆ มีฟองอากาศ · ตู้ปลา 7 แบบ + เรือดำน้ำ',
  vehicle: 'รถลากของขวัญแบบรถงานแต่ง ผูกเชือกท้ายรถ กระเด้งตามถนน',
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
  fxmenu: 'เมนูบอกผู้ชมว่าส่งของขวัญอะไร → เกิดอะไรบนจอ (ดึงจากกฎ Actions อัตโนมัติ)',
  sign: 'ป้ายไฟ LED / นีออน / ไฟหลอด ข้อความวิ่ง ใส่ยอดไลก์-เพชรสดได้',
};

/** พรีวิวสดของวิดเจ็ต (โหมดเดโม) — ย่อจาก 1920×1080 ให้พอดีการ์ด, โหลดเฉพาะตอนเลื่อนมาเห็น */
/** ความกว้างจอจำลองของตัวอย่าง (ยิ่งแคบ = วิดเจ็ตดูใหญ่ขึ้น) — วิดเจ็ตเล็ก ๆ ไม่ต้องย่อจากจอ 1920 */
const PREVIEW_W: Record<string, number> = { goal: 760, chat: 820, follower: 640, alerts: 900, timer: 760, topgifters: 900, toplikers: 900, tts: 900, fx: 1100, fxmenu: 760, sign: 1000, league: 1400, donate: 900 };

/** ตั้งค่าที่บันทึกไว้ → พารามิเตอร์ URL ของตัวอย่าง (พารามิเตอร์ใน URL มาก่อนค่าเริ่มต้นเสมอ) */
function configQuery(config?: Record<string, unknown>): string {
  if (!config) return '';
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(config)) if (k !== 'resetAt' && v !== null && v !== undefined && v !== '') q.set(k, String(v));
  const str = q.toString();
  return str ? '&' + str : '';
}

/** รูปนิ่งของแบบที่เลือกไว้ (จากตัวเลือกที่มีรูปย่อในหน้าตั้งค่า) */
function posterOf(type: string, config?: Record<string, unknown>): string | null {
  const def = WIDGET_SETTINGS[type];
  if (!def) return null;
  for (const sec of def.sections) for (const f of sec.fields) {
    if (f.type !== 'select' || !f.options.some((o) => o[3])) continue;
    const v = String(config?.[f.key] ?? f.def);
    const opt = f.options.find((o) => o[0] === v) ?? f.options.find((o) => o[3]);
    if (opt?.[3]) return opt[3].startsWith('/') ? `${API_BASE}${opt[3]}` : `${API_BASE}/overlay/themes/thumbs/${opt[3]}.webp`;
  }
  // วิดเจ็ตที่ไม่มีธีมรูป → ใช้รูปจริงของแบบที่เลือก (กรอบ Top 3 · หัวใจแก้ว · ไพ่ทาโร่)
  const v = (k: string, d: string) => String(config?.[k] ?? d);
  if ((type === 'topgifters' || type === 'toplikers') && v('frames', 'a') !== 'off') return `${API_BASE}/overlay/thumbs/${type}-${v('frames', 'a')}.webp`; // แท่น Top 3 มีรูปโปรไฟล์
  if (type === 'topgifters' || type === 'toplikers') {
    const first: Record<string, string> = { a: 'r1', b: 'r1b', gaming: 'g1', singer: 's1', toy: 't1', minimal: type === 'toplikers' ? 't1' : 'r1' };
    const k = first[v('frames', 'a')] ?? (type === 'toplikers' ? 't1' : 'r1');
    return `${API_BASE}/overlay/frames/${type === 'toplikers' && v('frames', 'a') === 'a' ? 't1' : k}.webp`;
  }
  if (type === 'goal') {
    const st = v('style', 'bar');
    return `${API_BASE}/overlay/hearts/thumb-${st.startsWith('h-') ? st.slice(2) : 'melody'}.webp`; // หัวใจมีน้ำ 50%
  }
  if (type === 'fx') return `${API_BASE}/overlay/tarot/m10.webp`;
  if (type === 'pile') return `${API_BASE}/overlay/thumbs/pile.webp`;
  return null;
}
const ICON: Record<string, string> = { league: '🏆', goal: '🎯', timer: '⏱️', alerts: '🔔', chat: '💬', follower: '➕', topgifters: '🥇', toplikers: '💗', tts: '🔊', fx: '✨', fxmenu: '📜', sign: '💡', donate: '💸' };

/**
 * ตัวอย่างวิดเจ็ต: ปกติแสดงรูปนิ่ง (เบา ไม่หน่วงหน้าเว็บ) — ชี้เมาส์/กดเล่น ถึงจะเปิดตัวอย่างจริง ทีละใบ
 * (ตัวอย่างจริงทุกใบรันฟิสิกส์ในเธรดเดียวกับหน้านี้ ถ้าเปิดพร้อมกันหมดหน้าจะค้าง)
 */
function WidgetPreview({ type, config, live, onLive }: { type: string; config?: Record<string, unknown>; live: boolean; onLive: (on: boolean) => void }) {
  const FW = PREVIEW_W[type] ?? 1920, FH = Math.round(FW * 9 / 16);
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / FW));
    ro.observe(el);
    return () => ro.disconnect();
  }, [FW]);
  const t = useT();
  const poster = posterOf(type, config);
  return (
    <div ref={ref} className="group relative aspect-video overflow-hidden rounded-xl"
      onMouseEnter={() => onLive(true)} onMouseLeave={() => onLive(false)}
      style={{ background: 'radial-gradient(circle at 30% 20%, #3a2d52, #17121f 70%)' }}>
      {live && scale > 0 ? (
        <iframe src={`${API_BASE}/overlay/${type}.html?demo=1&reset=1${configQuery(config)}`} title={t('ตัวอย่าง {type}', { type })}
          className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
          style={{ width: FW, height: FH, transform: `scale(${scale})` }} />
      ) : (
        <button type="button" onClick={() => onLive(true)} aria-label={t('เล่นตัวอย่าง')}
          className="absolute inset-0 grid place-items-center">
          {poster
            ? <img src={poster} alt="" loading="lazy" className="h-4/5 w-auto object-contain drop-shadow-lg" />
            : <span className="text-5xl">{ICON[type] ?? '🎁'}</span>}
          <span className="absolute bottom-2 right-2 rounded-full bg-black/45 px-2.5 py-1 text-[11px] text-white opacity-80 group-hover:opacity-100">{t('▶ ดูตัวอย่าง')}</span>
        </button>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="secondary" className="px-3" aria-label={t('คัดลอกลิงก์')}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); } catch { window.prompt(t('คัดลอกลิงก์นี้'), text); return; }
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}>
      {copied ? <Check className="size-4 text-mint" /> : <Copy className="size-4" />}
      <span className="hidden sm:inline">{copied ? t('คัดลอกแล้ว') : t('คัดลอก')}</span>
    </Button>
  );
}

export default function WidgetsPage() {
  const { user, isAdmin } = useAuth();
  const t = useT();
  const [lang] = useLang();
  const soon = (type: string) => SOON.has(type) && !isAdmin;
  const [tokens, setTokens] = useState<OverlayTokenRow[] | null>(null);
  const [maxTokens, setMaxTokens] = useState(0);
  const [error, setError] = useState<{ text: string; upgrade?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [configs, setConfigs] = useState<Record<string, Record<string, unknown>>>({});
  const [livePreview, setLivePreview] = useState<string | null>(null); // เล่นตัวอย่างจริงทีละใบ
  // โหลดใหม่ทุกครั้งที่กลับมาที่แท็บนี้ (เปลี่ยนแบบจากหน้าตั้งค่า/แท็บอื่น → ป้าย "ใช้อยู่" ไม่ค้างค่าเก่า)
  useEffect(() => {
    const f = () => api<{ configs: Record<string, Record<string, unknown>> }>('/api/widgets/configs').then((r) => setConfigs(r.configs)).catch(() => {});
    void f(); const onVis = () => { if (document.visibilityState === 'visible') void f(); };
    window.addEventListener('focus', f); document.addEventListener('visibilitychange', onVis);
    return () => { window.removeEventListener('focus', f); document.removeEventListener('visibilitychange', onVis); };
  }, []);
  // ลิงก์เดียวของกลุ่มสะสมของขวัญ: เลือกแบบที่นี่ → จอใน OBS เปลี่ยนเองทันที
  const collectStyle = String(configs.collect?.style ?? 'giftjar');
  async function pickCollect(style: string) {
    const next = { ...(configs.collect ?? {}), style };
    setConfigs((c) => ({ ...c, collect: next }));
    try { await api('/api/widgets/collect/config', { method: 'PUT', body: next }); }
    catch (err) { setError({ text: (err as Error).message }); }
  }

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
    if (!confirm(t('เพิกถอนลิงก์ชุดนี้? overlay ที่ใช้ลิงก์นี้ใน OBS จะหยุดทำงานทันที'))) return;
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
      <PageHeader title={t('โอเวอร์เลย์')}
        description={t('คัดลอกลิงก์ไปวางใน OBS → Sources → Browser (แนะนำขนาด 1920×1080) ลิงก์เป็นความลับ อย่าแชร์ให้ใคร')} />

      {!user.tiktokUsername && (
        <div className="mb-5">
          <Alert tone="info">{t('ยังไม่ได้ตั้งชื่อ TikTok —')} <Link href="/dashboard/" className="font-medium text-pink underline">{t('ตั้งที่หน้าภาพรวม')}</Link> {t('ก่อนสร้างลิงก์')}</Alert>
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold text-violet">{t('ตัวอย่างวิดเจ็ตทั้งหมด')}</h2>
      {(() => {
        const all = tokens?.[0]?.urls ?? Object.keys(WIDGET_BLURB).map((type) => ({ type, url: '', locked: false }));
        const grouped = new Set([...WIDGET_GROUPS.flatMap(([, ts]) => ts), 'collect', 'donate']); // donate = กำลังพัฒนา ซ่อนไว้ก่อน
        const collectUrl = all.find((w) => w.type === 'collect' && !w.locked)?.url;
        const groups: [string, typeof all][] = WIDGET_GROUPS.map(([title, types]) => [title, types.flatMap((ty) => all.filter((w) => w.type === ty))]);
        const rest = all.filter((w) => !grouped.has(w.type));
        const others = rest.filter((w) => w.type !== 'tts'); // TTS ย้ายไปเมนูข้าง (เสียงออกที่เว็บ)
        if (others.length) groups.push(['อื่น ๆ', others]);
        return groups.filter(([, list]) => list.length).map(([title, list]) => (
      <section key={title} className="mb-8">
      <h3 className="mb-3 text-sm font-semibold">{t(title)}</h3>
      {title === COLLECT_GROUP && (
        <Card className="mb-4 flex flex-col gap-3 ring-2 ring-pink/30 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{t('🔗 ลิงก์เดียวใช้ได้ทุกแบบ — ตอนนี้ใช้:')} <b className="text-pink">{t(WIDGET_LABELS[collectStyle] ?? collectStyle)}</b></div>
            <p className="text-xs text-muted">{t('วางลิงก์นี้ใน OBS / LIVE Studio ครั้งเดียว แล้วกด “ใช้แบบนี้” ที่การ์ดด้านล่าง จอเปลี่ยนแบบเองทันที ไม่ต้องเปลี่ยนลิงก์')}</p>
          </div>
          {collectUrl && <code className="block truncate rounded-lg bg-canvas px-3 py-2 text-xs text-muted sm:max-w-md">{collectUrl}</code>}
          {collectUrl ? <CopyButton text={collectUrl} /> : <span className="text-xs text-muted">{t('ตั้งชื่อ TikTok ที่หน้าภาพรวมก่อน')}</span>}
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((w) => soon(w.type) ? (
          <Card key={w.type} className="relative p-3 opacity-60 grayscale">
            <div className="grid aspect-video place-items-center rounded-xl bg-canvas text-4xl">🚧</div>
            <div className="mt-3 flex items-center gap-2 text-sm font-medium">{t(WIDGET_LABELS[w.type] ?? w.type)} <Badge tone="gray">{t('กำลังพัฒนา')}</Badge></div>
            <p className="mt-0.5 text-xs text-muted">{t('กำลังพัฒนา เปิดให้ใช้เร็ว ๆ นี้')}</p>
          </Card>
        ) : (
          <Card key={w.type} className={`p-3 ${title === COLLECT_GROUP && collectStyle === w.type ? 'ring-2 ring-pink' : ''}`}>
            <WidgetPreview type={w.type} config={configs[w.type]} live={livePreview === w.type}
              onLive={(on) => setLivePreview((cur) => (on ? w.type : cur === w.type ? null : cur))} />
            <div className="mt-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {t(WIDGET_LABELS[w.type] ?? w.type)}
                  {w.locked && <Badge tone="pink"><Lock className="size-3" /> Pro</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-muted">{WIDGET_BLURB[w.type] ? t(WIDGET_BLURB[w.type]) : ''}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {title === COLLECT_GROUP ? (
                  collectStyle === w.type ? <Badge tone="pink"><Check className="size-3" /> {t('ใช้อยู่')}</Badge>
                    : !w.locked && <Button variant="secondary" className="px-3 text-xs" onClick={() => pickCollect(w.type)}>{t('ใช้แบบนี้')}</Button>
                ) : w.url && !w.locked && <CopyButton text={w.url} />}
                <Link href={`/dashboard/widgets/settings/?type=${w.type}`} aria-label={t('ตั้งค่าวิดเจ็ต')}>
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
      {tokens && tokens.length === 0 && <p className="-mt-5 mb-6 text-xs text-muted">{t('สร้างลิงก์ชุดแรกด้านล่างก่อน จึงจะมีปุ่มคัดลอกลิงก์ในแต่ละการ์ด')}</p>}

      <h2 className="mb-3 text-sm font-semibold text-violet">{t('ชุดลิงก์ของคุณ')}</h2>
      <Card className="mb-6">
        <form onSubmit={create} className="flex flex-wrap items-center gap-3">
          <Input name="label" placeholder={t('ชื่อชุดลิงก์ (เช่น OBS คอมบ้าน)')} maxLength={60} className="max-w-xs flex-1" />
          <Button type="submit" loading={busy} disabled={!user.tiktokUsername}><Plus className="size-4" /> {t('สร้างลิงก์ชุดใหม่')}</Button>
          <span className="text-xs text-muted">{t('ใช้แล้ว {used}/{max} ชุด', { used: tokens?.length ?? 0, max: maxTokens })}</span>
        </form>
        {error && (
          <div className="mt-4">
            <Alert>{error.text} {error.upgrade && <Link href="/dashboard/billing/" className="font-medium underline">{t('อัปเกรด')}</Link>}</Alert>
          </div>
        )}
      </Card>

      {!tokens ? <Spinner /> : tokens.length === 0 ? (
        <Card className="py-10 text-center text-sm text-muted">{t('ยังไม่มีลิงก์ — กด “สร้างลิงก์ชุดใหม่”')}</Card>
      ) : (
        <div className="space-y-6">
          {tokens.map((tok) => (
            <Card key={tok.id}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-medium">{tok.label || t('ลิงก์ไม่มีชื่อ')}</h2>
                  <p className="text-xs text-muted">{t('สร้างเมื่อ {date}', { date: new Date(tok.createdAt).toLocaleString(lang === 'en' ? 'en-US' : 'th-TH') })}</p>
                </div>
                <Button variant="danger" onClick={() => revoke(tok.id)}><Trash2 className="size-4" /> {t('เพิกถอน')}</Button>
              </div>
              <ul className="divide-y divide-line">
                {tok.urls.filter((w) => !soon(w.type)).map((w) => (
                  <li key={w.type} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="w-44 shrink-0">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {t(WIDGET_LABELS[w.type] ?? w.type)}
                        {w.locked && <Badge tone="pink"><Lock className="size-3" /> Pro</Badge>}
                      </div>
                      {PARAM_HINTS[w.type] && <div className="mt-0.5 truncate text-xs text-muted" title={t('ปรับผ่านลิงก์ได้ด้วย: {params}', { params: PARAM_HINTS[w.type] })}>{t('กด “ตั้งค่า” เพื่อปรับแต่ง')}</div>}
                    </div>
                    {w.locked ? (
                      <Link href="/dashboard/billing/" className="text-sm text-pink hover:underline">{t('อัปเกรดเป็น Pro เพื่อใช้วิดเจ็ตนี้')}</Link>
                    ) : (
                      <>
                        <code className="min-w-0 flex-1 truncate rounded-lg bg-canvas px-3 py-2 text-xs text-muted">{w.url}</code>
                        <CopyButton text={w.url} />
                        <Link href={`/dashboard/widgets/settings/?type=${w.type}`} aria-label={t('ตั้งค่าวิดเจ็ต')}>
                          <Button variant="secondary" className="px-3"><Settings className="size-4" /><span className="hidden sm:inline">{t('ตั้งค่า')}</span></Button>
                        </Link>
                        <a href={w.url} target="_blank" rel="noreferrer" aria-label={t('เปิดดูตัวอย่าง')}>
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
