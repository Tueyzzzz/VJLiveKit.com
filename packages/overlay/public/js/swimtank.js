/*
 * ตู้ปลาใหญ่ (โหมดว่ายน้ำ) — ของขวัญจริงจาก TikTok ว่ายไปมาในตู้เหมือนปลา
 * เรียกจาก giftjar.html เมื่อ shape ขึ้นต้นด้วย "sw-" (เช่น sw-pastel) → ตู้จากภาพ GPT ใน aquarium/<ชื่อ>.webp
 * กล่องว่ายน้ำ (box = สัดส่วน x0,y0,x1,y1 ของภาพ) อยู่ใน aquarium/tanks.json
 * พารามิเตอร์ URL เหมือนโหลแก้ว: scale giftScale x y alert alertSec board top boardFormat total minCoins font fontSize reset
 * ของขวัญไม่หาย: ใช้กองกลาง VJLCollect (เซิร์ฟเวอร์) เหมือนทุกแบบ · ปลาเยอะเกิน → ทุกตัวเล็กลง ไม่ลบ (เกิน MAX ค่อยจางชิ้นถูกสุด-เก่าสุด แต่ยังนับในกองกลาง)
 */
(function () {
  window.VJLSwimTank = { start };

  function start(P, num) {
    const TANK = String(P('shape', 'sw-pastel')).slice(3);
    const SCALE = num('scale', 1), GIFT_SCALE = num('giftScale', 1), OX = num('x', 0), OY = num('y', 0);
    const SHOW_ALERT = P('alert', '1') !== '0', ALERT_MS = num('alertSec', 5) * 1000;
    const SHOW_BOARD = P('board', '1') !== '0', TOP = Math.max(1, Math.min(10, num('top', 1))), BOARD_FULL = P('boardFormat', 'full') !== 'name';
    const SHOW_TOTAL = P('total', '0') === '1', MIN_COINS = num('minCoins', 0), SHOT = P('shot', '0') === '1';
    document.documentElement.style.setProperty('--font', `'${P('font', 'Kanit')}'`);
    document.documentElement.style.setProperty('--fs', String(num('fontSize', 50)));

    const canvas = document.getElementById('fx'), ctx = canvas.getContext('2d');
    let W = 0, H = 0; const DPR = Math.min(2, devicePixelRatio || 1);
    const tank = new Image(); tank.decoding = 'async'; tank.src = 'aquarium/' + TANK + '.webp?v=' + (window.VJL_VERSION || '1');
    let META = { box: [0.06, 0.24, 0.94, 0.8], w: 1500, h: 970 };
    fetch('aquarium/tanks.json?v=' + (window.VJL_VERSION || '1')).then((r) => r.json()).then((m) => { if (m[TANK]) { META = { ...META, ...m[TANK] }; resize(); } }).catch(() => {});

    // ---- ผังตู้บนจอ: กึ่งกลางล่าง (เหมือนโหล) · กว้างสุด 94% จอ / สูงสุด 78% จอ ----
    let T = { x: 0, y: 0, w: 0, h: 0 }, BOX = { x0: 0, y0: 0, x1: 0, y1: 0 };
    // กรอบเนื้อหา (มองไม่เห็น) ให้พรีวิวในแดชบอร์ดซูมถูกที่ — ของบนแคนวาสวัดจาก DOM ไม่ได้
    const fitbox = document.createElement('div'); fitbox.setAttribute('data-fit', ''); fitbox.style.cssText = 'position:fixed;pointer-events:none;visibility:hidden'; document.body.appendChild(fitbox);
    const setFit = (x0, y0, x1, y1) => { fitbox.style.left = x0 + 'px'; fitbox.style.top = y0 + 'px'; fitbox.style.width = Math.max(4, x1 - x0) + 'px'; fitbox.style.height = Math.max(4, y1 - y0) + 'px'; };
    function resize() {
      W = innerWidth; H = innerHeight;
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR); canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      const ar = META.h / META.w;
      let tw = Math.min(W * 0.94, (H * 0.78) / ar) * SCALE; const th = tw * ar;
      T = { x: W / 2 - tw / 2 + OX, y: H - th - Math.max(70, H * 0.09) - OY, w: tw, h: th };
      const b = META.box; BOX = { x0: T.x + b[0] * tw, y0: T.y + b[1] * th, x1: T.x + b[2] * tw, y1: T.y + b[3] * th };
      layoutUi(); setFit(T.x, T.y, T.x + T.w, T.y + T.h);
    }

    // ---- ปลา (ของขวัญ) ----
    const fish = [], MAX = Math.round(Math.max(200, Math.min(900, 500 / (GIFT_SCALE * GIFT_SCALE))));
    const imgCache = {};
    const giftImg = (url) => { if (!url || !/^https:\/\//.test(url)) return null; let im = imgCache[url]; if (!im) { im = new Image(); im.crossOrigin = 'anonymous'; im.src = url; imgCache[url] = im; } return im; };
    const sizeFor = (window.Juice && Juice.sizeFor) || ((d, max = 4) => 1 + (max - 1) * Math.min(1, Math.log10(Math.max(1, d || 1)) / 4.5));
    // ตู้แน่น → ทุกตัวเล็กลงเรื่อย ๆ (พื้นที่ปลารวม ≤ 28% ของน้ำ)
    let dens = 1;
    function updateDensity() {
      const bw = BOX.x1 - BOX.x0, bh = BOX.y1 - BOX.y0; if (bw <= 0) return;
      let area = 0; for (const f of fish) if (!f.dying) area += Math.PI * f.base * f.base; // หน่วย 1/1000 ของความกว้างน้ำ
      const water = 1e6 * (bh / bw);
      dens = Math.max(0.32, Math.min(1, Math.sqrt((water * 0.28) / Math.max(1, area))));
    }
    // ขนาดพื้นฐานเป็นสัดส่วนของความกว้างน้ำ (ไม่ขึ้นกับจอ) → base หน่วย 1/1000 ของความกว้าง
    const baseFor = (d) => Math.min(80, 21 * GIFT_SCALE * sizeFor(d, 4));
    function addFish(g, splash) {
      const base = baseFor(g.d), z = 0.78 + Math.random() * 0.22, dir = Math.random() < 0.5 ? -1 : 1;
      const f = { g, img: giftImg(g.img), emoji: g.e || '🎁', d: g.d || 1, base, z,
        u: 0.1 + Math.random() * 0.8, v: splash ? -0.08 : 0.08 + Math.random() * 0.84, // ตำแหน่งในกล่อง (0..1)
        vu: dir * (0.02 + Math.random() * 0.02), vv: splash ? 0.16 : 0,
        hd: Math.random() * 6.28, sp: 0.6 + Math.random() * 0.6, ph: Math.random() * 6.28, face: dir, tilt: 0,
        born: performance.now(), life: 1, dying: false, enter: splash,
        pv: 0.12 + Math.random() * 0.78, pvAt: 0 }; // pv = ระดับความลึกที่อยากอยู่ (เปลี่ยนเองเป็นระยะ)
      if (splash) { f.u = 0.15 + Math.random() * 0.7; ripple(f.u, f.d); }
      fish.push(f); fish.sort((a, b) => a.z - b.z); // ตัวไกล (z น้อย) วาดก่อน
      const alive = fish.filter((k) => !k.dying);
      if (alive.length > MAX) ((window.VJLCollect && VJLCollect.victims) ? VJLCollect.victims(fish, 1) : [alive[0]]).forEach((k) => { k.dying = true; });
      updateDensity();
    }

    // ---- ฟองอากาศ + วงน้ำกระเพื่อมตอนของตกน้ำ ----
    const bubbles = [], ripples = [];
    function bubble(x, y, r) { if (bubbles.length < 160) bubbles.push({ x, y, r: r || 1.5 + Math.random() * 3, vy: 0.4 + Math.random() * 0.6, ph: Math.random() * 6, life: 1 }); }
    function ripple(u, d) { ripples.push({ u, t: 0, big: d >= 1000 }); for (let i = 0; i < (d >= 100 ? 14 : 6); i++) bubble(BOX.x0 + u * (BOX.x1 - BOX.x0) + (Math.random() - 0.5) * 30, BOX.y0 + 10 + Math.random() * 30); }

    // ---- ว่ายน้ำ: หัวเลี้ยวช้า ๆ (wander) + หลบผนัง + แยกตัวจากเพื่อนใกล้ ๆ ----
    let lastT = performance.now();
    function step(dt) {
      const bw = BOX.x1 - BOX.x0, bh = BOX.y1 - BOX.y0; if (bw <= 0) return;
      const t = performance.now() / 1000;
      // ตารางเพื่อนบ้าน (เร็วพอสำหรับหลายร้อยตัว)
      const cell = 0.08, grid = new Map();
      for (const f of fish) { const k = ((f.u / cell) | 0) + ',' + ((f.v / cell) | 0); (grid.get(k) || grid.set(k, []).get(k)).push(f); }
      for (const f of fish) {
        if (f.dying) { f.life -= dt * 0.6; continue; }
        if (f.enter) { // ตกน้ำ: จมลงช้า ๆ แล้วค่อยเริ่มว่าย
          f.vv += ((f.pv - f.v) * 0.9 - f.vv) * Math.min(1, dt * 2.2); f.v += f.vv * dt; // จมลงไปความลึกของตัวเองแบบหน่วง ๆ
          f.u += Math.sin(performance.now() / 300 + f.ph) * 0.004 * dt;
          if (Math.abs(f.pv - f.v) < 0.04) f.enter = false;
          if (Math.random() < dt * 8) bubble(BOX.x0 + f.u * bw, BOX.y0 + f.v * bh);
          continue;
        }
        // wander: มุมหัวเปลี่ยนตาม noise ช้า ๆ · ของแพงว่ายช้าสง่า ของถูกว่ายไวนิด
        f.hd += (Math.sin(t * 0.37 * f.sp + f.ph) * 0.9 + Math.sin(t * 0.13 + f.ph * 2.1) * 0.6) * dt;
        const spd = (0.035 + 0.03 / (1 + Math.log10(Math.max(1, f.d)))) * f.sp;
        if (t > f.pvAt) { f.pv = Math.max(0.06, Math.min(0.94, f.pv + (Math.random() - 0.5) * 0.5)); f.pvAt = t + 4 + Math.random() * 8; }
        let au = Math.cos(f.hd) * spd, av = Math.sin(f.hd) * spd * 0.3 + (f.pv - f.v) * 0.12; // ว่ายแนวนอนเป็นหลัก + ค่อย ๆ ไปหาความลึกที่อยากอยู่
        // หลบผนัง (นุ่ม ๆ)
        const m = 0.06;
        if (f.u < m) au += (m - f.u) * 2.2; if (f.u > 1 - m) au -= (f.u - 1 + m) * 2.2;
        if (f.v < m) av += (m - f.v) * 1.6; if (f.v > 1 - m) av -= (f.v - 1 + m) * 1.6;
        // แยกตัว
        const gx = (f.u / cell) | 0, gy = (f.v / cell) | 0, rr = (f.base * dens * f.z) / 1000 * 2.2;
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
          const arr = grid.get((gx + i) + ',' + (gy + j)); if (!arr) continue;
          for (const o of arr) { if (o === f || o.dying) continue; const du = f.u - o.u, dv = (f.v - o.v) * (bh / bw), dd = du * du + dv * dv; if (dd > 0 && dd < rr * rr) { const s = (rr - Math.sqrt(dd)) / rr * 0.06; au += du * s / Math.sqrt(dd); av += dv * s / Math.sqrt(dd); } }
        }
        // ความเร็วไล่เข้าหาเป้าแบบลื่น (มีแรงเฉื่อย)
        const k = 1 - Math.pow(0.08, dt);
        f.vu += (au - f.vu) * k; f.vv += (av - f.vv) * k;
        f.u = Math.max(0.01, Math.min(0.99, f.u + f.vu * dt)); f.v = Math.max(0.02, Math.min(0.98, f.v + f.vv * dt));
        if (Math.abs(f.vu) > 0.006) f.face += ((f.vu > 0 ? 1 : -1) - f.face) * Math.min(1, dt * 3.5); // หันตัวแบบพลิกช้า ๆ
        f.tilt += (Math.max(-0.35, Math.min(0.35, f.vv * 5)) - f.tilt) * Math.min(1, dt * 3);
        if (!SHOT && Math.random() < dt * 0.25) bubble(BOX.x0 + f.u * bw + f.face * f.base * 0.6, BOX.y0 + f.v * bh - 4, 1 + Math.random() * 1.6);
      }
      for (let i = fish.length - 1; i >= 0; i--) if (fish[i].life <= 0) fish.splice(i, 1);
      for (let i = bubbles.length - 1; i >= 0; i--) { const b = bubbles[i]; b.y -= b.vy * 60 * dt; b.x += Math.sin(t * 3 + b.ph) * 0.25; if (b.y < BOX.y0 - 6) bubbles.splice(i, 1); }
      for (let i = ripples.length - 1; i >= 0; i--) { ripples[i].t += dt; if (ripples[i].t > 1.4) ripples.splice(i, 1); }
    }

    function drawFish(f, bw, bh, t) {
      const r = f.base * dens * f.z * (bw / 1000) * Math.min(1, (performance.now() - f.born) / 350 + 0.3);
      const x = BOX.x0 + f.u * bw, y = BOX.y0 + f.v * bh + Math.sin(t * 1.6 + f.ph) * r * 0.08;
      const wag = Math.sin(t * (5 + f.sp * 3) + f.ph) * 0.06; // ส่ายตัวเหมือนว่าย (บีบ-ยืดแนวนอน)
      if (f.life > 0.5 && window.Juice && Juice.aura) Juice.aura(ctx, x, y, r, f.d, t);
      ctx.save(); ctx.globalAlpha = Math.max(0, f.life) * (0.82 + f.z * 0.18);
      ctx.translate(x, y); ctx.rotate(f.tilt * (f.face >= 0 ? 1 : -1) + wag * 0.5);
      ctx.scale((f.face >= 0 ? 1 : -1) * Math.max(0.25, Math.abs(f.face)) * (1 + wag), 1 - wag * 0.5);
      const st = window.Juice && Juice.sticker ? Juice.sticker(f.img, r * 2.2 * DPR) : null;
      if (st) { const s = r * 2.2 * Juice.STICKER_PAD; ctx.drawImage(st, -s / 2, -s / 2, s, s); }
      else if (f.img && f.img.complete && f.img.naturalWidth) { const s = r * 2.2; ctx.drawImage(f.img, -s / 2, -s / 2, s, s); }
      else { ctx.font = Math.round(r * 1.6) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(f.emoji, 0, 1); }
      ctx.restore();
    }

    function frame() {
      const now = performance.now(), dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
      if (innerWidth !== W || innerHeight !== H) resize();
      step(dt);
      const t = now / 1000, bw = BOX.x1 - BOX.x0, bh = BOX.y1 - BOX.y0;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H); ctx.imageSmoothingQuality = 'high';
      if (tank.complete && tank.naturalWidth) ctx.drawImage(tank, T.x, T.y, T.w, T.h);
      ctx.save(); ctx.beginPath(); ctx.rect(BOX.x0 - 30, BOX.y0 - 40, bw + 60, bh + 80); ctx.clip(); // ปลา/ฟองอยู่ในตู้เท่านั้น
      for (const f of fish) drawFish(f, bw, bh, t);
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1;
      for (const b of bubbles) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (bw / 1000) * 1.6, 0, 6.2832); ctx.globalAlpha = 0.5; ctx.fill(); ctx.globalAlpha = 0.8; ctx.stroke(); }
      ctx.globalAlpha = 1;
      for (const rp of ripples) { // วงน้ำกระเพื่อมที่ผิวน้ำ
        const x = BOX.x0 + rp.u * bw, k = rp.t / 1.4;
        ctx.beginPath(); ctx.ellipse(x, BOX.y0 + 4, (rp.big ? 90 : 50) * (bw / 1000) * (0.3 + k * 1.6), (rp.big ? 10 : 6) * (bw / 1000) * (0.3 + k), 0, 0, 6.2832);
        ctx.strokeStyle = `rgba(255,255,255,${(1 - k) * 0.8})`; ctx.lineWidth = 2; ctx.stroke();
      }
      ctx.restore();
      // ประกายกระจกด้านหน้า (แสงพาดเฉียง เลื่อนช้า ๆ) — ให้ดูเหมือนปลาอยู่หลังกระจกจริง
      const sx = BOX.x0 + ((t * 0.04) % 1.6 - 0.3) * bw;
      const gr = ctx.createLinearGradient(sx, BOX.y0, sx + bw * 0.16, BOX.y1);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.10)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr; ctx.fillRect(BOX.x0, BOX.y0, bw, bh);
      if (window.__swimFx) window.__swimFx.draw(ctx);
      requestAnimationFrame(frame);
    }
    setInterval(() => { if (document.hidden) { const now = performance.now(); step(Math.min(0.5, (now - lastT) / 1000)); lastT = now; } }, 250);

    // ---- UI: แจ้งเตือน / อันดับ / ยอดรวม (ใช้ element เดียวกับโหลแก้ว) ----
    const $alert = document.getElementById('alert'), $board = document.getElementById('board'), $total = document.getElementById('total');
    function layoutUi() {
      const cx = T.x + T.w / 2;
      $alert.style.left = cx + 'px'; $alert.style.top = Math.max(4, T.y - 70) + 'px';
      $total.style.left = cx + 'px'; $total.style.top = Math.max(4, T.y - 30) + 'px';
      $board.style.left = cx + 'px'; $board.style.top = Math.min(H - 60, T.y + T.h + 8) + 'px';
    }
    let alertTimer = null;
    function showAlert(e, count) {
      if (!SHOW_ALERT) return;
      const ava = $alert.querySelector('.ava'), gi = $alert.querySelector('.gift');
      ava.src = e.user && e.user.avatar ? e.user.avatar : ''; ava.style.visibility = ava.src ? 'visible' : 'hidden';
      $alert.querySelector('.nm').textContent = (e.user && (e.user.nickname || e.user.uniqueId)) || 'ผู้ชม';
      $alert.querySelector('.sub').textContent = `ส่ง ${e.giftName || 'ของขวัญ'} ×${count}`;
      const gimg = /^https:\/\//.test(e.giftImage || '') ? e.giftImage : '';
      gi.src = gimg; gi.style.display = gimg ? 'block' : 'none';
      $alert.classList.add('show'); clearTimeout(alertTimer); alertTimer = setTimeout(() => $alert.classList.remove('show'), ALERT_MS);
    }
    let ranking = {}, totalCoins = 0;
    function renderBoard() {
      $total.textContent = SHOW_TOTAL ? '💎 ' + Overlay.fmt(totalCoins) : '';
      if (!SHOW_BOARD) { $board.innerHTML = ''; return; }
      const top = Object.values(ranking).sort((a, b) => b.c - a.c).slice(0, TOP);
      $board.innerHTML = top.map((u, i) => {
        const ava = BOARD_FULL && /^https:\/\//.test(u.a || '') ? `<img src="${u.a.replace(/"/g, '%22')}" alt="">` : '';
        const coins = BOARD_FULL ? `<span class="c">💎 ${Overlay.fmt(u.c)}</span>` : '';
        return `<div class="row"><span class="rk">${TOP === 1 ? '👑' : (['🥇', '🥈', '🥉'][i] || i + 1)}</span>${ava}<span>${Overlay.esc(u.n)}</span>${coins}</div>`;
      }).join('');
    }

    // ---- จำตู้ไว้ (คีย์เดียวกับตู้ปลาแบบเดิม → สลับแบบแล้วอันดับไม่หาย) ----
    const KEY = 'vjl-aquarium:' + (P('t', '') || P('username', 'demo')).slice(-24);
    let saveTimer = null, restoreUntil = 0;
    function saveNow() {
      if (performance.now() < restoreUntil) return;
      try { localStorage.setItem(KEY, JSON.stringify({ g: fish.filter((f) => !f.dying).map((f) => f.g), r: ranking, t: totalCoins })); } catch { /* storage ปิด */ }
    }
    const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 500); };
    addEventListener('pagehide', () => { clearTimeout(saveTimer); saveNow(); });
    function restore() {
      if (P('reset', '0') === '1') { try { localStorage.removeItem(KEY); } catch { /* ignore */ } return; }
      try {
        const s = JSON.parse(localStorage.getItem(KEY) || 'null') || { g: [] };
        ranking = s.r || {}; totalCoins = s.t || 0;
        let list = (s.g || []).slice(-MAX);
        if (window.VJLCollect) { VJLCollect.seed(s.g || []); if (VJLCollect.has()) list = VJLCollect.gifts(MAX).map((g) => ({ img: g.u, e: g.em || VJLCollect.emoji(g.name, '🎁'), d: g.d })); }
        restoreUntil = performance.now() + 2500;
        list.forEach((g) => addFish({ img: g.img, e: g.e, d: g.d }, false)); // กู้คืน: ว่ายอยู่ในตู้ทันที ไม่ต้องตกน้ำใหม่
      } catch { /* ignore */ }
    }

    const EMOJI = { Rose: '🌹', 'Finger Heart': '🫰', Perfume: '🧴', Galaxy: '🌌', Lion: '🦁', Universe: '🪐', Heart: '❤️', TikTok: '🎵' };
    function onGift(e) {
      const count = e.repeatCount || 1, unit = e.diamondCount || 0, value = e.totalValue || unit * count;
      if (unit < MIN_COINS) return;
      const g = { img: (e.giftImage || (window.VJLCollect ? VJLCollect.imgFor(e.giftName) : '')), e: EMOJI[e.giftName] || '🎁', d: unit };
      const n = Math.min(count, 150), k = e.__add != null ? Math.min(e.__add, n) : n;
      for (let i = 0; i < k; i++) setTimeout(() => { addFish(g, true); save(); }, i * (k > 30 ? 60 : 140));
      if (e.__partial) return;
      if (window.VJLCollect) VJLCollect.record(e, n);
      const u = e.user || {}, id = u.uniqueId || u.nickname || '?';
      const row = ranking[id] || { n: u.nickname || id, a: u.avatar || '', c: 0 };
      row.c += value; row.n = u.nickname || row.n; row.a = u.avatar || row.a; ranking[id] = row;
      totalCoins += value;
      renderBoard(); if (!e.__quiet) showAlert(e, count); save();
      for (const el of [$total, $board]) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    }

    Overlay.on('state', (st) => { if (window.VJLCollect) VJLCollect.backfill(st, onGift); });
    if (window.VJLCollect && VJLCollect.live) VJLCollect.live(onGift); else Overlay.on('event', (e) => { if (e.type === 'gift' && !e.streaking) onGift(e); });

    if (TOP === 1) $board.classList.add('solo');
    addEventListener('resize', resize); resize();
    restore(); renderBoard();
    requestAnimationFrame(frame);

    if (!Overlay.connected && window.VJLCollect) { // เดโม (เปิดไฟล์ตรง ๆ / ?demo=1)
      VJLCollect.demoBurst(onGift);
      if (!SHOT) setInterval(() => onGift(VJLCollect.demoGift()), 1300);
    }
  }
})();
