/*
 * ลูกแก้วหิมะ (vg-*) / ตัวละครกินของขวัญ (vb-*) แบบภาพ GPT — เรียกจาก giftjar.html
 *   ภาพ: <globe|belly>/<ชื่อ>.webp (ช่องในลูกแก้ว/หน้าต่างท้อง = ใส) · วงรีของช่อง: <kind>/items.json (ell = cx,cy,rx,ry สัดส่วน)
 *   ลูกแก้ว: ของขวัญอยู่ในน้ำ — จมช้า ๆ มีแรงหนืด · ของใหม่มา = เขย่า น้ำหมุนวน ของ+หิมะลอยวนแล้วค่อย ๆ ตกตะกอน
 *   ท้อง: ของขวัญถูกโยนเข้าปาก (ลอดหลังหัว) แล้วตกลงกองในท้อง · ตัวละครยุบ-เด้งตอนกลืน
 *   ของเยอะ → ทุกชิ้นเล็กลง (ไม่ลบ) · เกิน MAX ชิ้นถูกสุด-เก่าสุดค่อยจาง (กองกลาง VJLCollect ยังเก็บครบ)
 */
(function () {
  window.VJLVessel = { start };

  function start(P, num) {
    const SHAPE = String(P('shape', 'vg-pastel')), KIND = SHAPE.startsWith('vb-') ? 'belly' : 'globe', NAME = SHAPE.slice(3), GLOBE = KIND === 'globe';
    const SCALE = num('scale', 1), GIFT_SCALE = num('giftScale', 1), OX = num('x', 0), OY = num('y', 0);
    const SHOW_ALERT = P('alert', '1') !== '0', ALERT_MS = num('alertSec', 5) * 1000;
    const SHOW_BOARD = P('board', '1') !== '0', TOP = Math.max(1, Math.min(10, num('top', 1))), BOARD_FULL = P('boardFormat', 'full') !== 'name';
    const SHOW_TOTAL = P('total', '0') === '1', MIN_COINS = num('minCoins', 0), SHOT = P('shot', '0') === '1';
    document.documentElement.style.setProperty('--font', `'${P('font', 'Kanit')}'`);
    document.documentElement.style.setProperty('--fs', String(num('fontSize', 50)));

    const canvas = document.getElementById('fx'), ctx = canvas.getContext('2d');
    let W = 0, H = 0; const DPR = Math.min(2, devicePixelRatio || 1);
    const V = '?v=' + (window.VJL_VERSION || '1');
    const art = new Image(); art.decoding = 'async'; art.src = KIND + '/' + NAME + '.webp' + V;
    let META = { w: 900, h: 1300, ell: GLOBE ? [0.5, 0.36, 0.44, 0.3] : [0.5, 0.6, 0.3, 0.2] };
    fetch(KIND + '/items.json' + V).then((r) => r.json()).then((m) => { if (m[NAME]) { META = { ...META, ...m[NAME] }; resize(); } }).catch(() => {});

    // ---- ผัง: กึ่งกลางล่างเหมือนโหล · สูงสุด 86% ของจอ ----
    let T = { x: 0, y: 0, w: 0, h: 0 }, E = { cx: 0, cy: 0, rx: 1, ry: 1 }, U = 1; // U = หน่วยขนาด (ความกว้างช่อง/1000)
    function resize() {
      W = innerWidth; H = innerHeight;
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR); canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      const ar = META.w / META.h; let th = Math.min(H * 0.86, (W * 0.9) / ar) * SCALE; const tw = th * ar;
      T = { x: W / 2 - tw / 2 + OX, y: H - th - Math.max(40, H * 0.05) - OY, w: tw, h: th };
      const e = META.ell; E = { cx: T.x + e[0] * tw, cy: T.y + e[1] * th, rx: e[2] * tw, ry: e[3] * th }; U = (E.rx * 2) / 1000;
      layoutUi(); updateDensity();
    }

    // ---- ของขวัญ ----
    const bodies = [], MAX = Math.round(Math.max(120, Math.min(600, 320 / (GIFT_SCALE * GIFT_SCALE))));
    const imgCache = {};
    const giftImg = (u) => { if (!u || !/^https:\/\//.test(u)) return null; let im = imgCache[u]; if (!im) { im = new Image(); im.crossOrigin = 'anonymous'; im.src = u; imgCache[u] = im; } return im; };
    const sizeFor = (window.Juice && Juice.sizeFor) || ((d, max = 4) => 1 + (max - 1) * Math.min(1, Math.log10(Math.max(1, d || 1)) / 4.5));
    const baseFor = (d) => Math.min(150, 64 * GIFT_SCALE * sizeFor(d, 3)); // หน่วย 1/1000 ของความกว้างช่อง
    let dens = 1;
    function updateDensity() { // พื้นที่ของขวัญรวม ≤ 55% ของช่อง → เกินแล้วทุกชิ้นเล็กลง
      let area = 0; for (const b of bodies) if (!b.dying) area += Math.PI * b.base * b.base;
      const room = Math.PI * 500 * 500 * (E.ry / Math.max(1, E.rx)) * 0.55;
      dens = Math.max(0.38, Math.min(1, Math.sqrt(room / Math.max(1, area))));
    }
    const R = (b) => b.base * dens * U * Math.min(1, (performance.now() - b.born) / 260 + 0.25);
    function addGift(g, live) {
      const alive = bodies.filter((k) => !k.dying);
      if (alive.length >= MAX) ((window.VJLCollect && VJLCollect.victims) ? VJLCollect.victims(bodies, 1) : [alive[0]]).forEach((k) => { k.dying = true; });
      const b = { g, img: giftImg(g.img), emoji: g.e || '🎁', d: g.d || 1, base: baseFor(g.d), born: performance.now(), life: 1, dying: false, rot: (Math.random() - 0.5) * 0.6, vr: 0, vx: 0, vy: 0, inside: !live };
      if (live) {
        if (GLOBE) { b.x = E.cx + (Math.random() - 0.5) * E.rx * 0.8; b.y = E.cy - E.ry * 0.7; b.vy = 40 * U * 10; b.inside = true; swirl = Math.min(0.9, swirl + (b.d >= 1000 ? 0.6 : b.d >= 100 ? 0.4 : 0.22)); }
        else { b.x = E.cx + (Math.random() - 0.5) * E.rx * 0.3; b.y = T.y - 60 * U * 10 * 0.1 - 40; b.vx = (Math.random() - 0.5) * 60; b.vy = -220 * Math.max(0.6, U * 3); }
      } else { // กู้คืน: วางในช่องเลย (ลูกแก้ว: ค่อย ๆ จม · ท้อง: กองลงไป)
        const a = Math.random() * 6.283, rr = Math.sqrt(Math.random()) * 0.8;
        b.x = E.cx + Math.cos(a) * rr * E.rx; b.y = E.cy + Math.sin(a) * rr * E.ry * (GLOBE ? 1 : 0.6) + (GLOBE ? 0 : E.ry * 0.3);
      }
      bodies.push(b); updateDensity();
    }

    // ---- หิมะ (ลูกแก้ว) ----
    const flakes = [];
    if (GLOBE) for (let i = 0; i < 130; i++) flakes.push({ u: Math.random() * 2 - 1, v: Math.random() * 2 - 1, vu: 0, vv: 0, s: 0.6 + Math.random() * 1.6, ph: Math.random() * 6.28 });
    let swirl = GLOBE ? 0.3 : 0, gulp = 0, gulpV = 0;

    // ---- ฟิสิกส์ ----
    function inEll(x, y, r) { const ax = Math.max(1, E.rx - r), ay = Math.max(1, E.ry - r); const dx = (x - E.cx) / ax, dy = (y - E.cy) / ay; return dx * dx + dy * dy; }
    function contain(b, r) {
      const ax = Math.max(1, E.rx - r), ay = Math.max(1, E.ry - r), dx = (b.x - E.cx) / ax, dy = (b.y - E.cy) / ay, q = Math.sqrt(dx * dx + dy * dy);
      if (q <= 1) return;
      b.x = E.cx + (dx / q) * ax; b.y = E.cy + (dy / q) * ay;
      let nx = dx / ax, ny = dy / ay; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl; // นอร์มอลของวงรี
      const vn = b.vx * nx + b.vy * ny;
      if (vn > 0) { b.vx -= vn * nx * (GLOBE ? 1.2 : 1.35); b.vy -= vn * ny * (GLOBE ? 1.2 : 1.35); b.vx *= 0.92; b.vr += (b.vx * ny - b.vy * nx) * 0.0015; }
    }
    function step(dt) {
      const t = performance.now() / 1000, sc = U * 10;
      swirl *= Math.pow(GLOBE ? 0.55 : 0.2, dt);
      gulpV += (-gulp * 220 - gulpV * 14) * dt; gulp += gulpV * dt;
      for (const b of bodies) {
        const r = R(b); b.r = r;
        if (b.dying) { b.life -= dt * 0.7; }
        if (GLOBE) {
          // น้ำ: จมช้า + หนืด + กระแสวน (ตามความแรงการเขย่า)
          const dx = b.x - E.cx, dy = b.y - E.cy;
          b.vx += (-dy / E.ry * swirl * 70 * sc + Math.sin(t * 0.8 + b.born) * 6 * sc) * dt;
          b.vy += (dx / E.rx * swirl * 70 * sc + (30 + Math.min(30, b.d / 200)) * sc) * dt; // วนรอบกลาง + จมช้า ๆ (ของแพงหนักกว่า จมเร็วนิด)
          const k = Math.pow(0.18, dt); b.vx *= k; b.vy *= k;
        } else {
          b.vy += 980 * Math.max(0.5, U * 2.2) * dt; b.vx *= Math.pow(0.6, dt);
        }
        b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt; b.vr *= Math.pow(GLOBE ? 0.5 : 0.25, dt);
        if (!b.inside) { if (b.vy > 0 && inEll(b.x, b.y, r) < 0.85) { b.inside = true; gulpV -= 2.6; } }
        else contain(b, r);
      }
      // ชนกัน (ตาราง)
      const live = bodies.filter((b) => b.inside), cell = Math.max(8, 70 * U), grid = new Map();
      for (const b of live) { const k = ((b.x / cell) | 0) + ',' + ((b.y / cell) | 0); (grid.get(k) || grid.set(k, []).get(k)).push(b); }
      for (let it = 0; it < 2; it++) for (const a of live) {
        const gx = (a.x / cell) | 0, gy = (a.y / cell) | 0;
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
          const arr = grid.get((gx + i) + ',' + (gy + j)); if (!arr) continue;
          for (const c of arr) {
            if (c === a || c.id < a.id) continue;
            const dx = c.x - a.x, dy = c.y - a.y, m = (a.r + c.r) * 0.86, d2 = dx * dx + dy * dy;
            if (d2 < m * m && d2 > 1e-6) { const d = Math.sqrt(d2), p = (m - d) / d * 0.5; a.x -= dx * p; a.y -= dy * p; c.x += dx * p; c.y += dy * p;
              const rv = (c.vx - a.vx) * dx / d + (c.vy - a.vy) * dy / d; if (rv < 0) { const imp = rv * 0.5; a.vx += imp * dx / d; a.vy += imp * dy / d; c.vx -= imp * dx / d; c.vy -= imp * dy / d; } }
          }
        }
      }
      for (const b of live) contain(b, b.r);
      for (let i = bodies.length - 1; i >= 0; i--) if (bodies[i].life <= 0) bodies.splice(i, 1);
      if (GLOBE) for (const f of flakes) { // หิมะ: ตามกระแสน้ำ แล้วค่อย ๆ ร่วงลงก้น
        f.vu += (-f.v * swirl * 1.4 + Math.sin(t * 0.9 + f.ph) * 0.05) * dt; f.vv += (f.u * swirl * 1.4 + 0.06) * dt;
        const k = Math.pow(0.3, dt); f.vu *= k; f.vv *= k; f.u += f.vu * dt; f.v += f.vv * dt;
        const q = Math.hypot(f.u, f.v); if (q > 0.97) { f.u *= 0.97 / q; f.v *= 0.97 / q; f.vu *= -0.3; f.vv *= -0.3; }
      }
    }
    let nid = 0; const _push = bodies.push.bind(bodies); bodies.push = (...a) => { a.forEach((b) => { b.id = nid++; }); return _push(...a); };

    // ---- วาด ----
    function drawGift(b) {
      const sz = b.r * 2.1, st = window.Juice && Juice.sticker ? Juice.sticker(b.img, sz * DPR) : null;
      if (st) { const q = sz * Juice.STICKER_PAD; ctx.drawImage(st, -q / 2, -q / 2, q, q); }
      else if (b.img && b.img.complete && b.img.naturalWidth) ctx.drawImage(b.img, -sz / 2, -sz / 2, sz, sz);
      else { ctx.font = Math.round(sz * 0.8) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.emoji, 0, 1); }
    }
    let last = performance.now();
    const fx = new Juice.Particles();
    function frame() {
      const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (innerWidth !== W || innerHeight !== H) resize();
      for (let i = 0; i < 2; i++) step(dt / 2);
      const t = now / 1000;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H); ctx.imageSmoothingQuality = 'high';
      // ตัวละครกลืน: ยุบ-ยืดรอบเท้า
      const gq = Math.max(-0.06, Math.min(0.06, gulp * 0.02)), bx = T.x + T.w / 2, by = T.y + T.h;
      ctx.save(); ctx.translate(bx, by); ctx.scale(1 + gq, 1 - gq); ctx.translate(-bx, -by);
      // พื้นในช่อง: ลูกแก้ว = น้ำใสอมฟ้า (เห็นไลฟ์ด้านหลังจาง ๆ) · ท้อง = สีพาสเทลนุ่ม
      ctx.save(); ctx.beginPath(); ctx.ellipse(E.cx, E.cy, E.rx + 2, E.ry + 2, 0, 0, 6.2832); ctx.clip();
      const g = ctx.createRadialGradient(E.cx - E.rx * 0.3, E.cy - E.ry * 0.4, E.rx * 0.1, E.cx, E.cy, E.rx * 1.1);
      if (GLOBE) { g.addColorStop(0, 'rgba(242,250,255,.5)'); g.addColorStop(1, 'rgba(170,215,245,.55)'); }
      else { g.addColorStop(0, 'rgba(255,250,246,.96)'); g.addColorStop(1, 'rgba(255,214,228,.96)'); }
      ctx.fillStyle = g; ctx.fillRect(E.cx - E.rx - 4, E.cy - E.ry - 4, E.rx * 2 + 8, E.ry * 2 + 8);
      for (const b of bodies) if (b.inside) { if (b.life > 0.5 && Juice.aura) Juice.aura(ctx, b.x, b.y, b.r, b.d, t); ctx.save(); ctx.globalAlpha = Math.max(0, b.life); ctx.translate(b.x, b.y); ctx.rotate(b.rot); drawGift(b); ctx.restore(); }
      if (GLOBE) { ctx.fillStyle = 'rgba(255,255,255,.92)'; for (const f of flakes) { ctx.beginPath(); ctx.arc(E.cx + f.u * E.rx, E.cy + f.v * E.ry, f.s * U * 3.2, 0, 6.2832); ctx.fill(); } }
      // แสงสะท้อนกระจก (โค้งบนซ้าย)
      ctx.globalAlpha = GLOBE ? 0.5 : 0.35; ctx.strokeStyle = '#fff'; ctx.lineCap = 'round'; ctx.lineWidth = E.rx * 0.05;
      ctx.beginPath(); ctx.ellipse(E.cx, E.cy, E.rx * 0.84, E.ry * 0.84, 0, Math.PI * 1.08, Math.PI * 1.38); ctx.stroke();
      ctx.lineWidth = E.rx * 0.025; ctx.beginPath(); ctx.ellipse(E.cx, E.cy, E.rx * 0.84, E.ry * 0.84, 0, Math.PI * 1.45, Math.PI * 1.52); ctx.stroke();
      ctx.restore(); ctx.globalAlpha = 1;
      // ของที่กำลังถูกโยนเข้าปาก: อยู่หลังตัวละคร (ภาพบังให้เหมือนลอดเข้าปาก)
      for (const b of bodies) if (!b.inside) { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot); drawGift(b); ctx.restore(); }
      if (art.complete && art.naturalWidth) ctx.drawImage(art, T.x, T.y, T.w, T.h);
      ctx.restore();
      fx.draw(ctx);
      requestAnimationFrame(frame);
    }
    setInterval(() => { if (document.hidden) { const now = performance.now(); step(Math.min(0.05, (now - last) / 1000)); last = now; } }, 250);

    // ---- UI: แจ้งเตือน / อันดับ / ยอดรวม (element เดียวกับโหลแก้ว) ----
    const $alert = document.getElementById('alert'), $board = document.getElementById('board'), $total = document.getElementById('total');
    function layoutUi() {
      const cx = T.x + T.w / 2;
      $alert.style.left = cx + 'px'; $alert.style.top = Math.max(4, T.y - 70) + 'px';
      $total.style.left = cx + 'px'; $total.style.top = Math.max(4, T.y - 30) + 'px';
      $board.style.left = cx + 'px'; $board.style.top = Math.min(H - 56, T.y + T.h + 4) + 'px';
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

    // ---- จำไว้ (คีย์เดียวกับแบบเดิมของวิดเจ็ตนั้น → สลับแบบแล้วอันดับไม่หาย) ----
    const KEY = (Overlay.widget === 'belly' ? 'vjl-belly:' : Overlay.widget === 'snowglobe' ? 'vjl-snowglobe:' : 'vjl-giftjar:') + (P('t', '') || P('username', 'demo')).slice(-24);
    let saveTimer = null, restoreUntil = 0;
    function saveNow() {
      if (performance.now() < restoreUntil) return;
      try { localStorage.setItem(KEY, JSON.stringify({ g: bodies.filter((b) => !b.dying).map((b) => b.g), r: ranking, t: totalCoins })); } catch { /* storage ปิด */ }
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
        list.forEach((g) => addGift({ img: g.img, e: g.e, d: g.d }, false));
      } catch { /* ignore */ }
    }

    const EMOJI = { Rose: '🌹', 'Finger Heart': '🫰', Perfume: '🧴', Galaxy: '🌌', Lion: '🦁', Universe: '🪐', Heart: '❤️', TikTok: '🎵' };
    function onGift(e) {
      const count = e.repeatCount || 1, unit = e.diamondCount || 0, value = e.totalValue || unit * count;
      if (unit < MIN_COINS) return;
      const g = { img: (e.giftImage || (window.VJLCollect ? VJLCollect.imgFor(e.giftName) : '')), e: EMOJI[e.giftName] || '🎁', d: unit };
      const n = Math.min(count, 150), k = e.__add != null ? Math.min(e.__add, n) : n;
      for (let i = 0; i < k; i++) setTimeout(() => { addGift(g, true); save(); }, i * (k > 30 ? 70 : 160));
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
    if (P('debug', '0') === '1') window.__vs = { bodies, E: () => E };

    if (TOP === 1) $board.classList.add('solo');
    addEventListener('resize', resize); resize();
    restore(); renderBoard();
    requestAnimationFrame(frame);

    if (!Overlay.connected && window.VJLCollect) {
      VJLCollect.demoBurst(onGift);
      if (!SHOT) setInterval(() => onGift(VJLCollect.demoGift()), 1300);
    }
  }
})();
