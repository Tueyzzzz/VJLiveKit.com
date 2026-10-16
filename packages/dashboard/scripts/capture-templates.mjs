// อัดตัวอย่างจริงของเทมเพลต Actions แบบจอแนวตั้ง (TikTok LIVE 9:16) → public/tpl/
//   <id>.webp       = ภาพนิ่ง (poster) 270×480 ตอนสวยที่สุด — โชว์ก่อน/ตอนไม่อยู่ในจอ
//   <id>.anim.webp  = แอนิเมชันวนลูป ~2.8 วิ 24fps (สัตว์ 25fps) 270×480 — เล่นเมื่อการ์ดอยู่ในจอ/ชี้เมาส์
// เปิดวิดเจ็ต FX (fx.html?debug=1) / มาสคอต ใน headless Chrome ขนาด 540×960 บนพื้น "กล้องไลฟ์" พาสเทลเบลอ (มีเงาคนจาง ๆ)
// แล้วสั่งเล่น action ของเทมเพลตนั้น อัดด้วย CDP screencast → เลือกเฟรมตามเวลาจริง → ต่อปลาย-ต้นแบบ crossfade ให้วนเนียน → sharp ทำ webp
// ใช้: node scripts/capture-templates.mjs <overlayBaseUrl> [id,id,...]
//   เช่น (ในโฟลเดอร์ packages/overlay) python -m http.server 8766  แล้ว  node scripts/capture-templates.mjs http://localhost:8766/public/
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { TEMPLATES } from '../lib/actionTemplates.ts';

const sharp = createRequire(import.meta.url)('sharp');
const [base = 'http://localhost:8766/overlay/', only = ''] = process.argv.slice(2);
const OUT = new URL('../public/tpl/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9334, prof = `${tmpdir()}/vjl-tplcap`, W = 540, H = 960, OW = 270, OH = 480;
const FPS = 24, LOOP = 2.8, XF = 0.5; // ความยาวลูป · ช่วง crossfade ปลาย→ต้น
const AFPS = 25; // สัตว์ (หยุดเวลาอัดทีละเฟรม) — ลื่นกว่าเดิม
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, `--window-size=${W},${H}`, '--hide-scrollbars',
  '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ver; for (let i = 0; i < 50 && !ver; i++) { await sleep(200); ver = await fetch(`http://127.0.0.1:${PORT}/json/version`).then((r) => r.json()).catch(() => null); }
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pend = new Map(), listeners = new Set();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method) listeners.forEach((f) => f(m)); });
const send = (method, params = {}, sessionId) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });

// พื้นหลังแบบกล้องมือถือตอนไลฟ์: ห้องพาสเทลหลุดโฟกัส + เงาคนจาง ๆ กลางจอ + แสงโบเก้ · เอฟเฟกต์เรืองแสงใช้ห้องโทนค่ำ
const ROOM = {
  day: { bg: 'radial-gradient(ellipse at 22% 18%,#fff4ea 0,rgba(255,244,234,0) 38%),radial-gradient(ellipse at 85% 30%,#d9c8ff 0,rgba(217,200,255,0) 45%),radial-gradient(ellipse at 50% 110%,#f7b8cf 0,rgba(247,184,207,0) 60%),linear-gradient(170deg,#f8d9e4 0%,#e6d3f3 48%,#c9d6f6 100%)',
    body: 'rgba(255,255,255,.3)', skin: 'rgba(250,214,204,.45)', hair: 'rgba(96,62,92,.22)', bokeh: 'rgba(255,255,255,.55)' },
  night: { bg: 'radial-gradient(ellipse at 20% 20%,rgba(255,190,230,.35) 0,rgba(255,190,230,0) 40%),radial-gradient(ellipse at 80% 75%,rgba(160,180,255,.3) 0,rgba(160,180,255,0) 45%),linear-gradient(165deg,#2f2560 0%,#5b3f8c 55%,#a8709f 100%)',
    body: 'rgba(200,170,230,.22)', skin: 'rgba(205,160,175,.45)', hair: 'rgba(25,12,40,.5)', bokeh: 'rgba(255,220,250,.35)' },
};
const NIGHT = new Set(['fireflies', 'stars']);
const roomJs = (r) => `(() => { const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:-60px;z-index:-1;pointer-events:none;filter:blur(24px);background:${r.bg}';
  d.innerHTML = '<svg viewBox="0 0 540 960" width="660" height="1080" style="position:absolute;left:0;top:0" preserveAspectRatio="xMidYMid slice">'
    + '<circle cx="90" cy="150" r="46" fill="${r.bokeh}"/><circle cx="470" cy="110" r="34" fill="${r.bokeh}"/><circle cx="430" cy="300" r="22" fill="${r.bokeh}"/><circle cx="70" cy="420" r="26" fill="${r.bokeh}"/>'
    + '<rect x="158" y="470" width="224" height="330" rx="100" fill="${r.hair}"/><ellipse cx="270" cy="540" rx="112" ry="126" fill="${r.hair}"/>'
    + '<path d="M96 960 C 104 800, 180 742, 270 736 C 360 742, 436 800, 444 960 Z" fill="${r.body}"/>'
    + '<rect x="242" y="650" width="56" height="96" rx="24" fill="${r.skin}"/><ellipse cx="270" cy="575" rx="84" ry="102" fill="${r.skin}"/>'
    + '<path d="M180 560 C 190 470, 240 450, 290 455 C 340 462, 368 500, 362 545 C 330 500, 260 490, 180 560 Z" fill="${r.hair}"/>'
    + '</svg>';
  document.documentElement.style.background = '#e7d6ee'; document.body.style.background = 'transparent'; document.body.prepend(d); })()`;

/** ช่วงที่อัด: เริ่มอัด (วินาทีหลังสั่งเล่น) · ภาพนิ่ง (poster) ณ วินาทีไหน · action ที่ใช้อัด (ยืดเวลาเอฟเฟกต์ให้เต็มช่วง) */
function plan(a) {
  if (a.type === 'tarot') { const p = a.cards === 7 ? 9 : a.cards === 3 ? 6.2 : 3.4; return { s0: p - 2.1, poster: p }; }
  if (a.type === 'effect' && a.effect === 'prank') return { s0: 0.05, poster: 0.9, prank: a.prank }; // 😈 มุกสั้น 2–4 วิ → อัดตั้งแต่ต้น
  if (a.type === 'effect' && a.effect === 'animal') return { s0: 0.62, poster: 0, act: { ...a, durationMs: 20000 }, animal: a.animal };
  if (a.type === 'effect') {
    if (a.effect === 'confetti') return { s0: 0.15, poster: 1.2 };
    if (a.effect === 'butterflies' || !a.effect) return { s0: 2.2, poster: 3.4 };
    const p = { bubbles: 2.8, balloons: 3.4, fireflies: 2.8, roses: 2.0, coins: 2.0, hearts: 2.8, snow: 2.6, sakura: 2.6, stars: 2.4 }[a.effect] ?? 2.5;
    return { s0: p - 1.2, poster: p, act: { ...a, durationMs: 20000 } };
  }
  if (a.type === 'glove') return { s0: 0.05, poster: 0.75 };
  if (a.type === 'sign') return { s0: 0.1, poster: a.signMode === 'scroll' ? 2.4 : 1.4 };
  if (a.type === 'mascot') return { s0: 0.3, poster: a.move === 'kiss' ? 2.4 : 2.2 };
  return { s0: 0, poster: 1.0 };
}

// ดักตัว Overlay: ปิดโหมดเดโม (connected=true) + เก็บ handler 'action' ไว้สั่งมาสคอตเอง
const HOOK = `(() => { let o; Object.defineProperty(window, 'Overlay', { configurable: true, get: () => o, set(v) { o = v;
  try { Object.defineProperty(v, 'connected', { configurable: true, get: () => true, set() {} }); } catch (e) {}
  const on = v.on.bind(v); window.__h = []; v.on = (k, fn) => { if (k === 'action') window.__h.push(fn); return on(k, fn); }; } }); })();`;

// 🐾 สัตว์น่ารัก: ภาพนิ่ง = เฟรมที่น่ารักที่สุด (ลำดับ 0–5 · สัตว์จริง 0–11) · ลูปอัด = 2 รอบท่าพอดี (ท่าวนเป๊ะ → ต่อปลาย-ต้นไม่สะดุด)
const ANIMAL_POSTER = { catshake: 1, dogshake: 1, catdance: 3, dogdance: 3, bunnyhop: 2, pandawave: 3, hamsterspin: 0, penguinslide: 2, capybara: 1, duckwalk: 4,
  frogjump: 3, bearhug: 5, catpunch: 1, dogspin: 2, catshock: 3, dogwag: 5, owlblink: 2, pigdance: 3, foxtail: 1, corgiwiggle: 2,
  // 🐾 สัตว์จริง 12 เฟรม (catstretch 10)
  'real-budgie': 4, 'real-bunny': 0, 'real-capybara': 0, 'real-catshake': 0, 'real-catstretch': 0, 'real-corgiwiggle': 0, 'real-foxyawn': 3,
  'real-hamster': 0, 'real-hedgehog': 0, 'real-kittenswat': 1, 'real-lamb': 3, 'real-owl': 0, 'real-panda': 2, 'real-penguin': 2,
  'real-puppywave': 4, 'real-raccoon': 0, 'real-redpanda': 3, 'real-shibatilt': 1 };
const evalv = async (S, expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S)).result?.result?.value;

const toRaw = (jpg) => sharp(jpg).resize(OW, OH, { kernel: 'lanczos3' }).removeAlpha().raw().toBuffer();

const list = TEMPLATES.filter((tp) => tp.id && (!only || only.split(',').includes(tp.id)));
for (const tp of list) {
  const a = tp.rule.action, pl = plan(a), act = pl.act ?? a;
  let loop = LOOP;
  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  const { result: { sessionId: S } } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, S);
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: true }, S);
  await send('Page.addScriptToEvaluateOnNewDocument', { source: HOOK }, S);
  const page = a.type === 'mascot' ? 'mascot.html?char=G1' : 'fx.html?debug=1';
  await send('Page.navigate', { url: base + page }, S);
  await sleep(2500); // ฟอนต์ + รูปโหลด
  await send('Runtime.evaluate', { expression: roomJs(a.type === 'effect' && NIGHT.has(a.effect) ? ROOM.night : ROOM.day) }, S);
  const ev = JSON.stringify({ user: { nickname: 'mimi', uniqueId: 'mimi' } });
  const run = a.type === 'mascot'
    ? `window.__h.forEach((f) => f({ action: ${JSON.stringify(act)}, event: ${ev} }))`
    : `window.__play(${JSON.stringify(act)}, ${ev})`;
  await sleep(a.type === 'mascot' ? 1500 : 300);
  if (pl.prank) await evalv(S, `window.VJLPrank && VJLPrank.preload ? VJLPrank.preload(${JSON.stringify(pl.prank)}).then(() => 1, () => 0) : 0`); // โหลดรูปมุกก่อน → เริ่มทันที
  if (pl.animal) { // โหลดเฟรมไว้ก่อน → เริ่มเล่นทันทีที่สั่ง · ภาพนิ่ง = เฟรมเต็ม ๆ หลังวนครบ 1 รอบ
    const cyc = (await evalv(S, `window.__animalCycle(${JSON.stringify(pl.animal)})`)) / 1000;
    const nfr = (await evalv(S, `window.__animalCount ? window.__animalCount(${JSON.stringify(pl.animal)}) : 6`)) || 6; // การ์ตูน 6 · สัตว์จริง 12
    await evalv(S, `window.__animalPreload(${JSON.stringify(pl.animal)})`);
    loop = 2 * cyc; pl.holdMs = Math.round((2 * cyc + ((ANIMAL_POSTER[pl.animal] ?? 0) + 0.25) * (cyc / nfr)) * 1000); // กลางช่วงเฟรมนิ่ง (ไม่ติดช่วงซ้อนภาพ)
  }

  if (pl.animal) { // 🐾 อัดแบบหยุดเวลาทีละเฟรม (ตรงเวลาเป๊ะ ไม่หลุดเฟรมแบบ screencast) · 25fps · ลูป = 2 รอบท่าพอดี → วนต่อกันเนียนโดยไม่ต้อง crossfade
    await send('Runtime.evaluate', { expression: run }, S);
    await sleep(300);
    const N = Math.round(loop * AFPS), out = [];
    for (let k = 0; k < N; k++) {
      await evalv(S, `window.__animalHold = ${(pl.s0 + (k * loop) / N) * 1000}; new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))`);
      const shot = await send('Page.captureScreenshot', { format: 'png' }, S);
      out.push(await toRaw(Buffer.from(shot.result.data, 'base64')));
    }
    await evalv(S, `window.__animalHold = ${pl.holdMs}; new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))`);
    const still = Buffer.from((await send('Page.captureScreenshot', { format: 'png' }, S)).result.data, 'base64');
    await send('Target.closeTarget', { targetId });
    const HQ = pl.animal.startsWith('real-');
    const anim = await sharp(Buffer.concat(out), { raw: { width: OW, height: OH * N, channels: 3, pageHeight: OH } })
      .webp({ quality: HQ ? 88 : 72, effort: 6, loop: 0, delay: Array(N).fill(Math.round((loop * 1000) / N)), smartSubsample: true, minSize: true, mixed: true }).toBuffer();
    const poster = await sharp(still).resize(OW, OH, { kernel: 'lanczos3' }).webp({ quality: HQ ? 92 : 72, effort: 6 }).toBuffer();
    writeFileSync(new URL(`${tp.id}.anim.webp`, OUT), anim);
    writeFileSync(new URL(`${tp.id}.webp`, OUT), poster);
    console.log(tp.id, `${N} เฟรม @${AFPS}fps (หยุดเวลา)`, Math.round(anim.length / 1024) + 'KB anim', Math.round(poster.length / 1024) + 'KB poster');
    continue;
  }

  // screencast: เก็บทุกเฟรมพร้อมเวลา (วินาที) นับจากตอนสั่งเล่น
  const frames = []; let t0 = 0;
  const onMsg = (m) => { if (m.method !== 'Page.screencastFrame' || m.sessionId !== S) return;
    const p = m.params; frames.push({ t: p.metadata.timestamp - t0, data: p.data }); send('Page.screencastFrameAck', { sessionId: p.sessionId }, S); };
  listeners.add(onMsg);
  await send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 }, S);
  await sleep(400);
  const { result: { result: { value: now } } } = await send('Runtime.evaluate', { expression: 'Date.now()/1000', returnByValue: true }, S);
  t0 = now; // timestamp ของ screencast = เวลา epoch (วินาที) ของหน้า
  frames.length = 0;
  await send('Runtime.evaluate', { expression: run }, S);
  const end = Math.max(pl.s0 + loop + XF, pl.poster) + 0.3;
  await sleep(end * 1000);
  await send('Page.stopScreencast', {}, S);
  listeners.delete(onMsg);
  let still = null;
  if (pl.holdMs != null) { // ภาพนิ่งสัตว์: หยุดเวลาไว้ที่เฟรมเต็ม แล้วถ่ายจอตรง ๆ (ไม่พึ่งเวลา screencast)
    await evalv(S, `window.__animalHold = ${pl.holdMs}; new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))`);
    await sleep(150);
    const shot = await send('Page.captureScreenshot', { format: 'png' }, S);
    still = Buffer.from(shot.result.data, 'base64');
  }
  await send('Target.closeTarget', { targetId });
  if (frames.length < 5) { console.log(tp.id, 'ไม่มีเฟรม — ข้าม'); continue; }

  // เลือกเฟรมล่าสุด ณ เวลา t (หน้านิ่ง = ไม่มีเฟรมใหม่ → ใช้เฟรมเดิม)
  const at = (t) => { let f = frames[0]; for (const x of frames) { if (x.t <= t) f = x; else break; } return Buffer.from(f.data, 'base64'); };
  const N = Math.round(loop * FPS), F = Math.round(XF * FPS), cache = new Map();
  const HQ = String(pl.animal ?? '').startsWith('real-'); // สัตว์จริง = ภาพถ่ายขนละเอียด → webp คุณภาพสูง (q≥90) ไม่งั้นขนเละ
  const raw = async (t) => { const k = Math.round(t * 1000); if (!cache.has(k)) cache.set(k, await toRaw(at(t))); return cache.get(k); };
  const out = [];
  for (let k = 0; k < N; k++) {
    const main = await raw(pl.s0 + (F + k) / FPS);
    if (k < N - F) { out.push(main); continue; }
    // ช่วงท้าย: ค่อย ๆ ผสมกลับไปหาต้นลูป → วนต่อเนื่องไม่สะดุด
    const w = (k - (N - F) + 1) / (F + 1), head = await raw(pl.s0 + (k - (N - F)) / FPS), mix = Buffer.alloc(main.length);
    for (let i = 0; i < main.length; i++) mix[i] = main[i] * (1 - w) + head[i] * w;
    out.push(mix);
  }
  const anim = await sharp(Buffer.concat(out), { raw: { width: OW, height: OH * N, channels: 3, pageHeight: OH } })
    .webp({ quality: HQ ? 90 : 58, effort: 6, loop: 0, delay: Array(N).fill(Math.round(1000 / FPS)), smartSubsample: true, minSize: true, mixed: true }).toBuffer();
  const poster = await sharp(still ?? at(pl.poster)).resize(OW, OH, { kernel: 'lanczos3' }).webp({ quality: HQ ? 92 : 72, effort: 6 }).toBuffer();
  writeFileSync(new URL(`${tp.id}.anim.webp`, OUT), anim);
  writeFileSync(new URL(`${tp.id}.webp`, OUT), poster);
  console.log(tp.id, `${frames.length} เฟรมดิบ → ${N} เฟรม`, Math.round(anim.length / 1024) + 'KB anim', Math.round(poster.length / 1024) + 'KB poster');
}
ws.close(); chrome.kill();
await sleep(500); try { rmSync(prof, { recursive: true, force: true }); } catch { /* ignore */ }
process.exit(0);
