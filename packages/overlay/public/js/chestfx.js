/* 🎁 กล่องสมบัติ / 💜 ถุงซูเปอร์แฟน — แอนิเมชันเปิดกล่องบน canvas (effect='chest' | 'bag', style '01'..'10')
 * สไปรต์: fx/chest/chest-NN-{closed,open}.webp · fx/bag/bag-NN-{closed,open}.webp (ปิด/เปิด ผืนผ้าใบเท่ากัน ฐานตรงกลางล่างตรงกันแล้ว)
 * ลำดับ: ตกจากบน + เด้ง (ยุบตอนแตะพื้น) → สั่น/โยกลุ้น + แสงเต้น → เปิด! (crossfade + ป๊อป + แสงพุ่ง + เหรียญ/เพชร/หัวใจกระเด็นตามแรงโน้มถ่วง + ประกาย)
 *        → ค้างโชว์ → จางออก (~6 วิ)
 * ทุกอย่างคำนวณจาก "เวลา" อย่างเดียว (อนุภาคใช้สูตรปิดของการเคลื่อนที่ + แรงต้านเชิงเส้น) → เฟรมเรตไหนก็เนียน และหยุดเวลาได้ (window.__chestHold = ms) ไว้อัดภาพตัวอย่าง
 * ใช้: VJLChestFx.play({ kind:'chest'|'bag', style:'01', caption:'...', volume:1 })
 */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const VER = window.VJL_VERSION ? '?v=' + window.VJL_VERSION : '';
  const STYLES = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];
  // ไทม์ไลน์ (ms)
  const T_LAND = 520, T_BOUNCE = 820, T_SHAKE0 = 900, T_OPEN = 1950, T_OUT = 5600, T_END = 6300;

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const easeOutBack = (x) => { const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  // สปริงหน่วง: ค่าเริ่ม 1 → แกว่งลงสู่ 0
  const spring = (t, w, z) => (t < 0 ? 0 : Math.exp(-z * t) * Math.cos(w * t));
  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ---- โหลดสไปรต์ ----
  const cache = {};
  function load(kind, style) {
    const key = kind + style;
    if (cache[key]) return cache[key];
    const one = (st) => new Promise((ok, no) => { const im = new Image(); im.decoding = 'async';
      im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => ok(im)); im.onerror = no;
      im.src = 'fx/' + kind + '/' + kind + '-' + style + '-' + st + '.webp' + VER; });
    return (cache[key] = Promise.all([one('closed'), one('open')]).catch((e) => { delete cache[key]; throw e; }));
  }

  // ---- ธีมสีต่อแบบ ----
  const GEMS = { ruby: ['#ff4d6d', '#b0103a', '#ffd0da'], sapph: ['#4d8bff', '#1b3fae', '#d0e2ff'], emer: ['#2fe39a', '#0b8a5a', '#cffff0'],
    ame: ['#b45cff', '#6a1bb8', '#f0d6ff'], pink: ['#ff6fc0', '#c2187c', '#ffd6f0'], cyan: ['#44f0ff', '#0a8fb0', '#d6fbff'], dia: ['#e8f6ff', '#8fb6d8', '#ffffff'] };
  const THEME = {
    chest: { light: ['255,236,170', '255,200,90'], gems: ['ruby', 'sapph', 'emer', 'ame', 'dia'], hearts: 0.08, coins: 0.5, conf: ['#ffd84d', '#ff8fc8', '#8fd8ff', '#b9a6f2', '#fff3c4'] },
    bag: { light: ['255,200,250', '214,120,255'], gems: ['ame', 'pink', 'ame', 'dia'], hearts: 0.4, coins: 0.28, conf: ['#ff8fe0', '#c58bff', '#ffd84d', '#ffffff', '#9fd8ff'] },
  };
  const STYLE_GEMS = { '01': ['pink', 'ruby', 'dia'], '03': ['ame', 'cyan', 'pink'], '04': ['sapph', 'ame', 'dia'], '05': ['pink', 'ruby'], '06': ['pink', 'cyan', 'emer'],
    '07': ['ruby', 'emer'], '08': ['cyan', 'dia', 'sapph'], '09': ['pink', 'ruby'], '10': ['ruby', 'dia', 'sapph'] };

  // ---- สไปรต์อนุภาค (วาดครั้งเดียว ความละเอียดสูง แล้วย่อ) ----
  const sprites = {};
  function mk(key, size, draw) {
    if (sprites[key]) return sprites[key];
    const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); draw(g, size); return (sprites[key] = c);
  }
  const coinSpr = () => mk('coin', 128, (g, s) => {
    const r = s / 2 - 4, cx = s / 2;
    let gr = g.createRadialGradient(cx - r * .35, cx - r * .4, r * .1, cx, cx, r);
    gr.addColorStop(0, '#fff6c2'); gr.addColorStop(.45, '#ffd23f'); gr.addColorStop(.85, '#e09a12'); gr.addColorStop(1, '#a8650a');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cx, r, 0, TAU); g.fill();
    g.lineWidth = r * .1; g.strokeStyle = 'rgba(160,95,10,.85)'; g.beginPath(); g.arc(cx, cx, r * .74, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(190,120,15,.75)'; g.font = 'bold ' + Math.round(r * .95) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', cx, cx + r * .05);
    g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.ellipse(cx - r * .38, cx - r * .45, r * .22, r * .1, -.7, 0, TAU); g.fill();
  });
  const gemSpr = (k) => mk('gem' + k, 128, (g, s) => {
    const [mid, dark, hi] = GEMS[k], c = s / 2, w = s * .44, top = s * .2, girdle = s * .4, bot = s * .9;
    const P = (pts, fill) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fillStyle = fill; g.fill(); };
    P([[c - w * .55, top], [c + w * .55, top], [c + w, girdle], [c, bot], [c - w, girdle]], dark);
    P([[c - w * .55, top], [c, top], [c - w * .3, girdle], [c - w, girdle]], hi);
    P([[c, top], [c + w * .55, top], [c + w, girdle], [c + w * .3, girdle]], mid);
    P([[c - w * .3, girdle], [c, top], [c + w * .3, girdle]], mid);
    P([[c - w, girdle], [c - w * .3, girdle], [c, bot]], mid);
    P([[c + w * .3, girdle], [c + w, girdle], [c, bot]], dark);
    P([[c - w * .3, girdle], [c + w * .3, girdle], [c, bot]], hi);
    g.globalAlpha = .9; g.fillStyle = '#fff'; g.beginPath(); g.ellipse(c - w * .35, top + s * .06, s * .07, s * .025, -.4, 0, TAU); g.fill();
  });
  const heartSpr = (col, hi) => mk('heart' + col, 128, (g, s) => {
    g.save(); g.translate(s / 2, s / 2 + 4); g.scale(s / 36, s / 36);
    g.beginPath(); g.moveTo(0, 12); g.bezierCurveTo(-26, -6, -10, -24, 0, -10); g.bezierCurveTo(10, -24, 26, -6, 0, 12); g.closePath();
    const gr = g.createLinearGradient(-12, -18, 12, 12); gr.addColorStop(0, hi); gr.addColorStop(1, col); g.fillStyle = gr; g.fill();
    g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.ellipse(-7, -9, 4, 2.2, -.6, 0, TAU); g.fill(); g.restore();
  });
  const sparkSpr = () => mk('spark', 96, (g, s) => {
    const c = s / 2, gr = g.createRadialGradient(c, c, 0, c, c, c); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,250,220,.6)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(c, 2); g.quadraticCurveTo(c + 4, c - 4, s - 2, c); g.quadraticCurveTo(c + 4, c + 4, c, s - 2); g.quadraticCurveTo(c - 4, c + 4, 2, c); g.quadraticCurveTo(c - 4, c - 4, c, 2); g.fill();
  });

  // ---- สร้างอนุภาคตอนเปิด (กำหนดล่วงหน้าทั้งหมดด้วย seed) ----
  function makeParticles(kind, style, seed) {
    const R = rng(seed), th = THEME[kind], gems = STYLE_GEMS[style] && kind === 'chest' ? STYLE_GEMS[style] : th.gems, out = [];
    const N = 46;
    for (let i = 0; i < N; i++) {
      const r = R(), type = r < th.coins ? 'coin' : r < th.coins + th.hearts ? 'heart' : 'gem';
      const delay = i < 30 ? R() * 120 : 150 + R() * 900;            // พุ่งพรวดแรก + ทยอยตาม
      const ang = -Math.PI / 2 + (R() - .5) * (kind === 'bag' ? 1.5 : 1.9);
      const sp = 2.1 + R() * 1.2;                                  // หน่วย = ความสูงกล่อง / วินาที
      out.push({ type, delay, vx: Math.cos(ang) * sp * (0.7 + R() * .5), vy: Math.sin(ang) * sp, sz: type === 'coin' ? .055 + R() * .03 : type === 'gem' ? .055 + R() * .035 : .055 + R() * .035,
        spin: (R() - .5) * 14, flip: 6 + R() * 10, ph: R() * TAU, gem: gems[Math.floor(R() * gems.length)], hcol: R() < .5 ? ['#ff4fa3', '#ffc2e2'] : ['#a855f7', '#e9c9ff'], ox: (R() - .5) * .35 });
    }
    for (let i = 0; i < 70; i++) // คอนเฟตติ + ประกาย
      out.push({ type: R() < .45 ? 'spark' : 'conf', delay: R() * 700, vx: (R() - .5) * 2.6, vy: -(1.6 + R() * 2.2), sz: .02 + R() * .025, spin: (R() - .5) * 18, flip: 5 + R() * 9, ph: R() * TAU,
        col: th.conf[Math.floor(R() * th.conf.length)], ox: (R() - .5) * .4 });
    return out;
  }
  // ตำแหน่งตามเวลา (แรงต้านเชิงเส้น k + แรงโน้มถ่วง G) — สูตรปิด ไม่ต้องจำสถานะ
  function pos(p, t, G, k) {
    const e = 1 - Math.exp(-k * t);
    return [p.vx * e / k, (p.vy - G / k) * e / k + G * t / k];
  }

  let live = 0;
  function run(o, imgs) {
    const kind = o.kind, style = o.style, closed = imgs[0], open = imgs[1], th = THEME[kind];
    const slot = live++;
    const seed = o.seed != null ? o.seed : (Date.now() ^ (slot * 7919));
    const parts = makeParticles(kind, style, seed);
    const cv = document.createElement('canvas'); cv.className = 'chestfx';
    cv.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:22';
    document.body.appendChild(cv);
    const g = cv.getContext('2d');
    let capEl = null;
    if (o.caption) { capEl = document.createElement('div'); capEl.className = 'chestcap ' + kind; capEl.textContent = o.caption; document.body.appendChild(capEl); }
    const iw = closed.naturalWidth, ih = closed.naturalHeight;
    let W = 0, H = 0, dpr = 1, h = 0, w = 0, bx = 0, by = 0;
    const size = () => {
      W = innerWidth; H = innerHeight; dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      h = Math.min(H * 0.38, W * 0.82 * ih / iw); w = h * iw / ih;               // สูง ~38% ของจอ แต่ไม่กว้างเกินจอแนวตั้ง
      const off = slot % 3 === 1 ? -1 : slot % 3 === 2 ? 1 : 0;
      bx = W / 2 + off * Math.min(W * .26, w * .7); by = H * 0.8;              // กลางค่อนล่าง
    };
    size(); addEventListener('resize', size);
    const vol = o.volume == null ? 1 : o.volume;
    const sfx = (n, v) => { if (window.VJLSfx && window.__chestHold == null) { try { VJLSfx.play(n, vol * (v || 1)); } catch (e) {} } };
    const cues = [[60, 'whoosh', .5], [T_LAND, 'pop', .8], [T_BOUNCE, 'pop', .5], [T_SHAKE0 + 100, 'drumroll', .6], [T_OPEN, kind === 'bag' ? 'magic' : 'kaching', 1], [T_OPEN + 120, 'tada', .7]];
    let cue = 0;
    const t0 = performance.now();

    function frame(now) {
      const t = window.__chestHold != null ? window.__chestHold : now - t0;
      if (t >= T_END) { cv.remove(); if (capEl) capEl.remove(); removeEventListener('resize', size); live = Math.max(0, live - 1); return; }
      while (cue < cues.length && t >= cues[cue][0]) { sfx(cues[cue][1], cues[cue][2]); cue++; }
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);

      // ---------- การเคลื่อนไหวของกล่อง ----------
      let y = 0, sx = 1, sy = 1, rot = 0, al = 1, pop = 1;
      if (t < T_LAND) { const x = t / T_LAND; y = -(1 - x * x) * (by + h * .2); al = smooth(x * 3); }          // ตกแบบเร่ง (แรงโน้มถ่วง)
      else if (t < T_BOUNCE) { const x = (t - T_LAND) / (T_BOUNCE - T_LAND); y = -4 * x * (1 - x) * h * .16; } // เด้งพาราโบลา
      // ยุบ-ยืดตอนแตะพื้น (สปริง)
      const sq = .2 * spring((t - T_LAND) / 1000, 34, 9) + .1 * spring((t - T_BOUNCE) / 1000, 34, 10);
      if (t >= T_LAND) { sy -= sq; sx += sq * .75; }
      if (t > T_LAND && t < T_BOUNCE) { const x = (t - T_LAND) / (T_BOUNCE - T_LAND); sy += .06 * Math.sin(Math.PI * x); sx -= .04 * Math.sin(Math.PI * x); }
      // ลุ้น: โยก + สั่นถี่ขึ้นเรื่อย ๆ + กระดึ๊บ
      let shakeAmt = 0;
      if (t >= T_SHAKE0 && t < T_OPEN) {
        const x = (t - T_SHAKE0) / (T_OPEN - T_SHAKE0), ts = (t - T_SHAKE0) / 1000;
        shakeAmt = x;
        const phase = TAU /* ความถี่เร่งขึ้นเรื่อย ๆ */ * (2.2 * ts + 3.5 * ts * ts * ts / Math.max(.001, ((T_OPEN - T_SHAKE0) / 1000) ** 2));
        rot = (2 + 7 * x) * Math.sin(phase) * Math.PI / 180;
        y += -Math.abs(Math.sin(phase * .5)) * h * .035 * x;              // กระดึ๊บเล็ก ๆ
        const pre = smooth((x - .82) / .18);                               // ยุบตัวเตรียมระเบิด
        sy -= .09 * pre; sx += .07 * pre; rot *= 1 - pre * .7;
      }
      // เปิด: ป๊อปขยายแบบสปริง
      const to = (t - T_OPEN) / 1000;
      if (to >= 0) { pop = 1 + .2 * spring(to, 18, 5.5) * (to < .05 ? to / .05 : 1); sy += .06 * spring(to, 22, 7); sx -= .04 * spring(to, 22, 7); }
      let outK = 0;
      if (t > T_OUT) { outK = easeInOut((t - T_OUT) / (T_END - T_OUT)); al *= 1 - outK; }
      const xo = to >= 0 ? smooth(to / .18) : 0;                           // crossfade ปิด→เปิด
      const s = pop * (1 - .15 * outK);
      const gx = bx, gy = by + y - outK * h * .06;

      // ---------- แสงข้างหลัง ----------
      const [lc1, lc2] = th.light;
      if (t >= T_LAND) {
        const pulse = t < T_OPEN ? shakeAmt * (.35 + .25 * Math.sin(t / 1000 * TAU * (2 + 4 * shakeAmt))) : 0;
        const burst = to >= 0 ? Math.max(0, 1 - to / 4.2) * (1 - outK) : 0;
        const gl = Math.max(pulse, .55 * burst + (to >= 0 ? .55 * spring(to, 0, 2.2) : 0));
        if (gl > .01) {
          const cy = gy - h * .55, R = h * (0.9 + .5 * gl);
          g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(1, gl) * al;
          const rg = g.createRadialGradient(gx, cy, 0, gx, cy, R);
          rg.addColorStop(0, 'rgba(' + lc1 + ',.95)'); rg.addColorStop(.35, 'rgba(' + lc2 + ',.45)'); rg.addColorStop(1, 'rgba(' + lc2 + ',0)');
          g.fillStyle = rg; g.beginPath(); g.arc(gx, cy, R, 0, TAU); g.fill(); g.restore();
        }
        // ลำแสงหมุน (แผ่ออกตอนเปิด)
        if (to >= 0 && burst > 0) {
          const cy = gy - h * .62, len = h * (1.0 + 1.6 * smooth(to / .5)), n = 14, spinA = to * .45;
          g.save(); g.globalCompositeOperation = 'lighter'; g.translate(gx, cy); g.rotate(spinA);
          for (let i = 0; i < n; i++) {
            const a = i / n * TAU, wd = (i % 2 ? .07 : .12);
            const lg = g.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
            lg.addColorStop(0, 'rgba(' + lc1 + ',' + (.55 * burst * al) + ')'); lg.addColorStop(1, 'rgba(' + lc2 + ',0)');
            g.fillStyle = lg; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, len, a - wd, a + wd); g.closePath(); g.fill();
          }
          g.restore();
          // วงแหวนช็อกเวฟ
          const rx = smooth(to / .6);
          if (rx < 1) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = (1 - rx) * .8 * al; g.strokeStyle = 'rgba(' + lc1 + ',1)'; g.lineWidth = h * .05 * (1 - rx) + 1;
            g.beginPath(); g.ellipse(gx, gy - h * .45, h * (.3 + 1.4 * rx), h * (.3 + 1.4 * rx) * .8, 0, 0, TAU); g.stroke(); g.restore(); }
        }
      }

      // ---------- เงาพื้น ----------
      if (t > T_LAND * .4) {
        const lift = Math.max(0, -y) / h;
        g.save(); g.globalAlpha = al * .3 * clamp(1 - lift * 1.2, 0, 1); g.translate(gx, by - h * .015); g.scale(1, .16);
        const rr = w * .4 * s * (1 - Math.min(.5, lift * .4)), rg = g.createRadialGradient(0, 0, 0, 0, 0, rr);
        rg.addColorStop(0, 'rgba(30,15,45,1)'); rg.addColorStop(1, 'rgba(30,15,45,0)'); g.fillStyle = rg; g.beginPath(); g.arc(0, 0, rr, 0, TAU); g.fill(); g.restore();
      }

      // ---------- ตัวกล่อง ----------
      g.save(); g.translate(gx, gy); g.rotate(rot); g.scale(s * sx, s * sy);
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      const aC = al * (1 - smooth((xo - .35) / .65)), aO = al * xo;
      if (aC > .003) { g.globalAlpha = aC; g.drawImage(closed, -w / 2, -h, w, h); }
      if (aO > .003) { g.globalAlpha = aO; g.drawImage(open, -w / 2, -h, w, h); }
      // แสงขาววาบตอนเปิด
      if (to >= 0 && to < .35) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = (1 - to / .35) * .55 * al; g.drawImage(open, -w / 2, -h, w, h); }
      g.restore();

      // ---------- อนุภาค ----------
      if (to >= 0) {
        const G = 5.2, K = 0.9;                                           // หน่วยความสูงกล่อง/วินาที²
        const ox = gx, oy = gy - h * .6;
        g.save();
        for (const p of parts) {
          const pt = to - p.delay / 1000; if (pt <= 0) continue;
          const life = p.type === 'spark' || p.type === 'conf' ? 2.6 : 3.6;
          if (pt > life) continue;
          const [px, py] = pos(p, pt, p.type === 'conf' ? G * .45 : p.type === 'spark' ? G * .25 : G, p.type === 'conf' ? K * 2.2 : K);
          const X = ox + (px + p.ox * Math.min(1, pt * 6)) * h, Y = oy + py * h;
          if (Y > H + 40) continue;
          const fa = al * smooth(pt / .08) * (1 - smooth((pt - (life - .6)) / .6));
          if (fa < .01) continue;
          const sz = p.sz * h * (p.type === 'spark' ? (1.3 + .5 * Math.sin(pt * 14 + p.ph)) : 1) * Math.min(1, .4 + pt * 5);
          g.setTransform(dpr, 0, 0, dpr, dpr * X, dpr * Y); g.globalAlpha = fa;
          if (p.type === 'coin') { g.rotate(p.spin * pt * .15); g.scale(Math.max(.12, Math.abs(Math.cos(p.ph + pt * p.flip))), 1); g.drawImage(coinSpr(), -sz, -sz, sz * 2, sz * 2); }
          else if (p.type === 'gem') { g.rotate(p.ph + p.spin * pt * .3); g.drawImage(gemSpr(p.gem), -sz, -sz, sz * 2, sz * 2); }
          else if (p.type === 'heart') { g.rotate(.4 * Math.sin(p.ph + pt * 5)); const hs = sz * (1 + .08 * Math.sin(pt * 12)); g.drawImage(heartSpr(p.hcol[0], p.hcol[1]), -hs, -hs, hs * 2, hs * 2); }
          else if (p.type === 'spark') { g.globalCompositeOperation = 'lighter'; g.rotate(p.ph + pt * 2); g.drawImage(sparkSpr(), -sz * 1.6, -sz * 1.6, sz * 3.2, sz * 3.2); g.globalCompositeOperation = 'source-over'; }
          else { g.rotate(p.ph + p.spin * pt * .4); g.scale(1, Math.cos(p.ph + pt * p.flip)); g.fillStyle = p.col; g.fillRect(-sz * .5, -sz * .9, sz, sz * 1.8); }
        }
        g.restore();
      }
      // ประกายระยิบรอบกล่องตอนลุ้น
      if (shakeAmt > 0) {
        const R2 = rng(seed + 99);
        g.save(); g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 8; i++) {
          const ph = R2() * TAU, sp = 3 + R2() * 4, a = Math.max(0, Math.sin(t / 1000 * sp + ph)) * shakeAmt * al;
          if (a < .02) continue;
          const X = gx + (R2() - .5) * w * 1.05, Y = gy - h * (.15 + R2() * .9), sz = h * (.03 + .03 * a);
          g.globalAlpha = a; g.drawImage(sparkSpr(), X - sz, Y - sz, sz * 2, sz * 2);
        }
        g.restore();
      }

      // ---------- ป้ายข้อความ ----------
      if (capEl) {
        const ct = clamp((t - 250) / 500, 0, 1), bump = to >= 0 ? .1 * spring(to, 20, 6) : 0;
        capEl.style.left = bx + 'px'; capEl.style.top = (by - h * 1.12 * (1 + (to >= 0 ? .08 : 0))) + 'px';
        capEl.style.opacity = String(Math.min(smooth(ct), al));
        capEl.style.transform = 'translate(-50%,-100%) scale(' + ((.7 + .3 * easeOutBack(ct)) * (1 + bump)) + ')';
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  const css = document.createElement('style');
  css.textContent = '.chestcap{position:fixed;left:50%;top:40%;transform:translate(-50%,-100%);pointer-events:none;z-index:23;width:max-content;max-width:min(88vw,900px);text-align:center;' +
    'font:700 min(3vh,5.4vw)/1.25 Mali,Itim,sans-serif;color:#fff;padding:.32em 1em;border-radius:1.2em;opacity:0;text-shadow:0 2px 0 rgba(120,60,0,.35);' +
    'background:linear-gradient(135deg,rgba(255,196,60,.95),rgba(255,120,170,.93));box-shadow:0 8px 24px rgba(150,80,40,.35),inset 0 0 0 2px rgba(255,255,255,.45)}' +
    '.chestcap.bag{text-shadow:0 2px 0 rgba(90,20,120,.4);background:linear-gradient(135deg,rgba(214,120,255,.95),rgba(255,110,190,.93));box-shadow:0 8px 24px rgba(110,40,160,.4),inset 0 0 0 2px rgba(255,255,255,.45)}';
  document.head.appendChild(css);

  function play(o) {
    const kind = o && o.kind === 'bag' ? 'bag' : 'chest';
    const style = STYLES.includes(String(o && o.style)) ? String(o.style) : '01';
    const opts = Object.assign({}, o, { kind, style });
    return load(kind, style).then((imgs) => run(opts, imgs));
  }
  window.VJLChestFx = { play, preload: (kind, style) => load(kind === 'bag' ? 'bag' : 'chest', STYLES.includes(style) ? style : '01').then(() => true), STYLES, DURATION: T_END, OPEN_AT: T_OPEN };
})();
