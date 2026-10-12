/*
 * PileDelivery — วิธี "ส่งของ" ของวิดเจ็ตกองทับกัน (pile.html) 20 แบบ
 *   ภาพประกอบอยู่ที่ pile/delivery/<ชื่อ>.webp (ตัดจาก docs/delivery/delivery-props.png ด้วย docs/delivery/slice.py)
 *
 * สำคัญ: ที่นี่ "แค่ภาพ" — การบันทึกของขวัญ (VJLCollect.record) ทำทันทีใน pile.html ไม่รอแอนิเมชัน
 *   ทุกชิ้นที่ส่งเข้ามา (deliver) ต้องถูก launch() ลงกองเสมอ: มีเพดานเวลา + ส่งเร็วขึ้นเมื่อคิวยาว + เกินคิวตกตรงทันที
 *
 * แบบ "ลอยมาทีละชิ้น" (carrier): parachute balloons claw ufo stork rocket hotair drone wand
 * แบบ "ฐานส่งของ" (station — โผล่มาเมื่อมีของ แล้วหลบไปเมื่อว่าง): pipe cloud slide cannon conveyor catapult chimney pinata vending rainbow truck
 */
(function () {
  const AR = { pipe: 209 / 217, parachute: 220 / 263, balloons: 199 / 286, claw: 194 / 263, ufo: 242 / 176, stork: 240 / 249, cloud: 227 / 199, rocket: 174 / 286,
    slide: 244 / 233, cannon: 220 / 244, conveyor: 241 / 158, hotair: 187 / 281, drone: 251 / 200, wand: 244 / 256, catapult: 235 / 236, chimney: 211 / 260,
    pinata: 205 / 293, vending: 221 / 299, rainbow: 251 / 195, truck: 237 / 253 };
  const CARRIERS = ['parachute', 'balloons', 'claw', 'ufo', 'stork', 'rocket', 'hotair', 'drone', 'wand'];
  const STATIONS = ['pipe', 'cloud', 'slide', 'cannon', 'conveyor', 'catapult', 'chimney', 'pinata', 'vending', 'rainbow', 'truck'];
  // ฝั่งปกติของฐาน (ตั้งค่า side = left/right เพื่อกลับด้าน)
  const NATURAL = { pipe: 'left', conveyor: 'left', cannon: 'left', chimney: 'left', truck: 'left', slide: 'right', catapult: 'right', vending: 'right' };
  const MODES = ['none'].concat(CARRIERS, STATIONS);

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const E = {
    inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    out: (t) => 1 - Math.pow(1 - t, 3),
    in: (t) => t * t * t,
    back: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  };
  const u01 = (t, a, d) => clamp((t - a) / d, 0, 1);
  const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

  const imgs = {};
  function img(n) { let im = imgs[n]; if (!im) { im = new Image(); im.decoding = 'async'; im.src = 'pile/delivery/' + n + '.webp'; imgs[n] = im; } return im; }
  const ready = (im) => im.complete && im.naturalWidth > 0;

  function create(o) {
    // o: { ctx, fx, mode, side, bounds() → {W,H,L,R,F}, launch(b,x,y,vx,vy,born), drawGift(b,x,y,rot,scale,alpha), surface(x,r) }
    const ctx = o.ctx, fx = o.fx;
    const mode = MODES.includes(o.mode) ? o.mode : 'none';
    if (mode === 'none') return { mode, active: false, deliver: (b) => fallback(b), update() {}, drawBack() {}, drawFront() {} };
    img(mode);
    const B = o.bounds;
    // ขนาดฐานของภาพประกอบ — ไม่ขยายเกินขนาดจริงของไฟล์มากนัก (ภาพคมกว่า)
    const S = () => { const b = B(); return clamp(Math.min(b.W, b.H) * 0.24, 100, 290); };
    const items = { carriers: [], station: null, effects: [] };
    const now = () => performance.now();

    function fallback(b) { const { L, R } = B(); o.launch(b, rnd(L + b.r, Math.max(L + b.r + 1, R - b.r)), -b.r - rnd(0, 80), 0, 0); }
    function tx(r) { const { L, R } = B(); return rnd(L + Math.max(r * 1.6, (R - L) * 0.12), R - Math.max(r * 1.6, (R - L) * 0.12)); }
    function puff(x, y, d, col) {
      fx.sparkle(x, y, d >= 1000 ? 26 : d >= 100 ? 14 : 6, d >= 100 ? '#ffe08a' : (col || '#fff6c2'));
      if (d >= 100) flash(x, y, d >= 1000 ? 1 : 0.55);
    }
    function flash(x, y, k) {
      items.effects.push({ t0: now(), dur: 520, draw(c, u) {
        const R = (40 + 120 * k) * (0.4 + 0.6 * E.out(u)), g = c.createRadialGradient(x, y, 0, x, y, R);
        g.addColorStop(0, `rgba(255,236,170,${0.75 * (1 - u)})`); g.addColorStop(1, 'rgba(255,220,140,0)');
        c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.beginPath(); c.arc(x, y, R, 0, 6.283); c.fill(); c.restore();
      } });
    }
    /** วาดภาพประกอบ n สูง h โดยจุดยึด (ax,ay) [สัดส่วน 0..1 ของภาพ] อยู่ที่ (x,y) */
    function put(n, x, y, h, ax, ay, a = 0, sx = 1, sy = 1, al = 1) {
      const im = img(n); if (!ready(im) || al <= 0) return;
      const w = h * AR[n];
      ctx.save(); ctx.globalAlpha *= al; ctx.translate(x, y); if (a) ctx.rotate(a); if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
      ctx.drawImage(im, -ax * w, -ay * h, w, h); ctx.restore();
    }
    /** ตำแหน่งบนจอของจุด (fx,fy) ในภาพ เมื่อภาพวาดด้วย put(n,x,y,h,ax,ay,a) */
    function at(n, x, y, h, ax, ay, a, fx_, fy_) { const w = h * AR[n]; const [dx, dy] = rot((fx_ - ax) * w, (fy_ - ay) * h, a || 0); return [x + dx, y + dy]; }
    function fade(n, x, y, h, ax, ay, a, kind) {
      items.effects.push({ t0: now(), dur: kind === 'pop' ? 220 : 650, draw(c, u) {
        if (kind === 'pop') put(n, x, y, h, ax, ay, a, 1 + 0.3 * u, 1 + 0.3 * u, 1 - u);
        else put(n, x, y - E.out(u) * h * 0.6, h, ax, ay, a + u * 0.5, 1 - 0.55 * u, 1 - 0.2 * u, 1 - u);
      } });
    }

    // ===================== แบบลอยมาทีละชิ้น =====================
    const C = {
      parachute: {
        make(c) { c.h = Math.max(S() * 0.62, c.b.r * 3.4); c.x0 = tx(c.b.r); c.v = B().H * rnd(0.17, 0.21) * c.spd; c.ph = rnd(0, 6.28); c.y0 = -c.h - 2 * c.b.r - 10; },
        pose(c, t) {
          const y = c.y0 + c.v * t, x = c.x0 + Math.sin(t * 1.6 + c.ph) * Math.min(34, B().W * 0.025), a = Math.cos(t * 1.6 + c.ph) * 0.12;
          const gl = c.h * 0.97 + c.b.r * 0.95; return { x, y, a, gx: x - Math.sin(a) * gl, gy: y + Math.cos(a) * gl };
        },
        update(c, t) {
          const p = this.pose(c, t);
          if (p.gy + c.b.r >= o.surface(p.gx, c.b.r) - 8 || t > 14) {
            o.launch(c.b, p.gx, p.gy, 0, c.v / 60); fade('parachute', p.x, p.y, c.h, 0.5, 0, p.a, 'fly'); fx.sparkle(p.x, p.y + c.h * 0.5, 6, '#fff'); puff(p.gx, p.gy, c.b.d); return true;
          }
        },
        draw(c, t) { const p = this.pose(c, t); o.drawGift(c.b, p.gx, p.gy, p.a * 0.6, 1, 1); put('parachute', p.x, p.y, c.h, 0.5, 0, p.a); },
      },
      balloons: {
        make(c) { c.h = Math.max(S() * 0.72, c.b.r * 3.6); c.x0 = tx(c.b.r); c.v = B().H * rnd(0.14, 0.17) * c.spd; c.ph = rnd(0, 6.28); c.y0 = -2 * c.b.r - 10; },
        pose(c, t) { const y = c.y0 + c.v * t + Math.sin(t * 2.2 + c.ph) * 4, x = c.x0 + Math.sin(t * 1.1 + c.ph) * Math.min(30, B().W * 0.02); return { x, y, a: Math.sin(t * 1.3 + c.ph) * 0.08, gx: x, gy: y + c.b.r * 0.95 }; },
        update(c, t) {
          const p = this.pose(c, t);
          if (p.gy + c.b.r >= o.surface(p.gx, c.b.r) - 55 || t > 14) {
            o.launch(c.b, p.gx, p.gy, 0, c.v / 60); fade('balloons', p.x, p.y, c.h, 0.53, 0.97, p.a, 'pop');
            const [bx, by] = at('balloons', p.x, p.y, c.h, 0.53, 0.97, p.a, 0.5, 0.3);
            fx.sparkle(bx, by, 14, '#ffd1ea'); fx.confetti(bx, by, 10); puff(p.gx, p.gy, c.b.d); return true;
          }
        },
        draw(c, t) { const p = this.pose(c, t); o.drawGift(c.b, p.gx, p.gy, p.a * 0.5, 1, 1); put('balloons', p.x, p.y, c.h, 0.53, 0.97, p.a); },
      },
      claw: {
        make(c) {
          const { H } = B(); c.h = Math.max(S() * 0.75, c.b.r * 3.3); c.x0 = tx(c.b.r);
          const gb = clamp(o.surface(c.x0, c.b.r) - 18, H * 0.25, H * 0.62); c.yT = gb - c.b.r - 0.8 * c.h; c.D = 0.55 + clamp((c.yT + c.h) / H, 0, 1) * 0.7;
        },
        pose(c, t) {
          const D = c.D / c.spd, up = -c.h - 30; let y, sx = 1;
          if (t < D) y = lerp(up, c.yT, E.inOut(t / D));
          else if (t < D + 0.55) { y = c.yT; sx = 1 + 0.12 * Math.sin(Math.PI * u01(t, D + 0.15, 0.4)); }
          else y = lerp(c.yT, up, E.in(u01(t, D + 0.55, 0.65)));
          return { x: c.x0 + (t < D ? Math.sin(t * 5) * 2 * (1 - t / D) : 0), y, sx, D };
        },
        update(c, t) {
          const p = this.pose(c, t);
          if (!c.rel && t >= p.D + 0.15) { c.rel = 1; o.launch(c.b, p.x, p.y + 0.8 * c.h, 0, 0.5); puff(p.x, p.y + 0.8 * c.h, c.b.d); }
          return c.rel && t > p.D + 1.25;
        },
        draw(c, t) {
          const p = this.pose(c, t);
          ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = '#b48a3c'; ctx.lineWidth = Math.max(3, c.h * 0.022); ctx.beginPath(); ctx.moveTo(p.x, -10); ctx.lineTo(p.x, p.y + 4); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,240,200,.85)'; ctx.lineWidth = Math.max(1, c.h * 0.008); ctx.beginPath(); ctx.moveTo(p.x - 1, -10); ctx.lineTo(p.x - 1, p.y + 4); ctx.stroke(); ctx.restore();
          if (!c.rel) o.drawGift(c.b, p.x, p.y + 0.8 * c.h, 0, 1, 1);
          put('claw', p.x, p.y, c.h, 0.5, 0, 0, p.sx, 1);
        },
      },
      ufo: {
        make(c) {
          const { W, H } = B(); c.h = Math.max(S() * 0.5, c.b.r * 1.9); c.x0 = tx(c.b.r); c.dir = Math.random() < 0.5 ? -1 : 1; c.hy = H * 0.05 + c.h * 0.5;
          c.gy = clamp(o.surface(c.x0, c.b.r) - c.b.r - 14, c.hy + c.h, H * 0.6); c.W = W;
        },
        pose(c, t) {
          const k = 1 / c.spd, A = 0.65 * k, BI = 0.25 * k, LW = 0.9 * k, BO = 0.25 * k, LV = 0.7 * k;
          let x = c.x0, y = c.hy, beam = 0, g = -1;
          if (t < A) { const u = t / A; x = c.x0 - c.dir * c.W * 0.25 * (1 - E.out(u)); y = lerp(-c.h, c.hy, E.back(u)); }
          else if (t < A + BI) beam = (t - A) / BI;
          else if (t < A + BI + LW) { beam = 1; g = E.inOut((t - A - BI) / LW); }
          else if (t < A + BI + LW + BO) beam = 1 - (t - A - BI - LW) / BO;
          else { const u = u01(t, A + BI + LW + BO, LV); x = c.x0 + c.dir * c.W * 0.3 * E.in(u); y = c.hy - (c.hy + c.h * 1.5) * E.in(u); }
          y += Math.sin(t * 3) * 3;
          return { x, y, beam, g, rel: t >= A + BI + LW, end: A + BI + LW + BO + LV };
        },
        update(c, t) {
          const p = this.pose(c, t);
          if (!c.rel && p.rel) { c.rel = 1; o.launch(c.b, p.x, c.gy, 0, 0.6); puff(p.x, c.gy, c.b.d, '#ffe3f4'); }
          if (p.beam > 0.5 && Math.random() < 0.3) fx.sparkle(p.x + rnd(-1, 1) * c.h * 0.4, rnd(p.y + c.h * 0.5, c.gy), 1, '#fff');
          return c.rel && t > p.end;
        },
        draw(c, t) {
          const p = this.pose(c, t), w = c.h * AR.ufo, y0 = p.y + c.h * 0.4, y1 = c.gy + c.b.r + 14;
          if (p.beam > 0) {
            const tw = w * 0.17, bw = w * 0.3 + c.b.r * 0.5, g = ctx.createLinearGradient(0, y0, 0, y1);
            g.addColorStop(0, `rgba(255,214,240,${0.7 * p.beam})`); g.addColorStop(0.6, `rgba(255,232,248,${0.32 * p.beam})`); g.addColorStop(1, `rgba(255,245,252,${0.06 * p.beam})`);
            ctx.save(); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(p.x - tw, y0); ctx.lineTo(p.x + tw, y0); ctx.lineTo(p.x + bw, y1); ctx.lineTo(p.x - bw, y1); ctx.closePath(); ctx.fill();
            ctx.globalAlpha = 0.5 * p.beam; ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.moveTo(p.x - tw * 0.4, y0); ctx.lineTo(p.x + tw * 0.4, y0); ctx.lineTo(p.x + bw * 0.4, y1); ctx.lineTo(p.x - bw * 0.4, y1); ctx.fill(); ctx.restore();
          }
          if (p.g >= 0 && !c.rel) o.drawGift(c.b, p.x, lerp(y0, c.gy, p.g), p.g * 3, 0.4 + 0.6 * p.g, 0.5 + 0.5 * p.g);
          put('ufo', p.x, p.y, c.h, 0.5, 0.5);
        },
      },
      stork: {
        make(c) {
          const { W, H } = B(); c.h = Math.max(S() * 0.62, c.b.r * 2.6); c.dir = Math.random() < 0.5 ? -1 : 1; c.x0 = tx(c.b.r); c.W = W; c.w = c.h * AR.stork;
          c.fy = clamp(o.surface(c.x0, c.b.r) - c.h * 1.3, H * 0.06 + c.h * 0.5, H * 0.3); c.xs = c.dir > 0 ? -c.w * 0.6 : W + c.w * 0.6; c.v = W * 0.27 * c.spd;
        },
        pose(c, t) { const x = c.xs + c.dir * c.v * t, y = c.fy + Math.sin(t * 5) * 5; return { x, y, bx: x + c.dir * 0.32 * c.w, by: y + 0.28 * c.h }; },
        update(c, t) {
          const p = this.pose(c, t), G = 1800;
          if (!c.drop && ((p.bx - c.x0) * c.dir >= 0 || t > 12)) { c.drop = { t, x: p.bx, y: p.by, vx: c.dir * c.v * 0.35 }; }
          if (c.drop && !c.rel) {
            const d = t - c.drop.t, bx = c.drop.x + c.drop.vx * d, by = c.drop.y + 0.5 * G * d * d;
            if (d > 0.34 || by + c.b.r >= o.surface(bx, c.b.r) - 6) {
              c.rel = 1; o.launch(c.b, bx, by, c.drop.vx / 60, G * d / 60, true); fx.sparkle(bx, by, 10, '#fff0f6'); puff(bx, by, c.b.d);
              const h = c.h, dir = c.dir; items.effects.push({ t0: now(), dur: 260, draw(cc, u) { bundle(bx, by, h, dir, 1 + 0.4 * u, 1 - u, 0); } });
            }
          }
          return c.rel && (c.dir > 0 ? p.x > c.W + c.w : p.x < -c.w);
        },
        draw(c, t) {
          const p = this.pose(c, t), im = img('stork'); if (!ready(im)) return;
          const w = c.w, h = c.h, nw = im.naturalWidth, nh = im.naturalHeight, flap = 1 + 0.04 * Math.sin(t * 11);
          ctx.save(); ctx.translate(p.x, p.y); ctx.scale(c.dir, flap);
          if (!c.drop) ctx.drawImage(im, -w / 2, -h / 2, w, h);
          else { // นกไม่มีห่อผ้า
            ctx.drawImage(im, 0, 0, nw * 0.62, nh, -w / 2, -h / 2, w * 0.62, h);
            ctx.drawImage(im, nw * 0.62, 0, nw * 0.38, nh * 0.48, -w / 2 + w * 0.62, -h / 2, w * 0.38, h * 0.48);
          }
          ctx.restore();
          if (c.drop && !c.rel) { const d = t - c.drop.t; bundle(c.drop.x + c.drop.vx * d, c.drop.y + 900 * d * d, h, c.dir, 1, 1, d * 2 * c.dir); }
        },
      },
      rocket: {
        make(c) {
          const { H } = B(); c.h = Math.max(S() * 0.95, c.b.r * 3.2); c.x0 = tx(c.b.r);
          c.hy = clamp(o.surface(c.x0, c.b.r) - c.b.r * 2.4 - c.h * 0.3, c.h * 0.72 + 8, H * 0.55);
        },
        pose(c, t) {
          const k = 1 / c.spd, D = 1.0 * k, HO = 0.4 * k, U = 0.8 * k; let y, sh = 0;
          if (t < D) y = lerp(-c.h * 0.35, c.hy, E.out(t / D));
          else if (t < D + HO) { y = c.hy; sh = Math.sin(t * 70) * 1.5; }
          else y = lerp(c.hy, -c.h * 1.3, E.in(u01(t, D + HO, U)));
          return { x: c.x0 + sh, y, rel: t >= D + 0.15, up: t >= D + HO, end: D + HO + U };
        },
        update(c, t) {
          const p = this.pose(c, t);
          if (!c.rel && p.rel) { c.rel = 1; const gy = p.y + c.h * 0.12 + c.b.r * 0.6; o.launch(c.b, p.x, gy, rnd(-1, 1), 3, true); fx.dust(p.x, p.y + c.h * 0.2, 8); puff(p.x, gy, c.b.d); }
          if (p.up && Math.random() < 0.7) fx.sparkle(p.x + rnd(-6, 6), p.y + c.h * 0.15, 1, '#ffe7a8');
          return c.rel && t > p.end;
        },
        draw(c, t) { const p = this.pose(c, t); put('rocket', p.x, p.y, c.h, 0.5, 0.72, 0, 1, 1 + 0.02 * Math.sin(t * 40)); },
      },
      hotair: {
        make(c) {
          const { H } = B(); c.h = Math.max(S() * 1.0, c.b.r * 3.8); c.x0 = tx(c.b.r); c.ph = rnd(0, 6.28);
          c.hy = clamp(o.surface(c.x0, c.b.r) - c.b.r * 2.2 - c.h * 0.2, c.h * 0.8 + 8, H * 0.55);
        },
        pose(c, t) {
          const k = 1 / c.spd, D = 1.6 * k, HO = 0.35 * k, U = 1.5 * k; let y;
          if (t < D) y = lerp(-c.h * 0.25, c.hy, E.out(t / D)); else if (t < D + HO) y = c.hy; else y = lerp(c.hy, -c.h * 0.25, E.in(u01(t, D + HO, U)));
          return { x: c.x0 + Math.sin(t * 0.9 + c.ph) * 14 + (t > D + HO ? E.in(u01(t, D + HO, U)) * 60 : 0), y: y + Math.sin(t * 2) * 3, a: Math.sin(t * 1.2 + c.ph) * 0.035, rel: t >= D + 0.15, end: D + HO + U };
        },
        update(c, t) {
          const p = this.pose(c, t);
          if (!c.rel && p.rel) { c.rel = 1; o.launch(c.b, p.x, p.y - c.b.r * 0.4, rnd(-2, 2), -5); fx.sparkle(p.x, p.y, 8, '#fff0f6'); puff(p.x, p.y - c.b.r * 0.4, c.b.d); }
          return c.rel && t > p.end;
        },
        draw(c, t) {
          const p = this.pose(c, t), im = img('hotair'); put('hotair', p.x, p.y, c.h, 0.5, 0.8, p.a);
          if (!c.rel && ready(im)) { // ของขวัญโผล่จากตะกร้า → วาดตะกร้าทับอีกชั้น
            o.drawGift(c.b, p.x, p.y - c.b.r * 0.35, p.a, 1, 1);
            const w = c.h * AR.hotair, nw = im.naturalWidth, nh = im.naturalHeight;
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.drawImage(im, 0, nh * 0.8, nw, nh * 0.2, -0.5 * w, 0, w, c.h * 0.2); ctx.restore();
          }
        },
      },
      drone: {
        make(c) {
          const { W, H } = B(); c.h = Math.max(S() * 0.55, c.b.r * 2.0); c.x0 = tx(c.b.r); c.dir = Math.random() < 0.5 ? -1 : 1; c.W = W;
          const gb = clamp(o.surface(c.x0, c.b.r) - 14, H * 0.3, H * 0.62); c.yd = gb - c.b.r * 1.85; c.xs = c.dir > 0 ? -c.h * 1.4 : W + c.h * 1.4; c.ys = H * 0.06;
        },
        pose(c, t) {
          const k = 1 / c.spd, A = 1.1 * k, HO = 0.3 * k, LV = 0.8 * k; let x, y, a = 0;
          if (t < A) { const u = E.inOut(t / A); x = lerp(c.xs, c.x0, u); y = lerp(c.ys, c.yd, u); a = c.dir * 0.14 * Math.sin(Math.PI * t / A); }
          else if (t < A + HO) { x = c.x0; y = c.yd; }
          else { const u = E.in(u01(t, A + HO, LV)); x = c.x0 + c.dir * c.W * 0.5 * u; y = lerp(c.yd, -c.h * 1.2, u); a = c.dir * 0.16 * u01(t, A + HO, 0.2); }
          return { x, y: y + Math.sin(t * 6) * 3, a, rel: t >= A + 0.12, end: A + HO + LV };
        },
        update(c, t) {
          const p = this.pose(c, t);
          if (!c.rel && p.rel) { c.rel = 1; o.launch(c.b, p.x, p.y + c.b.r * 0.85, 0, 0.8); puff(p.x, p.y + c.b.r * 0.85, c.b.d); }
          return c.rel && t > p.end;
        },
        draw(c, t) { const p = this.pose(c, t); if (!c.rel) o.drawGift(c.b, p.x - Math.sin(p.a) * c.b.r, p.y + c.b.r * 0.85, p.a, 1, 1); put('drone', p.x, p.y, c.h, 0.5, 0.98, p.a); },
      },
      wand: {
        make(c) {
          const { H } = B(); c.h = Math.max(S() * 0.7, c.b.r * 2.4); c.x0 = tx(c.b.r); c.ty = H * rnd(0.16, 0.28); c.a0 = -0.55; c.a1 = 0.18;
          const w = c.h * AR.wand, [vx, vy] = rot((0.62 - 0.27) * w, (0.18 - 0.95) * c.h, c.a1); c.px = c.x0 - vx; c.py = c.ty - vy;
        },
        pose(c, t) {
          const k = 1 / c.spd, AP = 0.25 * k, WV = 0.5 * k, ST = 0.2 * k, FO = 0.35 * k;
          const al = t < AP ? E.out(t / AP) : t < AP + WV + ST ? 1 : 1 - u01(t, AP + WV + ST, FO);
          const a = t < AP ? c.a0 : lerp(c.a0, c.a1, E.inOut(u01(t, AP, WV)));
          return { a, al, sc: 0.75 + 0.25 * Math.min(1, al * 2), rel: t >= AP + WV, end: AP + WV + ST + FO };
        },
        tip(c, a) { const w = c.h * AR.wand, [dx, dy] = rot((0.62 - 0.27) * w, (0.18 - 0.95) * c.h, a); return [c.px + dx, c.py + dy]; },
        update(c, t) {
          const p = this.pose(c, t), [x, y] = this.tip(c, p.a);
          if (!p.rel && p.al > 0.6 && Math.random() < 0.8) fx.sparkle(x, y, 1, Math.random() < 0.5 ? '#ffe08a' : '#ffc2e2');
          if (!c.rel && p.rel) { c.rel = 1; o.launch(c.b, x, y + c.b.r * 0.6, 0, 0.5, true); fx.sparkle(x, y, 14, '#fff3b0'); puff(x, y, c.b.d); }
          return c.rel && t > p.end;
        },
        draw(c, t) { const p = this.pose(c, t); put('wand', c.px, c.py, c.h * p.sc, 0.27, 0.95, p.a, 1, 1, p.al); },
      },
    };
    function bundle(x, y, h, dir, sc, al, a) {
      const im = img('stork'); if (!ready(im)) return;
      const nw = im.naturalWidth, nh = im.naturalHeight, w = h * AR.stork, bw = w * 0.38 * sc, bh = h * 0.52 * sc;
      ctx.save(); ctx.globalAlpha *= al; ctx.translate(x, y); ctx.rotate(a); ctx.scale(dir, 1);
      ctx.drawImage(im, nw * 0.62, nh * 0.48, nw * 0.38, nh * 0.52, -bw * 0.53, -bh * 0.54, bw, bh); ctx.restore();
    }

    // ===================== ฐานส่งของ =====================
    const IN = 520, OUT = 520, IDLE = 2600;
    const mirror = (() => { const nat = NATURAL[mode]; return !!nat && (o.side === 'left' || o.side === 'right') && o.side !== nat; })();
    const MX = (x) => { if (!mirror) return x; const { L, R } = B(); return L + R - x; };
    const sLaunch = (b, x, y, vx, vy, born) => o.launch(b, MX(x), y, mirror ? -vx : vx, vy, born);
    const sFx = (fn, x, ...a) => fn.call(fx, MX(x), ...a);
    const sPuff = (x, y, d, col) => puff(MX(x), y, d, col);
    const kick = (s, dt, amp, dec = 140, hz = 0.045) => (s.kick ? amp * Math.exp(-dt / dec) * Math.cos(dt * hz) : 0);
    // ระยะยิงโค้งให้ตกที่ระยะ D (หน่วย px ต่อเฟรมฟิสิกส์ 60Hz, g = 0.5) — เผื่อแรงต้านอากาศ
    const shot = (D, deg) => { const th = deg * Math.PI / 180, v = Math.sqrt(Math.abs(D) * 0.5 / Math.sin(2 * th)) * 1.13; return [Math.sign(D) * v * Math.cos(th), -v * Math.sin(th)]; };

    const ST = {
      pipe: {
        gap: 150,
        geo(s) { const { L, H } = B(), h = S() * 1.05, w = h * AR.pipe, x = L - 4 - w * 0.9 * (1 - E.out(s.e)), y = H * 0.03; return { h, w, x, y, mx: x + 0.74 * w, my: y + 0.85 * h }; },
        fire(s, b, t) { const g = this.geo(s); sLaunch(b, g.mx, g.my - b.r * 0.2, rnd(0.6, 3.6), 2.6, true); s.kick = t; sFx(fx.dust, g.mx, g.my, 3); sPuff(g.mx, g.my, b.d); },
        draw(s, t) {
          const g = this.geo(s), k = kick(s, t - s.kick, 1, 110, 0.05);
          ctx.save(); ctx.translate(g.mx, g.my); ctx.scale(1 + 0.07 * k, 1 - 0.06 * k); ctx.translate(-g.mx, -g.my); put('pipe', g.x, g.y, g.h, 0, 0); ctx.restore();
        },
      },
      cloud: {
        gap: 140, front: true,
        init(s) { const { L, R } = B(), w = S() * 0.85 * AR.cloud; s.cx = rnd(L + w * 0.6, Math.max(L + w * 0.6 + 1, R - w * 0.6)); },
        geo(s, t) { const { H } = B(), h = S() * 0.85, w = h * AR.cloud, e = E.out(s.e); return { h, w, x: s.cx + Math.sin(t / 2500) * 20, y: H * 0.04 + h * 0.5 - (1 - e) * h * 0.4 + Math.sin(t / 700) * 4, sc: 0.8 + 0.2 * e, al: s.e }; },
        fire(s, b, t) { const g = this.geo(s, t); const x = g.x + rnd(-0.27, 0.27) * g.w, y = g.y + g.h * 0.2; sLaunch(b, x, y, rnd(-0.4, 0.4), 1.4, true); sFx(fx.sparkle, x, y, 2, '#cfe8ff'); sPuff(x, y, b.d, '#e6f4ff'); },
        draw(s, t) { const g = this.geo(s, t); put('cloud', g.x, g.y, g.h, 0.5, 0.5, 0, g.sc, g.sc * (1 + 0.02 * Math.sin(t / 300)), g.al); },
      },
      slide: {
        gap: 300,
        geo(s) { const { R, F } = B(), h = S() * 1.1, w = h * AR.slide, x = R - 6, y = F + h * 0.9 * (1 - E.out(s.e)); const P = (fx_, fy_) => [x + (fx_ - 1) * w, y + (fy_ - 1) * h]; return { h, x, y, top: P(0.52, 0.24), bot: P(0.11, 0.84) }; },
        fire(s, b, t) { s.items.push({ b, t0: t }); },
        item(s, it, t) {
          const g = this.geo(s), d = (t - it.t0) / 1000, ds = 0.6 / s.spd;
          const u = E.in(u01(d, 0.12, ds)) * 0.8 + u01(d, 0.12, ds) * 0.2, [x0, y0] = g.top, [x1, y1] = g.bot;
          const len = Math.hypot(x1 - x0, y1 - y0), nx = (y1 - y0) / len, ny = -(x1 - x0) / len; // ตั้งฉากขึ้นด้านบน
          const side = ny > 0 ? -1 : 1; it.x = lerp(x0, x1, u) + nx * side * it.b.r * 0.7; it.y = lerp(y0, y1, u) + ny * side * it.b.r * 0.7; it.a = -u * len / it.b.r;
          if (d >= 0.12 + ds) { const v = 7; sLaunch(it.b, it.x, it.y, (x1 - x0) / len * v, (y1 - y0) / len * v); return true; }
        },
        drawItem(s, it, t) { if (it.x != null) o.drawGift(it.b, it.x, it.y, it.a, Math.min(1, 0.4 + (t - it.t0) / 200), 1); },
        draw(s) { const g = this.geo(s); put('slide', g.x, g.y, g.h, 1, 1, 0, 1, 1, Math.min(1, s.e * 1.5)); },
      },
      cannon: {
        gap: 420,
        geo(s, t) { const { L, F } = B(), h = S() * 0.9, w = h * AR.cannon, k = kick(s, t - s.kick, 1, 120, 0.04); const x = L + 6 - (w + 20) * (1 - E.out(s.e)) - 10 * Math.max(0, k); return { h, w, x, y: F, mx: x + 0.8 * w, my: F - (1 - 0.13) * h, k }; },
        fire(s, b, t) {
          const { L, R } = B(), g = this.geo(s, t), tx_ = rnd(L + (R - L) * 0.35, R - b.r - 10), [vx, vy] = shot(tx_ - g.mx, 55);
          sLaunch(b, g.mx, g.my, vx, vy, true); s.kick = t; sFx(fx.sparkle, g.mx, g.my, 8, '#fff3c4'); sFx(fx.dust, g.mx, g.my, 6); sPuff(g.mx, g.my, b.d); if (b.d >= 100) sFx(fx.confetti, g.mx, g.my, 14);
        },
        draw(s, t) { const g = this.geo(s, t); put('cannon', g.x, g.y, g.h, 0, 1, 0, 1 - 0.05 * Math.max(0, g.k), 1 + 0.04 * Math.max(0, g.k), Math.min(1, s.e * 2)); },
      },
      conveyor: {
        gap: 260,
        geo(s) { const { L, H } = B(), h = S() * 0.55, w = h * AR.conveyor, x = L - w * 0.06 - (w + 10) * (1 - E.out(s.e)), y = H * 0.36; const P = (fx_, fy_) => [x + fx_ * w, y + fy_ * h]; return { h, x, y, a: P(0.1, 0.33), b: P(0.9, 0.17) }; },
        fire(s, b, t) { s.items.push({ b, t0: t }); },
        item(s, it, t) {
          const g = this.geo(s), d = (t - it.t0) / 1000, dur = 1.0 / s.spd, u = clamp(d / dur, 0, 1);
          it.x = lerp(g.a[0], g.b[0], u); it.y = lerp(g.a[1], g.b[1], u) - it.b.r * 0.85 + Math.sin(d * 25) * 0.6;
          if (u >= 1) { sLaunch(it.b, it.x, it.y, 3.6, -0.6); return true; }
        },
        drawItem(s, it, t) { if (it.x != null) o.drawGift(it.b, it.x, it.y, 0, Math.min(1, 0.4 + (t - it.t0) / 200), 1); },
        draw(s, t) {
          const g = this.geo(s); put('conveyor', g.x, g.y, g.h, 0, 0);
          // ลายสายพานวิ่ง
          if (s.e > 0.5) { ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2; const n = 7, ph = (t / 900) % 1;
            for (let i = 0; i < n; i++) { const u = (i + ph) / n, x = lerp(g.a[0], g.b[0], u), y = lerp(g.a[1], g.b[1], u); ctx.beginPath(); ctx.moveTo(x - 3, y - g.h * 0.1); ctx.lineTo(x + 3, y + g.h * 0.1); ctx.stroke(); }
            ctx.restore(); }
        },
      },
      catapult: {
        gap: 480,
        geo(s, t) { const { R, F } = B(), h = S() * 0.95, w = h * AR.catapult, x = R - 6 + (w + 20) * (1 - E.out(s.e)); const a = s.fling ? -0.13 * Math.exp(-(t - s.fling) / 260) * Math.cos((t - s.fling) * 0.02) : 0; return { h, w, x, y: F, a, sp: at('catapult', x, F, h, 1, 1, a, 0.83, 0.1) }; },
        fire(s, b, t) { s.items.push({ b, t0: t }); },
        item(s, it, t) {
          const g = this.geo(s, t), d = t - it.t0, load = 220 / s.spd;
          it.x = g.sp[0]; it.y = g.sp[1] - it.b.r * 0.45;
          if (d >= load) { const { L, R } = B(), tx_ = rnd(L + it.b.r + 10, L + (R - L) * 0.6), [vx, vy] = shot(tx_ - it.x, 62); s.fling = t; sLaunch(it.b, it.x, it.y, vx, vy); sFx(fx.sparkle, it.x, it.y, 6, '#ffe7a8'); sPuff(it.x, it.y, it.b.d); return true; }
        },
        drawItem(s, it, t) { if (it.x != null) o.drawGift(it.b, it.x, it.y, 0, Math.min(1, 0.3 + (t - it.t0) / 180), 1); },
        draw(s, t) { const g = this.geo(s, t); put('catapult', g.x, g.y, g.h, 1, 1, g.a); },
      },
      chimney: {
        gap: 320,
        geo(s, t) { const { L, F } = B(), h = S() * 0.95, w = h * AR.chimney, y = F + h * 0.95 * (1 - E.out(s.e)), x = L + 10, k = kick(s, t - s.kick, 1, 120, 0.05); return { h, w, x, y, tx: x + 0.5 * w, ty: y - 0.92 * h, k }; },
        fire(s, b, t) {
          const g = this.geo(s, t); s.kick = t; sLaunch(b, g.tx, g.ty + b.r * 0.2, rnd(1.6, 4.6), rnd(-12, -8.5), true);
          for (let i = 0; i < 3; i++) smoke(MX(g.tx + rnd(-10, 10)), g.ty - 4, g.w * rnd(0.12, 0.2));
          sPuff(g.tx, g.ty, b.d);
        },
        draw(s, t) { const g = this.geo(s, t); ctx.save(); ctx.translate(g.x, g.y); ctx.scale(1 + 0.04 * g.k, 1 - 0.05 * g.k); put('chimney', 0, 0, g.h, 0, 1); ctx.restore(); },
      },
      pinata: {
        gap: 260,
        init(s) { const { L, R } = B(); s.cx = lerp(L, R, rnd(0.38, 0.62)); },
        geo(s, t) {
          const { H } = B(), h = S() * 1.0, y = H * 0.02 - (h + H * 0.05) * (1 - E.back(s.e));
          const a = Math.sin(t / 600) * 0.06 + (s.kick ? 0.28 * Math.exp(-(t - s.kick) / 320) * Math.sin((t - s.kick) * 0.03) * s.kdir : 0);
          return { h, x: s.cx, y, a, c: at('pinata', s.cx, y, h, 0.5, 0, a, 0.5, 0.62) };
        },
        fire(s, b, t) {
          const g = this.geo(s, t); s.kick = t; s.kdir = Math.random() < 0.5 ? -1 : 1; const [x, y] = g.c;
          sLaunch(b, x, y, rnd(-5, 5), rnd(-6, -1), true); sFx(fx.confetti, x, y, b.d >= 100 ? 26 : 8); sPuff(x, y, b.d);
        },
        draw(s, t) {
          const g = this.geo(s, t); ctx.save(); ctx.strokeStyle = '#d9b25c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(g.x, -10); ctx.lineTo(g.x, g.y + 2); ctx.stroke(); ctx.restore();
          put('pinata', g.x, g.y, g.h, 0.5, 0, g.a);
        },
      },
      vending: {
        gap: 340,
        geo(s, t) { const { R, F } = B(), h = S() * 1.1, w = h * AR.vending, x = R - 6 + (w + 20) * (1 - E.out(s.e)) + (s.kick && t - s.kick < 160 ? Math.sin((t - s.kick) * 0.25) * 3 : 0); return { h, w, x, y: F, sx: x + (0.33 - 1) * w, sy: F + (0.8 - 1) * h }; },
        fire(s, b, t) { const g = this.geo(s, t); s.kick = t; sLaunch(b, g.sx, g.sy, rnd(-5.5, -3), rnd(-4.5, -2), true); sFx(fx.sparkle, g.sx, g.sy, 5, '#ffd1ea'); sPuff(g.sx, g.sy, b.d); },
        draw(s, t) { const g = this.geo(s, t); put('vending', g.x, g.y, g.h, 1, 1); },
      },
      rainbow: {
        gap: 280,
        geo(s) { const { L, R, H } = B(), w = Math.min((R - L) * 0.62, S() * 2.1), h = w / AR.rainbow; return { w, h, x: (L + R) / 2, y: H * 0.15 }; },
        fire(s, b, t) { s.dir = -(s.dir || -1); s.items.push({ b, t0: t, dir: s.dir }); },
        item(s, it, t) {
          const g = this.geo(s), d = (t - it.t0) / 1000, dur = 1.25 / s.spd, u = E.inOut(clamp(d / dur, 0, 1));
          const a = it.dir > 0 ? lerp(Math.PI, 2 * Math.PI, u) : lerp(2 * Math.PI, Math.PI, u), rx = 0.43 * g.w, ry = 0.58 * g.h, cx = g.x, cy = g.y + 0.62 * g.h;
          let nx = Math.cos(a) / rx, ny = Math.sin(a) / ry; const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
          it.x = cx + rx * Math.cos(a) + nx * it.b.r * 0.75; it.y = cy + ry * Math.sin(a) + ny * it.b.r * 0.75; it.a = u * 6 * it.dir;
          if (d >= dur) { sLaunch(it.b, it.x, it.y, it.dir * 2.2, 2.5); sFx(fx.sparkle, it.x, it.y, 4, '#fff'); return true; }
          if (Math.random() < 0.25) sFx(fx.sparkle, it.x, it.y, 1, ['#ffc2e2', '#fff3b0', '#c8f3e6', '#cfe0ff'][(Math.random() * 4) | 0]);
        },
        drawItem(s, it, t) { if (it.x != null) o.drawGift(it.b, it.x, it.y, it.a, Math.min(1, 0.4 + (t - it.t0) / 220), 1); },
        draw(s) { // ค่อย ๆ วาดสายรุ้งจากซ้ายไปขวา
          const g = this.geo(s), e = E.out(s.e); ctx.save(); ctx.beginPath(); ctx.rect(g.x - g.w / 2 - 2, g.y - 4, (g.w + 4) * e, g.h + 8); ctx.clip(); put('rainbow', g.x, g.y, g.h, 0.5, 0, 0, 1, 1, Math.min(1, s.e * 1.4)); ctx.restore();
        },
      },
      truck: {
        gap: 150,
        geo(s, t) {
          const { L, F } = B(), h = S() * 0.9, w = h * AR.truck, e = E.out(s.e), x = L + 6 - (w + 30) * (1 - e), moving = s.e < 1 ? Math.sin(t / 30) * 1.2 : 0;
          s.tilt = lerp(s.tilt || 0, (s.q.length || s.items.length || t - s.last < 500) && s.ph === 'on' ? 1 : 0, 0.08);
          const a = 0.12 * s.tilt, piv = [x + 0.8 * w, F - 0.12 * h];
          const P = (fx_, fy_) => { const [dx, dy] = rot(x + fx_ * w - piv[0], F - (1 - fy_) * h - piv[1], a); return [piv[0] + dx, piv[1] + dy]; };
          return { h, w, x, y: F + moving, a, piv, back: P(0.93, 0.3) };
        },
        fire(s, b, t) { const g = this.geo(s, t); sLaunch(b, g.back[0], g.back[1], rnd(2.5, 5), rnd(-2, 0.5), true); sPuff(g.back[0], g.back[1], b.d); },
        draw(s, t) { const g = this.geo(s, t); ctx.save(); ctx.translate(g.piv[0], g.piv[1]); ctx.rotate(g.a); ctx.translate(-g.piv[0], -g.piv[1]); put('truck', g.x, g.y, g.h, 0, 1); ctx.restore(); },
      },
    };
    function smoke(x, y, R) {
      const dx = rnd(-0.4, 0.4) * R;
      items.effects.push({ t0: now(), dur: 900, draw(c, u) {
        const r = R * (0.6 + 1.2 * E.out(u)), yy = y - u * R * 3.2, g = c.createRadialGradient(x + dx * u, yy, 0, x + dx * u, yy, r);
        g.addColorStop(0, `rgba(255,255,255,${0.75 * (1 - u)})`); g.addColorStop(1, 'rgba(255,240,250,0)');
        c.save(); c.fillStyle = g; c.beginPath(); c.arc(x + dx * u, yy, r, 0, 6.283); c.fill(); c.restore();
      } });
    }

    function ensureStation(t) {
      let s = items.station;
      if (!s) { s = items.station = { ph: 'in', t0: t, q: [], items: [], next: 0, last: t, e: 0, spd: 1 }; if (ST[mode].init) ST[mode].init(s); }
      else if (s.ph === 'out') { const p = clamp((t - s.t0) / OUT, 0, 1); s.ph = 'in'; s.t0 = t - (1 - p) * IN; }
      return s;
    }

    function deliver(b) {
      const t = now();
      if (C[mode]) {
        if (items.carriers.length >= 12) return fallback(b); // คอมโบหนัก → ตกตรงทันที ไม่ต่อคิว
        const c = { b, t0: t, spd: 1 + items.carriers.length * 0.09 }; C[mode].make(c); items.carriers.push(c); return;
      }
      const s = ensureStation(t);
      if (s.q.length >= 90) return fallback(b);
      s.q.push(b);
    }

    function update(t) {
      for (let i = items.carriers.length - 1; i >= 0; i--) {
        const c = items.carriers[i];
        let done = false; try { done = C[mode].update(c, (t - c.t0) / 1000); } catch (err) { done = true; }
        if (done) { items.carriers.splice(i, 1); if (!c.rel && !c.b.__in) { c.rel = 1; fallback(c.b); } } // กันพลาด: ไม่มีวันหาย
        else if (t - c.t0 > 20000) { items.carriers.splice(i, 1); if (!c.rel) fallback(c.b); }
      }
      const s = items.station; if (!s) return;
      const D = ST[mode];
      if (s.ph === 'in') { s.e = clamp((t - s.t0) / IN, 0, 1); if (s.e >= 1) { s.ph = 'on'; s.next = Math.max(s.next, t); } }
      else if (s.ph === 'out') s.e = 1 - clamp((t - s.t0) / OUT, 0, 1);
      if (s.ph === 'on') {
        s.spd = 1 + Math.min(3, s.q.length / 6);
        let guard = 0;
        while (s.q.length && t >= s.next && guard++ < 12) { const b = s.q.shift(); D.fire(s, b, t); s.last = t; s.next = Math.max(s.next, t - 120) + Math.max(28, D.gap / (1 + s.q.length / 4)); }
        if (!s.q.length && !s.items.length && t - s.last > IDLE) { s.ph = 'out'; s.t0 = t; }
      }
      for (let i = s.items.length - 1; i >= 0; i--) {
        const it = s.items[i];
        if (D.item(s, it, t) || t - it.t0 > 8000) { s.items.splice(i, 1); if (!it.b.__in) fallback(it.b); }
      }
      if (s.ph === 'out' && s.e <= 0) { s.q.forEach(fallback); s.items.forEach((it) => { if (!it.b.__in) fallback(it.b); }); items.station = null; }
    }

    function withMirror(fn) { if (!mirror) return fn(); const { L, R } = B(); ctx.save(); ctx.translate(L + R, 0); ctx.scale(-1, 1); fn(); ctx.restore(); }
    function drawStation(t, front) {
      const s = items.station; if (!s || !!ST[mode].front !== front) return;
      withMirror(() => { ST[mode].draw(s, t); if (ST[mode].drawItem) s.items.forEach((it) => ST[mode].drawItem(s, it, t)); });
    }
    return {
      mode, active: true, deliver, update,
      /** วาดก่อนกอง (ฐานที่ตั้งบนพื้น/ท่อ — ของที่ออกมาอยู่หน้าฐาน) */
      drawBack(t) { drawStation(t, false); },
      /** วาดหลังกอง (ตัวที่ลอยมา เมฆ เอฟเฟกต์) */
      drawFront(t) {
        drawStation(t, true);
        for (const c of items.carriers) C[mode].draw(c, (t - c.t0) / 1000);
        for (let i = items.effects.length - 1; i >= 0; i--) { const f = items.effects[i], u = (t - f.t0) / f.dur; if (u >= 1) { items.effects.splice(i, 1); continue; } f.draw(ctx, Math.max(0, u)); }
      },
    };
  }

  window.PileDelivery = { create, MODES, CARRIERS, STATIONS };
})();
