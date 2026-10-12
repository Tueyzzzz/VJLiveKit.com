/*
 * รถลากของขวัญ — มุมข้าง (รถวิ่งไปทางขวา) · เรียกจาก dragcar.html เมื่อ car ขึ้นต้นด้วย "sc-" (เช่น sc-pastel)
 * ภาพรถ GPT: sidecar/<ชื่อ>.webp · ตำแหน่งล้อ/ตะขอ/จุดผูกลูกโป่ง: sidecar/cars.json (สัดส่วนของภาพ)
 *   ของแพง (≥ balloonMin) = ลูกโป่งผูกเชือกจากหลังคา ปลิวไปด้านหลังตามลม · ของถูก = กระป๋องลากบนถนนท้ายรถ เด้งตามหลุม
 *   ล้อหมุนจริง (หมุนเฉพาะวงล้อในภาพ) · ถนนเลื่อน · รถโยกตามโช้ค
 * ของขวัญไม่หาย: กองกลาง VJLCollect + คีย์เดียวกับรถลากแบบเดิม (สลับแบบได้)
 */
(function () {
  window.VJLSideCar = { start };

  function start(P, num) {
    const NAME = String(P('car', 'sc-pastel')).slice(3);
    const SCALE = num('scale', 1), GIFT_SCALE = num('giftScale', 1), OX = num('x', 0), OY = num('y', 0);
    const SHOW_ALERT = P('alert', '1') !== '0', MIN_COINS = num('minCoins', 0), SHOT = P('shot', '0') === '1';
    const MAX = Math.round(Math.max(30, Math.min(400, num('max', 140) / (GIFT_SCALE * GIFT_SCALE))));
    const MODE = ['mix', 'balloon', 'drag'].includes(P('mode', 'mix')) ? P('mode', 'mix') : 'mix', BAL_MIN = num('balloonMin', 100);
    const kindOf = (g) => (MODE === 'balloon' ? 'b' : MODE === 'drag' ? 'd' : (g.d || 0) >= BAL_MIN ? 'b' : 'd');
    const ROAD = P('road', '1') !== '0', SPEED = Math.max(0, Math.min(3, num('speed', 1)));

    const canvas = document.getElementById('fx'), ctx = canvas.getContext('2d');
    const DPR = Math.min(2, devicePixelRatio || 1);
    let W = 0, H = 0, s = 1;
    const carSkin = Juice.skin('sidecar/' + NAME + '.webp', num('hue', 0), num('sat', 1), num('bright', 1)); // เปลี่ยนสีรถได้เหมือนแบบเดิม
    let META = { w: 1300, h: 700, wheels: [[0.22, 0.82, 0.13], [0.8, 0.82, 0.13]], hook: [0.02, 0.7], tie: [0.42, 0.08] };
    fetch('sidecar/cars.json?v=' + (window.VJL_VERSION || '1')).then((r) => r.json()).then((m) => { if (m[NAME]) { META = { ...META, ...m[NAME] }; resize(); } }).catch(() => {});

    // ---- ผัง: รถค่อนไปทางขวา (ของลากยาวไปทางซ้าย) · พื้นถนนชิดล่าง ----
    let C = { x: 0, y: 0, w: 0, h: 0 }, GROUND = 0;
    function resize() {
      W = innerWidth; H = innerHeight; s = SCALE * Math.min(1.6, Math.max(0.5, H / 720));
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR); canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      const ck = Math.max(0.5, Math.min(1.4, num('carScale', 1)));
      const cw = Math.min(W * 0.42, 420 * s * ck), ch = cw * META.h / META.w;
      GROUND = H - 34 * s - OY;
      C = { x: W * 0.74 - cw / 2 + OX, y: GROUND - ch, w: cw, h: ch };
      $alert.style.left = (W / 2 + OX) + 'px'; $alert.style.top = '8px';
    }
    const P2 = (f) => ({ x: C.x + f[0] * C.w, y: C.y + f[1] * C.h + bob.y }); // จุดบนรถ (ตามโช้ค)

    // ---- โช้ค + หลุมถนน ----
    const bob = { y: 0, v: 0, rot: 0 };
    let dist = 0, nextBump = 1.5;
    const VW = () => 210 * s * SPEED; // ความเร็วโลก (px/วินาที) — ถนน/ล้อ/ลมสัมพันธ์กัน

    // ---- ของขวัญ ----
    const gifts = [], imgCache = {}, fx = new Juice.Particles();
    const giftImg = (u) => { if (!u || !/^https:\/\//.test(u)) return null; let im = imgCache[u]; if (!im) { im = new Image(); im.crossOrigin = 'anonymous'; im.src = u; imgCache[u] = im; } return im; };
    const sizeFor = Juice.sizeFor || (() => 1);
    const EMOJI = { Rose: '🌹', 'Finger Heart': '🫰', Perfume: '🧴', Galaxy: '🌌', Lion: '🦁', Universe: '🪐', Heart: '❤️', TikTok: '🎵' };
    let dens = 1; // ของเยอะ → ทุกชิ้นเล็กลง (ไม่ลบ)
    function relayout() {
      const nb = gifts.filter((b) => !b.dying && b.kind === 'b').length, nd = gifts.filter((b) => !b.dying && b.kind === 'd').length;
      const capD = Math.max(8, (C.x / (34 * s)) * 4); // กระป๋อง 4 เลน ตามระยะจากท้ายรถถึงขอบจอซ้าย
      dens = Math.max(0.45, Math.min(1, Math.sqrt(capD / Math.max(1, nd)), Math.sqrt(60 / Math.max(1, nb)) * 1.2));
      let k = 0; for (const b of gifts) if (!b.dying && b.kind === 'd') { b.slot = k++; }
      // ลูกโป่ง: ของแพงเชือกยาวกว่า (ลอยบนสุด)
      gifts.filter((b) => !b.dying && b.kind === 'b').sort((a, c) => a.g.d - c.g.d).forEach((b, i, arr) => { b.L = (120 + (i / Math.max(1, arr.length - 1)) * 120 + (b.jit || 0)) * s; });
    }
    function addGift(g, live) {
      const kind = kindOf(g);
      const alive = gifts.filter((b) => !b.dying);
      if (alive.length >= MAX) { const old = (window.VJLCollect && VJLCollect.victims) ? VJLCollect.victims(gifts.map((x) => ({ ...x, d: x.g.d, ref: x })), 1).map((x) => x.ref)[0] : alive[0]; if (old) old.dying = true; }
      const b = { g, kind, img: giftImg(g.u), life: 1, dying: false, born: performance.now(), jit: (Math.random() - 0.5) * 30, lane: Math.floor(Math.random() * 4), rot: 0, vr: 0 };
      gifts.push(b); relayout();
      if (kind === 'b') { const t = P2(META.tie); b.x = live ? t.x : t.x - b.L * 0.7 + (Math.random() - 0.5) * 80 * s; b.y = live ? t.y - 10 : t.y - b.L * 0.7 + (Math.random() - 0.5) * 60 * s; }
      else { const h = P2(META.hook); b.x = live ? h.x : h.x - (60 + b.slot * 9) * s; b.y = live ? h.y : GROUND - 10; }
      b.vx = 0; b.vy = 0;
      if (live && !SHOT) fx.sparkle(b.x, b.y, 5, g.d >= 1000 ? '#ffe08a' : '#fff6e8');
    }
    const radius = (b) => (b.kind === 'b' ? Math.min(44, 19 * GIFT_SCALE * sizeFor(b.g.d, 3)) : Math.min(30, 15 * GIFT_SCALE * sizeFor(b.g.d, 2))) * s * dens;

    // ---- ฟิสิกส์ (ความเร็วจริง px/วินาที + เชือกยาวสูงสุด) ----
    // ลูกโป่ง: แรงลอย + แรงลากของอากาศ (อากาศไหลไปทางซ้ายด้วยความเร็วรถ) → เชือกเอียงไปด้านหลังแบบรถวิ่งจริง
    // กระป๋อง: แรงโน้มถ่วง + ถนนเสียดทานพาไปทางซ้าย → ตึงเชือกลากตามหลัง · ตกหลุม = เด้ง
    function tether(b, ax, ay, L) {
      const dx = b.x - ax, dy = b.y - ay, d = Math.hypot(dx, dy);
      if (d > L && d > 0) { const nx = dx / d, ny = dy / d; b.x = ax + nx * L; b.y = ay + ny * L; const vn = b.vx * nx + b.vy * ny; if (vn > 0) { b.vx -= vn * nx; b.vy -= vn * ny; } }
    }
    function step(dt) {
      const t = performance.now() / 1000, vw = VW();
      dist += vw * dt;
      if (t > nextBump && SPEED > 0) { // หลุม: รถยุบ-เด้ง · กระป๋องกระดอนขึ้น
        bob.v += (30 + Math.random() * 50) * s; nextBump = t + 1.2 + Math.random() * 2.8;
        for (const b of gifts) if (b.kind === 'd' && !b.dying && Math.random() < 0.7) { b.vy -= (90 + Math.random() * 170) * s; b.vr += (Math.random() - 0.5) * 9; }
      }
      bob.v += (-bob.y * 160 - bob.v * 9) * dt; bob.y += bob.v * dt;
      bob.rot = Math.sin(t * 2.3) * 0.004 + bob.v * 0.00018;
      const tie = P2(META.tie), hook = P2(META.hook);
      const air = -vw * (0.6 + 0.4 * Math.sin(t * 0.7)) - 40 * s; // ลมกระโชกเบา ๆ
      const bal = gifts.filter((b) => b.kind === 'b');
      for (const b of gifts) {
        if (b.vx == null) { b.vx = 0; b.vy = 0; }
        const r = radius(b); b.r = r;
        if (b.kind === 'b') {
          b.vx += ((air + Math.sin(t * 1.3 + b.jit) * 50 * s - b.vx) * 2.0) * dt;
          b.vy += (-620 * s - b.vy * 2.0 + Math.cos(t * 1.1 + b.jit) * 40 * s) * dt;
          b.x += b.vx * dt; b.y += b.vy * dt;
          tether(b, tie.x, tie.y, b.L || 160 * s);
        } else {
          b.vy += 2200 * s * dt; b.vx *= Math.pow(0.5, dt);
          b.x += b.vx * dt; b.y += b.vy * dt;
          const gy = GROUND - b.lane * 5 * s - r * 0.8;
          if (b.y > gy) { b.y = gy; if (b.vy > 0) b.vy = b.vy > 120 * s ? -b.vy * 0.32 : 0; b.vx += (-vw - b.vx) * Math.min(1, dt * 14); b.vr += (-vw / Math.max(4, r) - b.vr) * Math.min(1, dt * 3) * 0.15; }
          b.rot += b.vr * dt; b.vr *= Math.pow(0.4, dt);
          const L = Math.max(0, GROUND - hook.y) + (34 + Math.floor(b.slot / 4) * 46 * dens + b.lane * 11) * s; // เชือกยาวพอถึงพื้นเสมอ · แถวละ 4 เลน
          tether(b, hook.x, hook.y, L);
          if (b.x > hook.x - 8 * s) { b.x = hook.x - 8 * s; if (b.vx > 0) b.vx = 0; }
        }
      }
      // ลูกโป่งไม่ซ้อนกัน
      for (let i = 0; i < bal.length; i++) for (let j = i + 1; j < bal.length; j++) {
        const a = bal[i], c = bal[j], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy) || 0.01, m = (a.r + c.r) * 0.92;
        if (d < m) { const k = (m - d) / d * 0.5; a.x -= dx * k; a.y -= dy * k; c.x += dx * k; c.y += dy * k; }
      }
      // กระป๋องเลนเดียวกันไม่ทับกัน
      const dl = gifts.filter((b) => b.kind === 'd' && !b.dying);
      for (let i = 0; i < dl.length; i++) for (let j = i + 1; j < dl.length; j++) {
        const a = dl[i], c = dl[j]; if (a.lane !== c.lane) continue;
        const dx = c.x - a.x, m = (a.r + c.r) * 0.85; if (Math.abs(dx) < m && Math.abs(c.y - a.y) < m) { const k = (m - Math.abs(dx)) * 0.5 * Math.sign(dx || 1); a.x -= k; c.x += k; }
      }
      for (const b of gifts) if (b.dying) b.life -= dt * 0.8;
      for (let i = gifts.length - 1; i >= 0; i--) if (gifts[i].life <= 0) gifts.splice(i, 1);
    }

    function drawGift(b) {
      const sz = b.r * 2, st = Juice.sticker ? Juice.sticker(b.img, sz * DPR) : null;
      if (st) { const q = sz * Juice.STICKER_PAD; ctx.drawImage(st, -q / 2, -q / 2, q, q); }
      else if (b.img && b.img.complete && b.img.naturalWidth) ctx.drawImage(b.img, -sz / 2, -sz / 2, sz, sz);
      else { ctx.font = Math.round(sz * 0.8) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.g.e || '🎁', 0, 1); }
    }
    const ROPE_A = 'rgba(60,60,70,.26)', ROPE_B = 'rgba(196,196,204,.92)'; // เชือกสีเทาอ่อน + ขอบเข้มจาง ๆ
    function rope(x0, y0, x1, y1, sag) {
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag, x1, y1);
      ctx.lineWidth = 2.4 * Math.max(0.7, s * 0.8); ctx.strokeStyle = ROPE_A; ctx.stroke();
      ctx.lineWidth = 1.2 * Math.max(0.7, s * 0.8); ctx.strokeStyle = ROPE_B; ctx.stroke();
    }

    let last = performance.now();
    function frame() {
      const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (innerWidth !== W || innerHeight !== H) resize(); // เปิดตอนซ่อนอยู่ (ขนาด 0) → จัดผังใหม่เมื่อมีขนาดจริง
      const sub = 3; for (let i = 0; i < sub; i++) step(dt / sub);
      const t = now / 1000;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H); ctx.imageSmoothingQuality = 'high';
      // ถนน: เส้นประเลื่อนไปทางซ้าย
      if (ROAD) {
        const gy = GROUND + 6 * s, dash = 46 * s, gap = 34 * s, off = dist % (dash + gap);
        ctx.lineCap = 'round'; ctx.lineWidth = 3.5 * s; ctx.strokeStyle = 'rgba(205,205,215,.7)';
        ctx.beginPath(); for (let x = -off; x < W + dash; x += dash + gap) { ctx.moveTo(x, gy); ctx.lineTo(x + dash, gy); } ctx.stroke();
        ctx.lineWidth = 1.5 * s; ctx.strokeStyle = 'rgba(70,60,90,.18)'; ctx.beginPath(); ctx.moveTo(0, gy - 4 * s); ctx.lineTo(W, gy - 4 * s); ctx.stroke();
      }
      const tie = P2(META.tie), hook = P2(META.hook);
      // ลูกโป่ง: เชือกก่อน แล้วตัวของขวัญ (ของแพงอยู่บน)
      const bal = gifts.filter((b) => b.kind === 'b');
      for (const b of bal) { ctx.globalAlpha = Math.max(0, b.life); rope(tie.x, tie.y, b.x, b.y + b.r * 0.8, 10 * s); }
      ctx.globalAlpha = 1;
      for (const b of bal) {
        if (b.life > 0.5) Juice.aura(ctx, b.x, b.y, b.r * 0.9, b.g.d, t);
        ctx.save(); ctx.globalAlpha = Math.max(0, b.life); ctx.translate(b.x, b.y); ctx.rotate(Math.max(-0.3, Math.min(0.3, (b.x - tie.x) / 900)) + Math.sin(t * 1.7 + b.jit) * 0.05); drawGift(b); ctx.restore();
      }
      // กระป๋อง: เลนไกลก่อน · เชือกจากตะขอท้ายรถ
      const dl = gifts.filter((b) => b.kind === 'd').sort((a, c) => a.lane - c.lane);
      for (const b of dl) {
        ctx.globalAlpha = Math.max(0, b.life);
        rope(hook.x, hook.y, b.x + b.r * 0.6, b.y, Math.max(0, 6 * s - Math.abs(hook.x - b.x) * 0.01));
        const gy = GROUND - b.lane * 5 * s, hop = Math.max(0, gy - b.r * 0.8 - b.y);
        ctx.beginPath(); ctx.ellipse(b.x, gy + 2 * s, b.r * 0.8 * Math.max(0.4, 1 - hop / 60), b.r * 0.18, 0, 0, 6.2832); ctx.fillStyle = 'rgba(60,40,90,.22)'; ctx.fill();
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot); drawGift(b); ctx.restore();
      }
      ctx.globalAlpha = 1;
      // เงารถ + รถ + ล้อหมุน
      ctx.beginPath(); ctx.ellipse(C.x + C.w / 2, GROUND + 2 * s, C.w * 0.46, 9 * s, 0, 0, 6.2832); ctx.fillStyle = 'rgba(60,40,90,.22)'; ctx.fill();
      const car = carSkin.ready() ? carSkin.source : null;
      if (car) {
        ctx.save(); ctx.translate(C.x + C.w / 2, GROUND); ctx.rotate(bob.rot); ctx.translate(-(C.x + C.w / 2), -GROUND + bob.y);
        ctx.drawImage(car, C.x, C.y, C.w, C.h);
        ctx.restore();
        for (const wl of META.wheels) { // หมุนเฉพาะวงล้อ (ล้อติดถนน ไม่โยกตามโช้ค)
          const cx = C.x + wl[0] * C.w, cy = C.y + wl[1] * C.h, r = wl[2] * C.w, ang = dist / Math.max(1, r);
          ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r * 0.97, 0, 6.2832); ctx.clip();
          ctx.translate(cx, cy); ctx.rotate(ang); ctx.translate(-cx, -cy);
          ctx.drawImage(car, C.x, C.y, C.w, C.h); ctx.restore();
        }
      }
      // ควันฝุ่นจาง ๆ หลังล้อหลัง (วาดเอง ไม่ใช้ fx.dust ที่เป็นจุดขาวใหญ่)
      if (!SHOT && SPEED > 0) { const w0 = META.wheels[0] || [0.2, 0.8, 0.1], px = C.x + (w0[0] - w0[2] * 0.9) * C.w; for (let i = 0; i < 3; i++) { const k = ((t * 1.6 + i / 3) % 1), x = px - k * 70 * s, y = GROUND - 6 * s - k * 14 * s; ctx.beginPath(); ctx.arc(x, y, (4 + k * 12) * s, 0, 6.2832); ctx.fillStyle = `rgba(210,200,220,${(1 - k) * 0.18})`; ctx.fill(); } }
      fx.draw(ctx);
      requestAnimationFrame(frame);
    }
    setInterval(() => { if (document.hidden) { const now = performance.now(); step(Math.min(0.05, (now - last) / 1000)); last = now; } }, 250);

    // ---- แจ้งเตือน ----
    const $alert = document.getElementById('alert');
    let alertT = null;
    function showAlert(e, count) {
      if (!SHOW_ALERT) return;
      const u = e.user || {};
      $alert.querySelector('.ava').src = u.avatar || ''; $alert.querySelector('.gift').src = e.giftImage || '';
      $alert.querySelector('.nm').textContent = u.nickname || u.uniqueId || '';
      $alert.querySelector('.sub').textContent = `ส่ง ${e.giftName || 'ของขวัญ'} ×${count}`;
      $alert.classList.add('show'); clearTimeout(alertT); alertT = setTimeout(() => $alert.classList.remove('show'), 3200);
    }

    // ---- จำไว้ (คีย์เดียวกับรถลากแบบเดิม) ----
    const KEY = 'vjl-vehicle:' + (P('t', '') || P('username', 'demo')).slice(-24);
    let saveT = null;
    const saveNow = () => { try { localStorage.setItem(KEY, JSON.stringify({ g: gifts.filter((b) => !b.dying).map((b) => b.g) })); } catch { /* storage ปิด */ } };
    const save = () => { clearTimeout(saveT); saveT = setTimeout(saveNow, 500); };
    addEventListener('pagehide', () => { clearTimeout(saveT); saveNow(); });

    function onGift(e) {
      const count = e.repeatCount || 1, unit = e.diamondCount || 0;
      if (unit < MIN_COINS) return;
      const g = { u: (e.giftImage || (window.VJLCollect ? VJLCollect.imgFor(e.giftName) : '')), e: EMOJI[e.giftName] || '🎁', d: unit };
      const n = unit >= 1000 ? 1 : Math.min(count, 150), k = e.__add != null ? Math.min(e.__add, n) : n;
      for (let i = 0; i < k; i++) setTimeout(() => { addGift(g, !e.__shot); save(); }, i * (k > 25 ? 60 : 140));
      if (e.__partial) return;
      if (window.VJLCollect) VJLCollect.record(e, n);
      if (!e.__quiet) showAlert(e, count);
    }

    if (P('debug', '0') === '1') window.__sc = { gifts, C: () => C, G: () => GROUND, META: () => META };
    addEventListener('resize', resize); resize();
    try {
      if (P('reset', '0') === '1') localStorage.removeItem(KEY);
      const st = JSON.parse(localStorage.getItem(KEY) || 'null');
      let list = st ? (st.g || []) : [];
      if (window.VJLCollect) { VJLCollect.seed(list); if (VJLCollect.has()) list = VJLCollect.gifts(MAX).map((g) => ({ u: g.u, e: g.em || VJLCollect.emoji(g.name, '🎁'), d: g.d })); }
      list.slice(-MAX).forEach((g) => addGift(g, false));
    } catch { /* ignore */ }
    Overlay.on('state', (st) => { if (window.VJLCollect) VJLCollect.backfill(st, onGift); });
    if (window.VJLCollect && VJLCollect.live) VJLCollect.live(onGift); else Overlay.on('event', (e) => { if (e.type === 'gift' && !e.streaking) onGift(e); });
    requestAnimationFrame(frame);

    if (!Overlay.connected && window.VJLCollect) {
      VJLCollect.demoBurst(onGift);
      if (!SHOT) setInterval(() => onGift(VJLCollect.demoGift()), 1300);
    }
  }
})();
