// อัดรูปตัวอย่างจริงของเทมเพลต Actions → public/tpl/<id>.webp (480×270)
// เปิดวิดเจ็ต FX (fx.html?debug=1) / มาสคอต ใน headless Chrome บนพื้นพาสเทล แล้วสั่งเล่น action ของเทมเพลตนั้น ถ่ายตอนสวยที่สุด
// ใช้: node scripts/capture-templates.mjs <overlayBaseUrl> [id,id,...]
//   เช่น node scripts/capture-templates.mjs http://localhost:8766/overlay/   (เสิร์ฟ packages/overlay/public แบบ static)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { TEMPLATES } from '../lib/actionTemplates.ts';

const [base = 'http://localhost:8766/overlay/', only = ''] = process.argv.slice(2);
const OUT = new URL('../public/tpl/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9334, prof = `${tmpdir()}/vjl-tplcap`, W = 960, H = 540;
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, `--window-size=${W},${H}`, '--hide-scrollbars',
  '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ver; for (let i = 0; i < 50 && !ver; i++) { await sleep(200); ver = await fetch(`http://127.0.0.1:${PORT}/json/version`).then((r) => r.json()).catch(() => null); }
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pend = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
const send = (method, params = {}, sessionId) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });

// พื้นหลังแบบจอไลฟ์พาสเทล (โบเก้นุ่ม ๆ) · เอฟเฟกต์เรืองแสงใช้โทนค่ำ ให้เห็นแสงชัด
const BG_DAY = 'radial-gradient(circle at 18% 28%,rgba(255,255,255,.45) 0,rgba(255,255,255,0) 9%),radial-gradient(circle at 82% 20%,rgba(255,240,250,.5) 0,rgba(255,240,250,0) 7%),radial-gradient(circle at 70% 78%,rgba(255,255,255,.35) 0,rgba(255,255,255,0) 11%),radial-gradient(circle at 30% 85%,rgba(255,220,240,.4) 0,rgba(255,220,240,0) 8%),radial-gradient(ellipse at 50% 120%,#f9b6d3 0,rgba(249,182,211,0) 60%),linear-gradient(150deg,#f6a9c8 0%,#d4a6ee 50%,#9dbdf2 100%)';
const BG_NIGHT = 'radial-gradient(circle at 20% 25%,rgba(255,200,240,.25) 0,rgba(255,200,240,0) 9%),radial-gradient(circle at 80% 70%,rgba(180,200,255,.22) 0,rgba(180,200,255,0) 12%),linear-gradient(160deg,#3b2a6e 0%,#7a4f9e 55%,#d38bb5 100%)';
const NIGHT = new Set(['fireflies', 'stars']);

/** ถ่ายตอนไหน (วินาทีหลังสั่งเล่น) */
function when(a) {
  if (a.type === 'tarot') return a.cards === 7 ? 9 : a.cards === 3 ? 6.2 : 3.4;
  if (a.type === 'effect') return { butterflies: 3.2, confetti: 1.3, bubbles: 2.6, balloons: 3.2, fireflies: 2.6, roses: 1.9, coins: 1.8, hearts: 2.6, snow: 2.2, sakura: 2.2, stars: 2.2 }[a.effect ?? 'butterflies'] ?? 2.5;
  if (a.type === 'glove') return 0.75;
  if (a.type === 'sign') return a.signMode === 'scroll' ? 2.6 : 1.4;
  if (a.type === 'mascot') return a.move === 'kiss' ? 2.4 : 2.2;
  return 1.0;
}

// ดักตัว Overlay: ปิดโหมดเดโม (connected=true) + เก็บ handler 'action' ไว้สั่งมาสคอตเอง
const HOOK = `(() => { let o; Object.defineProperty(window, 'Overlay', { configurable: true, get: () => o, set(v) { o = v;
  try { Object.defineProperty(v, 'connected', { configurable: true, get: () => true, set() {} }); } catch (e) {}
  const on = v.on.bind(v); window.__h = []; v.on = (k, fn) => { if (k === 'action') window.__h.push(fn); return on(k, fn); }; } }); })();`;

const list = TEMPLATES.filter((tp) => tp.id && (!only || only.split(',').includes(tp.id)));
for (const tp of list) {
  const a = tp.rule.action;
  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  const { result: { sessionId: S } } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, S);
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false }, S);
  await send('Page.addScriptToEvaluateOnNewDocument', { source: HOOK }, S);
  const page = a.type === 'mascot' ? 'mascot.html?char=G1' : 'fx.html?debug=1';
  await send('Page.navigate', { url: base + page }, S);
  await sleep(2500); // ฟอนต์ + รูปโหลด
  const bg = a.type === 'effect' && NIGHT.has(a.effect) ? BG_NIGHT : BG_DAY;
  await send('Runtime.evaluate', { expression: `document.documentElement.style.background=${JSON.stringify(bg)}; document.body.style.background='transparent';` }, S);
  const ev = JSON.stringify({ user: { nickname: 'mimi', uniqueId: 'mimi' } });
  const run = a.type === 'mascot'
    ? `window.__h.forEach((f) => f({ action: ${JSON.stringify(a)}, event: ${ev} }))`
    : `window.__play(${JSON.stringify(a)}, ${ev})`;
  await sleep(a.type === 'mascot' ? 1500 : 200);
  await send('Runtime.evaluate', { expression: run }, S);
  await sleep(when(a) * 1000);
  const { result } = await send('Page.captureScreenshot', { format: 'webp', quality: 74, clip: { x: 0, y: 0, width: W, height: H, scale: 0.5 } }, S);
  const buf = Buffer.from(result.data, 'base64');
  writeFileSync(new URL(`${tp.id}.webp`, OUT), buf);
  console.log(tp.id, Math.round(buf.length / 1024) + 'KB');
  await send('Target.closeTarget', { targetId });
}
ws.close(); chrome.kill();
await sleep(500); try { rmSync(prof, { recursive: true, force: true }); } catch { /* ignore */ }
process.exit(0);
