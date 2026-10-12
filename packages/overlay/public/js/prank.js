/* 😈 แกล้งวีเจ (fx.html → effect=prank · action.prank = ชื่อมุก) — 30 มุก สั้น ๆ 2–4 วิ น่ารัก ๆ ไม่น่ากลัว ไม่บังจอนาน
 * ใช้: VJLPrank.play({ key:'tomato', volume:1, caption:'🍅 mimi ปามะเขือเทศใส่วีเจ!', onBlocked(){...} }) → Promise (resolve ตอนจบ · โหลดรูปไม่ได้ = reject)
 * ภาพ: fx/prank/<ชื่อ>.webp (ตัดจาก docs/prank ด้วย overlay/scripts/slice-pranks.py) · เสียง: fx/sfx-prank/<ชื่อ>.mp3 (CC0 · ที่มา LICENSES.md)
 * ทำด้วย DOM + Web Animations (รูปวาดที่ความละเอียดจริงของจอ → คมทุก DPR) · หน่วยขนาด U = ด้านสั้นของจอ
 */
(function () {
  const VER = window.VJL_VERSION ? '?v=' + window.VJL_VERSION : '';
  const BASE = 'fx/prank/', SND = 'fx/sfx-prank/';
  const css = document.createElement('style');
  css.textContent =
    '.prk{position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:40}' +
    '.prk img,.prk i,.prk b,.prk em{position:absolute;display:block;pointer-events:none;will-change:transform,opacity}' +
    '.prk img{user-select:none;-webkit-user-drag:none}' +
    '.prk i{border-radius:50%}' +
    '.prk em{font-style:normal;line-height:1;font-family:"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif}' +
    // คำเสียงแบบการ์ตูน (โป๊ก! ปั้ง!)
    '.prk b{font:600 1px/1 Kanit,Mali,sans-serif;color:#fff36b;-webkit-text-stroke:.09em #e0337c;paint-order:stroke fill;text-shadow:0 .06em 0 rgba(120,30,80,.35);white-space:nowrap;transform-origin:50% 50%}' +
    '.prkcap{position:fixed;left:50%;top:9%;transform:translateX(-50%);pointer-events:none;z-index:41;width:max-content;max-width:min(86vw,900px);text-align:center;' +
    'font:700 min(3.4vh,6vw)/1.25 Mali,Itim,sans-serif;color:#fff;padding:.3em .9em;border-radius:1.2em;text-shadow:0 2px 0 rgba(120,40,120,.35);' +
    'background:linear-gradient(135deg,rgba(255,120,180,.92),rgba(157,134,232,.92));box-shadow:0 8px 22px rgba(120,60,150,.35)}';
  document.head.appendChild(css);

  // ---------- โหลดรูป/เสียง ----------
  const imgs = {};
  function loadImg(n) {
    if (imgs[n]) return imgs[n];
    return (imgs[n] = new Promise((ok, no) => {
      const im = new Image(); im.decoding = 'async';
      im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => ok(im));
      im.onerror = () => { delete imgs[n]; no(new Error('prank img ' + n)); };
      im.src = BASE + n + '.webp' + VER;
    }));
  }
  const snds = {};
  function sndBase(f) {
    if (!snds[f]) { const au = new Audio(SND + f + '.mp3' + VER); au.preload = 'auto'; au.onerror = () => { snds[f].bad = true; }; try { au.load(); } catch (e) {} snds[f] = { au, bad: false }; }
    return snds[f].bad ? null : snds[f].au;
  }

  // ---------- ตัวช่วย ----------
  const R = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const OUT = 'cubic-bezier(.2,.9,.3,1)', BACK = 'cubic-bezier(.3,1.6,.5,1)', IN = 'cubic-bezier(.5,0,.9,.4)';

  function ctx(o, sizes) {
    const W = innerWidth, H = innerHeight, U = Math.min(W, H);
    const root = document.createElement('div'); root.className = 'prk'; document.body.appendChild(root);
    const vol = Math.max(0, Math.min(1, o.volume == null ? 1 : o.volume));
    const timers = [];
    const c = {
      W, H, U, root,
      at(ms, fn) { timers.push(setTimeout(fn, ms)); },
      /** สไปรต์กว้าง w px จุดกึ่งกลางที่ (x,y) */
      img(n, w, x, y, z) {
        const s = sizes[n] || { w: 1, h: 1 }, h = w * s.h / s.w, el = document.createElement('img');
        el.src = BASE + n + '.webp' + VER; el.alt = ''; el.draggable = false;
        el.style.cssText = 'width:' + w + 'px;height:' + h + 'px;left:' + (x - w / 2) + 'px;top:' + (y - h / 2) + 'px;' + (z ? 'z-index:' + z + ';' : '');
        root.appendChild(el); el._w = w; el._h = h; return el;
      },
      emoji(ch, size, x, y) {
        const el = document.createElement('em'); el.textContent = ch;
        el.style.cssText = 'font-size:' + size + 'px;left:' + (x - size / 2) + 'px;top:' + (y - size / 2) + 'px;width:' + size + 'px;text-align:center';
        root.appendChild(el); return el;
      },
      dot(r, x, y, bg, extra) {
        const el = document.createElement('i');
        el.style.cssText = 'width:' + 2 * r + 'px;height:' + 2 * r + 'px;left:' + (x - r) + 'px;top:' + (y - r) + 'px;background:' + bg + ';' + (extra || '');
        root.appendChild(el); return el;
      },
      word(txt, size, x, y, rot) {
        const el = document.createElement('b'); el.textContent = txt; el.style.fontSize = size + 'px'; root.appendChild(el);
        const w = el.offsetWidth, h = el.offsetHeight; el.style.left = (x - w / 2) + 'px'; el.style.top = (y - h / 2) + 'px';
        el.animate([{ transform: 'scale(.2) rotate(' + (rot || 0) + 'deg)', opacity: 0 }, { transform: 'scale(1.25) rotate(' + (rot || 0) + 'deg)', opacity: 1, offset: .35 },
          { transform: 'scale(1) rotate(' + (rot || 0) + 'deg)', opacity: 1, offset: .55 }, { transform: 'scale(1.05) rotate(' + (rot || 0) + 'deg)', opacity: 1, offset: .85 }, { transform: 'scale(1.1) rotate(' + (rot || 0) + 'deg)', opacity: 0 }],
        { duration: 1100, easing: 'ease-out', fill: 'both' });
        return el;
      },
      anim(el, kf, dur, delay, easing) { return el.animate(kf, { duration: dur, delay: delay || 0, easing: easing || 'linear', fill: 'both' }); },
      sfx(f, ms, v) {
        c.at(ms || 0, () => {
          const base = sndBase(f); if (!base || vol <= 0) return;
          try { const au = base.cloneNode(); au.volume = Math.max(0, Math.min(1, vol * (v == null ? 1 : v)));
            const p = au.play(); if (p && p.catch) p.catch((e) => { if (e && e.name === 'NotAllowedError' && o.onBlocked) o.onBlocked(); }); } catch (e) {}
        });
      },
      /** สั่นทั้งจอ (เนื้อหาบนวิดเจ็ตนี้ทั้งหมด) */
      shake(ms, amp, delay) {
        const kf = []; const n = Math.max(6, Math.round(ms / 45));
        for (let i = 0; i <= n; i++) { const k = 1 - i / n, a = amp * k; kf.push({ transform: i === n ? 'none' : 'translate(' + R(-a, a) + 'px,' + R(-a, a) + 'px) rotate(' + R(-a, a) * .04 + 'deg)' }); }
        c.at(delay || 0, () => { try { document.body.animate(kf, { duration: ms, easing: 'linear' }); } catch (e) {} });
      },
      /** ดาววน/ดาวกระจาย รอบจุด (x,y) */
      stars(x, y, r, delay, n) {
        n = n || 6;
        for (let i = 0; i < n; i++) {
          const a0 = (i / n) * Math.PI * 2, s = U * R(.05, .075), el = c.emoji(pick(['⭐', '✨', '💫']), s, x, y);
          const kf = [];
          for (let k = 0; k <= 12; k++) { const t = k / 12, a = a0 + t * Math.PI * 1.6, rr = r * (.35 + .65 * Math.min(1, t * 3)); kf.push({ transform: 'translate(' + Math.cos(a) * rr + 'px,' + Math.sin(a) * rr * .45 + 'px) scale(' + (k === 0 ? .2 : 1) + ')', opacity: k === 12 ? 0 : 1 }); }
          c.anim(el, kf, 1300, delay || 0, 'ease-out');
        }
      },
      /** หยดกระเด็นออกจากจุด (x,y) */
      drops(x, y, n, color, rMax, delay) {
        for (let i = 0; i < n; i++) {
          const a = R(0, Math.PI * 2), d = U * R(.12, .3), r = U * R(.008, rMax || .022), el = c.dot(r, x, y, color);
          c.anim(el, [{ transform: 'translate(0,0) scale(.4)', opacity: 1 }, { transform: 'translate(' + Math.cos(a) * d + 'px,' + (Math.sin(a) * d + U * .12) + 'px) scale(1)', opacity: 0 }], R(500, 800), delay || 0, 'cubic-bezier(.2,.7,.5,1)');
        }
      },
      fadeAll(ms, at) { c.at(at, () => { root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, fill: 'forwards' }); }); },
      cleanup() { timers.forEach(clearTimeout); root.remove(); },
    };
    return c;
  }

  // ปาของใส่จอ: ลอยจากขอบจอ เข้าหากล้อง (โตขึ้น) แล้วกระแทกที่ (tx,ty)
  function throwIn(c, el, from, tx, ty, ms, delay, spin) {
    const sx = from === 'left' ? -c.W * .15 : from === 'right' ? c.W * 1.15 : c.W * R(.3, .7), sy = from === 'bottom' ? c.H * 1.1 : c.H * R(.55, .8);
    const r0 = el.getBoundingClientRect(), cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
    const dx0 = sx - cx, dy0 = sy - cy, dx1 = tx - cx, dy1 = ty - cy, mx = (dx0 + dx1) / 2, my = Math.min(dy0, dy1) - c.H * .18;
    const sp = spin == null ? 540 : spin;
    return c.anim(el, [
      { transform: 'translate(' + dx0 + 'px,' + dy0 + 'px) scale(.35) rotate(0deg)', opacity: 1 },
      { transform: 'translate(' + mx + 'px,' + my + 'px) scale(.75) rotate(' + sp / 2 + 'deg)', opacity: 1, offset: .5 },
      { transform: 'translate(' + dx1 + 'px,' + dy1 + 'px) scale(1.15) rotate(' + sp + 'deg)', opacity: 1, offset: .999 },
      { transform: 'translate(' + dx1 + 'px,' + dy1 + 'px) scale(1.15) rotate(' + sp + 'deg)', opacity: 0 },
    ], ms, delay, 'cubic-bezier(.35,.1,.6,1)');
  }
  // กระแทกแปะจอ (สควอช) แล้วค่อย ๆ ไหลลง
  function splatStick(c, el, delay, slide, hold, rot) {
    const T = (y, sx, sy) => 'translateY(' + y + 'px) rotate(' + (rot || 0) + 'deg) scale(' + sx + ',' + sy + ')';
    c.anim(el, [{ transform: T(0, .3, .3), opacity: 0 }, { transform: T(0, 1.25, .82), opacity: 1, offset: .12 }, { transform: T(0, .94, 1.06), opacity: 1, offset: .2 },
      { transform: T(0, 1, 1), opacity: 1, offset: .28 }, { transform: T(slide, .98, 1.08), opacity: 1, offset: .86 }, { transform: T(slide * 1.15, .97, 1.1), opacity: 0 }],
    hold, delay, 'ease-out');
  }
  /** transform รายการเดียวกันทุกคีย์เฟรม (หมุนหลายรอบไม่เพี้ยน) · ไม่ใช้ CSS rotate/scale แยก (OBS รุ่นเก่า Chromium 103 ไม่รองรับ) */
  const TR = (x, y, r, sx, sy) => 'translate(' + (x || 0) + 'px,' + (y || 0) + 'px) rotate(' + (r || 0) + 'deg) scale(' + (sx == null ? 1 : sx) + ',' + (sy == null ? (sx == null ? 1 : sx) : sy) + ')';

  // ---------- 30 มุก ----------
  // img = รูปที่ต้องโหลดก่อน · ms = ความยาวทั้งหมด
  const P = {
    crack: { img: ['crack'], ms: 3300, run(c) {
      const x = c.W * R(.3, .7), y = c.H * R(.3, .62), w = c.U * R(.72, .9), el = c.img('crack', w, x, y);
      c.sfx('glass-crack', 0);
      c.anim(el, [{ transform: 'scale(.55) rotate(' + R(-20, 20) + 'deg)', opacity: 0 }, { transform: 'scale(1.06)', opacity: 1, offset: .04 }, { transform: 'scale(1)', opacity: 1, offset: .08 }, { transform: 'scale(1)', opacity: 1, offset: .8 }, { transform: 'scale(1.02)', opacity: 0 }], 3200, 0, 'ease-out');
      const fl = c.dot(c.U * .25, x, y, 'radial-gradient(circle,rgba(255,255,255,.95),rgba(220,245,255,0) 70%)');
      c.anim(fl, [{ transform: 'scale(.3)', opacity: 1 }, { transform: 'scale(1.6)', opacity: 0 }], 260, 0, 'ease-out');
      c.shake(260, c.U * .012);
    } },
    tomato: { img: ['tomato'], ms: 3300, run(c) {
      const side = pick(['left', 'right']), tx = c.W * R(.35, .65), ty = c.H * R(.34, .5);
      const pj = c.emoji('🍅', c.U * .16, tx, ty); throwIn(c, pj, side, tx, ty, 460, 0);
      c.sfx('throw', 0); c.sfx('splat', 440);
      const sp = c.img('tomato', c.U * .62, tx, ty); splatStick(c, sp, 450, c.H * .1, 2800);
      c.drops(tx, ty, 10, '#ef2b1e', .02, 450);
    } },
    egg: { img: ['egg'], ms: 3300, run(c) {
      const side = pick(['left', 'right']), tx = c.W * R(.35, .65), ty = c.H * R(.32, .48);
      const pj = c.emoji('🥚', c.U * .14, tx, ty); throwIn(c, pj, side, tx, ty, 460, 0, 720);
      c.sfx('throw', 0); c.sfx('egg-crack', 420); c.sfx('splat', 470, .5);
      const sp = c.img('egg', c.U * .56, tx, ty); splatStick(c, sp, 450, c.H * .13, 2800);
      c.drops(tx, ty, 8, '#ffcc1a', .016, 450);
    } },
    pie: { img: ['pie', 'pie2'], ms: 3600, run(c) {
      const tx = c.W / 2, ty = c.H * .45, pj = c.img('pie', c.U * .5, tx, ty);
      c.anim(pj, [{ transform: 'translateY(' + c.H * .6 + 'px) scale(.3) rotate(-8deg)' }, { transform: 'translateY(' + c.H * .05 + 'px) scale(1.2) rotate(4deg)', offset: .8 }, { transform: 'translateY(0) scale(1.9) rotate(0deg)', opacity: 1, offset: .999 }, { transform: 'scale(1.9)', opacity: 0 }], 520, 0, 'cubic-bezier(.4,.1,.7,1)');
      c.sfx('throw', 0); c.sfx('splat-big', 500);
      const sp = c.img('pie2', c.U * 1.02, tx, ty); splatStick(c, sp, 520, c.H * .1, 3000);
      c.drops(tx, ty, 16, '#fffaf0', .03, 520); c.shake(300, c.U * .02, 520);
    } },
    slime: { img: ['slime'], ms: 3600, capLow: 1, run(c) {
      const w = c.W * 1.04, el = c.img('slime', w, c.W / 2, 0);
      const h = el._h; el.style.top = '0px'; el.style.transformOrigin = '50% 0';
      c.anim(el, [{ transform: 'translateY(-100%) scaleY(1)' }, { transform: 'translateY(0) scaleY(1)', offset: .18 }, { transform: 'translateY(0) scaleY(1.12)', offset: .3 },
        { transform: 'translateY(0) scaleY(1.45)', offset: .82 }, { transform: 'translateY(-110%) scaleY(1.2)' }], 3500, 0, 'ease-in-out');
      c.sfx('slime', 100); c.sfx('slime', 1500, .6);
      for (let i = 0; i < 4; i++) { const x = c.W * R(.1, .9), d = c.dot(c.U * R(.018, .03), x, h * .6, 'radial-gradient(circle at 35% 30%,#f4ff9c,#b6e800 60%,#86b000)');
        c.anim(d, [{ transform: 'translateY(0) scale(.6)', opacity: 0 }, { transform: 'translateY(0) scale(1)', opacity: 1, offset: .15 }, { transform: 'translateY(' + c.H + 'px) scale(1,1.4)', opacity: 1 }], R(1300, 1900), R(900, 1800), IN); }
    } },
    ink: { img: ['ink'], ms: 3300, run(c) {
      const n = 4;
      for (let i = 0; i < n; i++) {
        const x = c.W * R(.15, .85), y = c.H * R(.2, .75), el = c.img('ink', c.U * R(.32, .52), x, y), rot = R(0, 360), d = i * 260;
        c.anim(el, [{ transform: 'rotate(' + rot + 'deg) scale(.1)', opacity: 0 }, { transform: 'rotate(' + rot + 'deg) scale(1.18)', opacity: 1, offset: .06 }, { transform: 'rotate(' + rot + 'deg) scale(1)', opacity: 1, offset: .1 },
          { transform: 'rotate(' + rot + 'deg) scale(1.02)', opacity: 1, offset: .85 }, { transform: 'rotate(' + rot + 'deg) scale(1.04)', opacity: 0 }], 3200 - d, d, 'ease-out');
        c.sfx('splat', d, .8); c.drops(x, y, 5, '#8a2be2', .016, d);
      }
    } },
    paint: { img: ['paint'], ms: 3400, run(c) {
      const spots = [[R(.38, .62), R(.36, .5), .62], [R(.12, .3), R(.6, .78), .3], [R(.7, .88), R(.2, .32), .26]];
      spots.forEach(([fx, fy, s], i) => {
        const x = c.W * fx, y = c.H * fy, el = c.img('paint', c.U * s, x, y), d = i * 180;
        splatStick(c, el, d, c.H * (i ? .03 : .08), 3200 - d, R(-40, 40)); c.sfx('splat', d, i ? .6 : 1);
        if (!i) c.drops(x, y, 10, '#1e8fff', .022, d);
      });
    } },
    bugs: { img: ['roach'], ms: 3500, run(c) {
      const n = 6;
      for (let i = 0; i < n; i++) {
        const fromL = i % 2 === 0, y0 = c.H * R(.15, .85), y1 = c.H * R(.15, .85), s = c.U * R(.15, .22);
        const x0 = fromL ? -s : c.W + s, x1 = fromL ? c.W + s : -s, ang = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI + 180; // ภาพหันหัวไปซ้าย
        const el = c.img('roach', s, x0, y0), d = R(0, 1100), dur = R(1500, 2200), kf = [];
        for (let k = 0; k <= 10; k++) { const t = k / 10; kf.push({ transform: 'translate(' + (x1 - x0) * t + 'px,' + ((y1 - y0) * t + Math.sin(t * 9 + i) * c.U * .02) + 'px) rotate(' + (ang + (k % 2 ? 7 : -7)) + 'deg)' }); }
        c.anim(el, kf, dur, d);
      }
      c.sfx('scurry', 0, .9); c.sfx('scurry', 1400, .7);
    } },
    spider: { img: ['spider'], ms: 3300, run(c) {
      const x = c.W * R(.28, .72), s = c.U * .34, wrap = document.createElement('div');
      wrap.style.cssText = 'position:absolute;left:' + (x - s / 2) + 'px;top:0;width:' + s + 'px;will-change:transform';
      const th = document.createElement('div'); th.style.cssText = 'position:absolute;left:50%;bottom:92%;width:' + Math.max(1.5, c.U * .003) + 'px;margin-left:-1px;height:' + c.H * 1.5 + 'px;background:linear-gradient(rgba(220,220,230,.5),rgba(240,240,250,.95))';
      const el = c.img('spider', s, 0, 0); el.style.left = '0'; el.style.top = '0'; el.style.position = 'relative';
      wrap.appendChild(th); wrap.appendChild(el); c.root.appendChild(wrap);
      const yb = c.H * .34, top = -el._h * 1.2;
      c.anim(wrap, [{ transform: 'translateY(' + top + 'px)' }, { transform: 'translateY(' + yb * 1.08 + 'px)', offset: .2 }, { transform: 'translateY(' + yb * .9 + 'px)', offset: .3 }, { transform: 'translateY(' + yb * 1.03 + 'px)', offset: .4 },
        { transform: 'translateY(' + yb * .96 + 'px)', offset: .52 }, { transform: 'translateY(' + yb + 'px)', offset: .64 }, { transform: 'translateY(' + yb * .97 + 'px)', offset: .76 }, { transform: 'translateY(' + top + 'px)' }], 3200, 0, 'ease-in-out');
      c.anim(el, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(8deg)', offset: .35 }, { transform: 'rotate(-7deg)', offset: .5 }, { transform: 'rotate(5deg)', offset: .65 }, { transform: 'rotate(-3deg)', offset: .78 }, { transform: 'rotate(0deg)' }], 3200, 0, 'ease-in-out');
      el.style.transformOrigin = '50% 0';
      c.sfx('boing', 560); c.sfx('whoosh', 2500, .5);
    } },
    mosquito: { img: ['mosquito'], ms: 3300, run(c) {
      const s = c.U * .26, el = c.img('mosquito', s, c.W + s, c.H * .4), pts = [], n = 9;
      const x0 = c.W + s, y0 = c.H * .4;
      for (let k = 0; k <= n; k++) { const t = k / n, x = c.W * (1.1 - 1.25 * t) + Math.sin(t * 13) * c.U * .12, y = c.H * (.3 + .25 * Math.sin(t * 7.3)) + Math.cos(t * 17) * c.U * .06;
        pts.push({ transform: 'translate(' + (x - x0) + 'px,' + (y - y0) + 'px) rotate(' + Math.sin(t * 21) * 14 + 'deg) scaleX(' + (Math.cos(t * 13) > .85 ? -1 : 1) + ')' }); }
      c.anim(el, pts, 3200, 0, 'ease-in-out');
      c.sfx('buzz', 0, .8); c.sfx('buzz', 1500, .6);
    } },
    bomb: { img: ['bomb'], ms: 3500, run(c) {
      const x = c.W / 2, y = c.H * .48, el = c.img('bomb', c.U * .38, x, y), jit = [];
      for (let k = 0; k <= 20; k++) jit.push({ transform: 'translate(' + (k % 2 ? 1 : -1) * c.U * .008 * (k / 20) + 'px,0) rotate(' + (k % 2 ? 1 : -1) * (3 + k * .4) + 'deg) scale(' + (1 + k * .012) + ')' });
      c.anim(el, [{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1.12)', opacity: 1, offset: .6 }, { transform: 'scale(1)', opacity: 1 }], 320, 0, BACK);
      c.at(320, () => { const a = el.animate(jit, { duration: 1300, easing: 'linear', fill: 'both' }); a.onfinish = () => el.remove(); });
      c.sfx('fuse', 0, .9); c.sfx('boom', 1620);
      c.at(1620, () => {
        const cols = ['#fffbe0', '#ffe14d', '#ffa630', '#ff6a3d'];
        for (let i = 0; i < 4; i++) { const d = c.dot(c.U * (.42 - i * .07), x, y, 'radial-gradient(circle,' + cols[i] + ' 55%,rgba(255,180,80,0) 72%)');
          c.anim(d, [{ transform: 'scale(.1)', opacity: 1 }, { transform: 'scale(1.1)', opacity: 1, offset: .35 }, { transform: 'scale(1.35)', opacity: 0 }], 900 + i * 120, i * 40, 'ease-out'); }
        for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, d = c.dot(c.U * R(.07, .11), x, y, 'radial-gradient(circle at 40% 35%,#f4f0f6,#b9b0c4 70%)');
          c.anim(d, [{ transform: 'translate(0,0) scale(.3)', opacity: .95 }, { transform: 'translate(' + Math.cos(a) * c.U * .38 + 'px,' + (Math.sin(a) * c.U * .3 - c.U * .08) + 'px) scale(1.3)', opacity: 0 }], R(1100, 1500), 80, 'ease-out'); }
        c.word('ตู้มม!', c.U * .2, x, y - c.U * .02, -6);
      });
      c.shake(600, c.U * .03, 1620);
    } },
    chicken: { img: ['chicken'], ms: 3000, run(c) {
      const x = c.W * R(.35, .65), y = c.H * .62, el = c.img('chicken', c.U * .4, x, y);
      el.style.transformOrigin = '50% 100%';
      c.anim(el, [{ transform: 'translateY(' + c.H * .6 + 'px)' }, { transform: 'translateY(-' + c.H * .04 + 'px) scale(.95,1.08)', offset: .13 }, { transform: 'translateY(0) scale(1.06,.94)', offset: .2 },
        { transform: 'scale(.9,1.15) rotate(-6deg)', offset: .3 }, { transform: 'scale(1.08,.9) rotate(5deg)', offset: .4 }, { transform: 'scale(.9,1.15) rotate(-6deg)', offset: .5 }, { transform: 'scale(1.08,.9) rotate(5deg)', offset: .6 },
        { transform: 'scale(1,1) rotate(0)', offset: .82 }, { transform: 'translateY(' + c.H * .6 + 'px)' }], 2900, 0, 'ease-in-out');
      c.sfx('chicken', 380); c.sfx('chicken', 1250, .8);
      c.at(420, () => c.word('ก๊าาก!', c.U * .11, x + c.U * .22, y - c.U * .26, 10));
    } },
    hammer: { img: ['hammer'], ms: 2900, run(c) {
      const tx = c.W / 2, ty = c.H * .42, w = c.U * .55, el = c.img('hammer', w, 0, 0), h = el._h;
      el.style.left = (tx - w * .38) + 'px'; el.style.top = (ty - h * .3) + 'px'; el.style.transformOrigin = '82% 95%';
      c.anim(el, [{ transform: 'translate(' + c.W * .5 + 'px,' + c.H * .3 + 'px) rotate(60deg)', opacity: 1 }, { transform: 'rotate(45deg)', offset: .25 }, { transform: 'rotate(55deg)', offset: .35 },
        { transform: 'rotate(-4deg)', offset: .43 }, { transform: 'rotate(14deg)', offset: .52 }, { transform: 'rotate(0deg)', offset: .6 }, { transform: 'rotate(0deg)', offset: .8 }, { transform: 'translate(' + c.W * .5 + 'px,' + c.H * .3 + 'px) rotate(50deg)', opacity: 0 }], 2800, 0, 'ease-in-out');
      const hit = 2800 * .43; c.sfx('whoosh', hit - 260, .5); c.sfx('bonk', hit - 30);
      c.at(hit, () => { c.word('โป๊ก!', c.U * .14, tx + c.U * .05, ty - c.U * .2, -8); c.stars(tx, ty - c.U * .05, c.U * .22, 0, 6); });
      c.shake(260, c.U * .015, hit);
    } },
    slap: { img: ['hand'], ms: 2500, run(c) {
      const fromL = Math.random() < .5, w = c.U * .72, tx = c.W / 2, ty = c.H * .46, el = c.img('hand', w, tx, ty), sgn = fromL ? 1 : -1;
      const f = sgn; // ภาพมือตบไปทางขวา → มาจากขวา = กลับด้าน (scaleX -1)
      c.anim(el, [{ transform: TR(-sgn * c.W, 0, -sgn * 25, f, 1) }, { transform: TR(-sgn * c.W * .5, 0, -sgn * 20, f, 1), offset: .12 },
        { transform: TR(0, 0, 0, 1.05 * f, 1.05), offset: .2 }, { transform: TR(sgn * c.U * .02, 0, sgn * 4, f, 1), offset: .26 }, { transform: TR(0, 0, 0, f, 1), offset: .6 }, { transform: TR(-sgn * c.W, 0, -sgn * 30, f, 1) }], 2400, 0, 'ease-in-out');
      const hit = 2400 * .2; c.sfx('slap', hit - 20); c.shake(380, c.U * .03, hit);
      c.at(hit, () => c.word('เพี้ยะ!', c.U * .14, tx + sgn * c.U * .3, ty - c.U * .3, sgn * 8));
    } },
    nose: { img: ['nose'], ms: 2900, run(c) {
      const tx = c.W / 2, ty = c.H * .45, w = c.U * .34, el = c.img('nose', w, tx, ty), fromL = Math.random() < .5, sx = (fromL ? -1 : 1) * c.W * .6;
      const sp = fromL ? 1 : -1;
      c.anim(el, [{ transform: TR(sx, c.H * .1, 0) }, { transform: TR(sx * .66, -c.H * .2, sp * 120), offset: .1 },
        { transform: TR(sx * .4, c.H * .08, sp * 220, 1.1, .85), offset: .2 }, { transform: TR(sx * .18, -c.H * .1, sp * 300), offset: .28 },
        { transform: TR(0, 0, sp * 360, 1.15, .85), offset: .36 }, { transform: TR(0, 0, sp * 360), offset: .42 }, { transform: TR(0, 0, sp * 360), offset: .58 }, { transform: TR(0, 0, sp * 360, .8, 1.15), offset: .62 }, { transform: TR(0, 0, sp * 360, 1.1, .9), offset: .66 },
        { transform: TR(0, 0, sp * 360), offset: .72 }, { transform: TR(0, 0, sp * 360), offset: .86 }, { transform: TR(0, 0, sp * 360, .1), opacity: 0 }], 2800, 0, 'ease-in-out');
      c.sfx('boing', 2800 * .2, .5); c.sfx('honk', 2800 * .36); c.sfx('honk', 2800 * .6, .9);
      c.at(2800 * .36, () => c.word('ปู๊น!', c.U * .12, tx, ty - c.U * .22, -6));
    } },
    water: { img: ['bucket'], ms: 3200, run(c) {
      const w = c.U * .5, bx = c.W * .58, by = c.U * .34, el = c.img('bucket', w, bx, by);
      el.style.transformOrigin = '70% 40%';
      c.anim(el, [{ transform: 'translateY(-' + c.U * .6 + 'px) rotate(25deg)' }, { transform: 'translateY(0) rotate(15deg)', offset: .15 }, { transform: 'rotate(-12deg)', offset: .3 }, { transform: 'rotate(-8deg)', offset: .65 }, { transform: 'translateY(-' + c.U * .6 + 'px) rotate(10deg)' }], 3100, 0, 'ease-in-out');
      c.sfx('splash', 520);
      const sheet = document.createElement('i'); sheet.style.cssText = 'left:-5%;width:110%;top:0;height:' + c.H * 1.1 + 'px;border-radius:0 0 40% 40%/0 0 12% 12%;background:linear-gradient(180deg,rgba(120,200,255,0) 0,rgba(110,190,255,.55) 12%,rgba(80,160,250,.45) 70%,rgba(80,160,250,.6) 92%,rgba(80,160,250,0) 100%)';
      c.root.appendChild(sheet); c.anim(sheet, [{ transform: 'translateY(-110%)', opacity: 1 }, { transform: 'translateY(0)', opacity: .95, offset: .55 }, { transform: 'translateY(' + c.H * .3 + 'px)', opacity: 0 }], 1500, 480, 'cubic-bezier(.45,0,.75,.6)');
      for (let i = 0; i < 26; i++) { const x = c.W * R(.05, .95), d = c.dot(c.U * R(.008, .02), x, -c.U * .05, 'radial-gradient(circle at 35% 30%,#e9f7ff,#6cc0ff 70%)');
        c.anim(d, [{ transform: 'translateY(0) scale(1,1.4)', opacity: .95 }, { transform: 'translateY(' + c.H * 1.1 + 'px) scale(1,1.8)', opacity: .8 }], R(900, 1500), R(450, 1400), IN); }
    } },
    pigeon: { img: ['pigeon'], ms: 3500, run(c) {
      const fromL = Math.random() < .5, s = c.U * .32, y = c.H * .27, x0 = fromL ? -s : c.W + s, x1 = fromL ? c.W + s : -s;
      const el = c.img('pigeon', s, x0, y), f = fromL ? 1 : -1; // ภาพนกหันขวา
      const kf = []; for (let k = 0; k <= 16; k++) { const t = k / 16; kf.push({ transform: TR((x1 - x0) * t, Math.sin(t * Math.PI * 4) * c.U * .03, 0, f, k % 2 ? .82 : 1.06) }); }
      c.anim(el, kf, 2600, 0); c.sfx('flap', 0, .9);
      const dropX = c.W * R(.38, .62), tDrop = 2600 * Math.abs((dropX - x0) / (x1 - x0)), landY = c.H * R(.48, .6);
      const poo = c.dot(c.U * .022, dropX, y + s * .25, 'radial-gradient(circle at 35% 30%,#fff,#e9e9ef 70%)');
      c.anim(poo, [{ transform: 'translateY(0)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1, offset: .01 }, { transform: 'translateY(' + (landY - y - s * .25) + 'px) scale(.9,1.3)', opacity: 1, offset: .999 }, { transform: 'translateY(' + (landY - y - s * .25) + 'px)', opacity: 0 }], 520, tDrop, IN);
      c.sfx('plop', tDrop + 500); c.sfx('whoosh', tDrop - 100, .25);
      c.at(tDrop + 520, () => {
        const sp = document.createElement('i'), r = c.U * .07; // อึนกน่ารัก ๆ (หยดขาวมีขอบเทา)
        sp.style.cssText = 'left:' + (dropX - r) + 'px;top:' + (landY - r * .7) + 'px;width:' + 2 * r + 'px;height:' + 1.4 * r + 'px;border-radius:48% 52% 45% 55%/55% 50% 50% 45%;background:radial-gradient(circle at 40% 35%,#fff 0,#fbfbff 45%,#e2e2ea 75%,#c9c9d6 100%);box-shadow:0 2px 6px rgba(0,0,0,.18)';
        c.root.appendChild(sp); splatStick(c, sp, 0, c.H * .03, 3500 - tDrop - 600);
        c.drops(dropX, landY, 6, '#f6f6fb', .012, 0); c.word('ปุ๊!', c.U * .1, dropX + c.U * .12, landY - c.U * .1, 8);
      });
    } },
    snowball: { img: ['snowball'], ms: 3400, run(c) {
      for (let i = 0; i < 3; i++) {
        const tx = c.W * R(.25, .75), ty = c.H * R(.28, .62), d = i * 420, s = c.U * R(.2, .27), el = c.img('snowball', s, tx, ty);
        throwIn(c, el, pick(['left', 'right', 'bottom']), tx, ty, 420, d, 300);
        const smear = c.img('snowball', s, tx, ty);
        c.anim(smear, [{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1.5,.85)', opacity: 1, offset: .06 }, { transform: 'scale(1.35,.95)', opacity: .95, offset: .12 },
          { transform: 'translateY(' + c.H * .05 + 'px) scale(1.3,1.05)', opacity: .9, offset: .85 }, { transform: 'translateY(' + c.H * .06 + 'px) scale(1.3,1.05)', opacity: 0 }], 3400 - d - 420, d + 420, 'ease-out');
        c.drops(tx, ty, 9, '#f4fbff', .016, d + 420); c.sfx('throw', d, .7); c.sfx('snowball', d + 400);
      }
    } },
    kiss: { img: ['kiss'], ms: 3400, run(c) {
      const n = 5;
      for (let i = 0; i < n; i++) {
        const x = c.W * R(.15, .85), y = c.H * R(.2, .78), el = c.img('kiss', c.U * R(.2, .3), x, y), r = R(-25, 25), d = i * 360;
        c.anim(el, [{ transform: 'rotate(' + r + 'deg) scale(1.8)', opacity: 0 }, { transform: 'rotate(' + r + 'deg) scale(.92)', opacity: 1, offset: .05 }, { transform: 'rotate(' + r + 'deg) scale(1)', opacity: 1, offset: .09 },
          { transform: 'rotate(' + r + 'deg) scale(1)', opacity: 1, offset: .85 }, { transform: 'rotate(' + r + 'deg) scale(1.05)', opacity: 0 }], 3300 - d, d, 'ease-out');
        c.sfx('smooch', d, .9);
      }
      c.at(n * 360, () => c.word('จุ๊บ ๆ', c.U * .1, c.W / 2, c.H * .5, -5));
    } },
    notes: { img: ['note-yellow', 'note-pink'], ms: 3500, run(c) {
      const n = 6, cols = 3;
      for (let i = 0; i < n; i++) {
        const x = c.W * ((i % cols) + .5) / cols + R(-.06, .06) * c.W, y = c.H * (i < cols ? R(.28, .38) : R(.55, .68)), r = R(-14, 14), d = i * 230;
        const el = c.img(i % 2 ? 'note-pink' : 'note-yellow', c.U * R(.28, .34), x, y);
        c.anim(el, [{ transform: 'rotate(' + r + 'deg) scale(1.7)', opacity: 0 }, { transform: 'rotate(' + r + 'deg) scale(.96)', opacity: 1, offset: .05 }, { transform: 'rotate(' + r + 'deg) scale(1)', opacity: 1, offset: .08 },
          { transform: 'rotate(' + r + 'deg) scale(1)', opacity: 1, offset: .78 }, { transform: 'translateY(' + c.H * .5 + 'px) rotate(' + (r + R(-60, 60)) + 'deg)', opacity: 0 }], 3400 - d, d, 'ease-in');
        c.sfx('paper', d, .9);
      }
    } },
    tape: { img: ['tape'], ms: 3200, run(c) {
      const L = Math.hypot(c.W, c.H) * .62, cx = c.W / 2, cy = c.H * .47;
      [32, -32].forEach((ang, i) => {
        const wrap = document.createElement('div'), h = c.U * .2, d = 150 + i * 520;
        wrap.style.cssText = 'position:absolute;left:' + (cx - L / 2) + 'px;top:' + (cy - h / 2) + 'px;width:' + L + 'px;height:' + h + 'px;transform:rotate(' + ang + 'deg);will-change:transform';
        const el = c.img('tape', L, 0, 0); el.style.left = '0'; el.style.top = '0'; el.style.height = h + 'px'; el.style.transformOrigin = '0 50%';
        wrap.appendChild(el); c.root.appendChild(wrap);
        c.anim(el, [{ transform: 'scaleX(0)', opacity: 1 }, { transform: 'scaleX(1.02)', opacity: 1, offset: .1 }, { transform: 'scaleX(1)', opacity: 1, offset: .14 }, { transform: 'scaleX(1)', opacity: 1, offset: .84 }, { transform: 'translateY(-' + c.H * .4 + 'px) scaleX(1) rotate(-6deg)', opacity: 0 }], 3100 - d, d, 'ease-in-out');
        c.sfx('tape', d);
      });
      c.at(1100, () => c.word('ปิดปาก!', c.U * .1, cx, cy + c.U * .3, -4));
    } },
    balloon: { img: ['bubble', 'balloon-pop'], ms: 2900, run(c) {
      const x = c.W / 2, y = c.H * .5, w = c.U * .5, el = c.img('bubble', w, x, y);
      el.style.filter = 'hue-rotate(28deg) saturate(3.2) brightness(.78) contrast(1.1)'; // ชมพู → แดง
      const kf = [{ transform: 'scale(.15)', opacity: 0 }, { transform: 'scale(.3)', opacity: 1, offset: .08 }];
      for (let k = 1; k <= 6; k++) kf.push({ transform: 'scale(' + (.3 + k * .12) + ',' + (.3 + k * .12 + (k % 2 ? .04 : -.03)) + ') rotate(' + (k % 2 ? 3 : -3) + 'deg)', opacity: 1, offset: .08 + k * .1 });
      kf.push({ transform: 'scale(1.06) rotate(0deg)', opacity: 1, offset: .74 }, { transform: 'scale(1.1)', opacity: 1, offset: .999 }, { transform: 'scale(1.1)', opacity: 0 });
      c.anim(el, kf, 1700, 0, 'ease-out');
      c.sfx('squeak', 200, .45); c.sfx('squeak', 700, .45); c.sfx('squeak', 1200, .5); c.sfx('pop', 1690);
      c.at(1700, () => {
        const pp = c.img('balloon-pop', w * 1.1, x, y);
        c.anim(pp, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.25)', opacity: 0 }], 260, 0, 'ease-out');
        for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, s = c.dot(c.U * R(.012, .025), x, y, '#e8202e', 'border-radius:20% 60% 30% 50%');
          c.anim(s, [{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: 'translate(' + Math.cos(a) * c.U * .4 + 'px,' + (Math.sin(a) * c.U * .35 + c.U * .15) + 'px) rotate(' + R(-400, 400) + 'deg)', opacity: 0 }], R(600, 900), 0, 'ease-out'); }
        c.word('ปั้ง!', c.U * .18, x, y, -6);
      });
      c.shake(220, c.U * .012, 1700);
    } },
    alarm: { img: ['alarm'], ms: 2700, run(c) {
      const x = c.W / 2, y = c.H * .42, el = c.img('alarm', c.U * .42, x, y), kf = [{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1.1)', opacity: 1, offset: .08 }];
      for (let k = 0; k < 30; k++) kf.push({ transform: 'translate(' + (k % 2 ? 1 : -1) * c.U * .01 + 'px,' + (k % 3 - 1) * c.U * .006 + 'px) rotate(' + (k % 2 ? 9 : -9) + 'deg)', opacity: 1, offset: .1 + k * .025 });
      kf.push({ transform: 'scale(1)', opacity: 1, offset: .88 }, { transform: 'scale(.6)', opacity: 0 });
      c.anim(el, kf, 2600, 0);
      c.sfx('alarm', 200);
      c.at(500, () => c.word('ตื่นนน!', c.U * .13, x, y + c.U * .3, 5));
    } },
    fart: { img: ['cushion', 'fart-cloud'], ms: 3400, run(c) {
      const x = c.W * .45, y = c.H * .7, w = c.U * .36, el = c.img('cushion', w, x, y);
      c.anim(el, [{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1.05)', opacity: 1, offset: .1 }, { transform: 'scale(1)', offset: .16 }, { transform: 'scale(1.25,.55)', offset: .26 }, { transform: 'scale(1.18,.6)', offset: .5 },
        { transform: 'scale(1,1)', offset: .62 }, { transform: 'scale(1,1)', opacity: 1, offset: .88 }, { transform: 'scale(.6)', opacity: 0 }], 3300, 0, 'ease-out');
      c.sfx('fart', 760);
      for (let i = 0; i < 3; i++) {
        const cl = c.img('fart-cloud', c.U * (.42 - i * .1), x + w * .45, y), d = 820 + i * 160, dx = c.U * (.25 + i * .12), dy = -c.H * (.22 + i * .08);
        c.anim(cl, [{ transform: 'translate(0,0) scale(.2)', opacity: 0 }, { transform: 'translate(' + dx * .4 + 'px,' + dy * .3 + 'px) scale(1)', opacity: .95, offset: .25 },
          { transform: 'translate(' + dx * .8 + 'px,' + dy * .75 + 'px) scale(1.15) rotate(' + R(-8, 8) + 'deg)', opacity: .9, offset: .7 }, { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(1.35)', opacity: 0 }], 2400 - i * 160, d, 'ease-out');
      }
      c.at(800, () => c.word('ปู้ด~', c.U * .11, x - c.U * .15, y - c.U * .2, -8));
    } },
    ghost: { img: ['ghost'], ms: 3000, run(c) {
      const x = c.W * R(.4, .6), y = c.H * .48, el = c.img('ghost', c.U * .62, x, y);
      c.anim(el, [{ transform: 'translateY(' + c.H * .25 + 'px) scale(.4)', opacity: 0 }, { transform: 'translateY(-' + c.H * .02 + 'px) scale(1.18)', opacity: 1, offset: .1 }, { transform: 'translateY(0) scale(1)', opacity: 1, offset: .16 },
        { transform: 'translate(' + c.U * .03 + 'px,-' + c.H * .02 + 'px) rotate(4deg)', opacity: 1, offset: .38 }, { transform: 'translate(-' + c.U * .03 + 'px,' + c.H * .01 + 'px) rotate(-4deg)', opacity: 1, offset: .58 },
        { transform: 'translate(0,0) rotate(0)', opacity: 1, offset: .72 }, { transform: 'translateY(-' + c.H * .35 + 'px) scale(.8)', opacity: 0 }], 2900, 0, 'ease-in-out');
      c.sfx('whoosh', 0, .6); c.sfx('boo', 240); c.sfx('whoosh', 2200, .4);
      c.at(260, () => c.word('BOO!', c.U * .2, x, y - c.U * .38, -6));
    } },
    banana: { img: ['banana'], ms: 2900, run(c) {
      const fromR = Math.random() < .5, x = c.W * .5, y = c.H * .8, w = c.U * .36, el = c.img('banana', w, x, y), sg = fromR ? 1 : -1;
      c.anim(el, [{ transform: TR(sg * c.W * .7, 0, sg * 40) }, { transform: TR(0, 0, 0), offset: .22 }, { transform: TR(-sg * c.U * .02, 0, -sg * 4), offset: .27 },
        { transform: TR(0, 0, 0), offset: .38 }, { transform: TR(-sg * c.U * .03, c.U * .01, 0, 1.1, .85), offset: .42 },
        { transform: TR(-sg * c.W * .3, -c.H * .45, -sg * 540), offset: .75 }, { transform: TR(-sg * c.W * .7, -c.H * .3, -sg * 900), opacity: 0 }], 2800, 0, 'ease-in-out');
      c.sfx('throw', 0, .5); c.sfx('slide', 2800 * .4);
      c.at(2800 * .42, () => { c.word('ลื่นนน!', c.U * .13, x, y - c.U * .3, sg * 8); for (let i = 0; i < 3; i++) { const l = c.dot(c.U * .012, x - sg * c.U * (.1 + i * .06), y - c.U * .04 * i, 'rgba(255,255,255,.85)', 'width:' + c.U * .12 + 'px;border-radius:9px');
        c.anim(l, [{ transform: 'translateX(0)', opacity: 0 }, { transform: 'translateX(' + sg * c.U * .05 + 'px)', opacity: .9, offset: .3 }, { transform: 'translateX(' + sg * c.U * .12 + 'px)', opacity: 0 }], 500, i * 60, 'ease-out'); } });
    } },
    duck: { img: ['duck'], ms: 3500, run(c) {
      const n = 12;
      for (let i = 0; i < n; i++) {
        const s = c.U * R(.12, .2), x = c.W * ((i + R(.1, .9)) / n), d = R(0, 1500), r0 = R(-30, 30), el = c.img('duck', s, x, -s);
        const f = Math.random() < .5 ? -1 : 1;
        c.anim(el, [{ transform: TR(0, 0, r0, f, 1) }, { transform: TR(0, c.H + s * 2, r0 + R(-200, 200), f, 1) }], R(1500, 2000), d, IN);
        if (i % 2 === 0) c.sfx('duck', d + 300, .7);
      }
    } },
    pan: { img: ['pan'], ms: 2700, run(c) {
      const tx = c.W / 2, ty = c.H * .42, w = c.U * .6, el = c.img('pan', w, 0, 0), h = el._h;
      el.style.left = (tx - w * .35) + 'px'; el.style.top = (ty - h * .62) + 'px'; el.style.transformOrigin = '90% 8%';
      c.anim(el, [{ transform: 'translate(' + c.W * .6 + 'px,-' + c.H * .2 + 'px) rotate(70deg)', opacity: 1 }, { transform: 'rotate(55deg)', offset: .2 }, { transform: 'rotate(65deg)', offset: .3 },
        { transform: 'rotate(-6deg)', offset: .38 }, { transform: 'rotate(10deg)', offset: .46 }, { transform: 'rotate(0deg)', offset: .54 }, { transform: 'rotate(0deg)', offset: .78 }, { transform: 'translate(' + c.W * .6 + 'px,-' + c.H * .2 + 'px) rotate(60deg)', opacity: 0 }], 2600, 0, 'ease-in-out');
      const hit = 2600 * .38; c.sfx('whoosh', hit - 260, .5); c.sfx('pan', hit - 20);
      c.at(hit, () => { c.word('โป๊ง!', c.U * .16, tx - c.U * .12, ty - c.U * .25, -8); c.stars(tx, ty - c.U * .02, c.U * .24, 0, 7); });
      c.shake(320, c.U * .02, hit);
    } },
    jail: { img: ['jail'], ms: 3200, run(c) {
      const el = c.img('jail', c.W, c.W / 2, c.H / 2); el.style.height = c.H + 'px'; el.style.top = '0'; el.style.opacity = '.96';
      c.anim(el, [{ transform: 'translateY(-100%)' }, { transform: 'translateY(0)', offset: .09 }, { transform: 'translateY(-3%)', offset: .13 }, { transform: 'translateY(0)', offset: .17 }, { transform: 'translateY(0)', offset: .78 }, { transform: 'translateY(-100%)' }], 3100, 0, 'ease-in');
      c.sfx('jail', 160); c.shake(320, c.U * .02, 280);
      c.at(500, () => c.word('ติดคุก!', c.U * .15, c.W / 2, c.H * .5, -4));
    } },
    quake: { img: [], ms: 2700, run(c) {
      c.sfx('rumble', 0);
      c.shake(2200, c.U * .045, 0);
      for (let i = 0; i < 14; i++) { const x = c.W * R(.05, .95), r = c.U * R(.015, .04), d = c.dot(r, x, -r * 2, 'radial-gradient(circle at 35% 30%,#c9b8a8,#8b7363 70%,#5e4a3e)', 'border-radius:' + R(30, 60) + '% ' + R(40, 70) + '% ' + R(30, 60) + '% ' + R(40, 70) + '%');
        c.anim(d, [{ transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(' + (c.H + r * 4) + 'px) rotate(' + R(-300, 300) + 'deg)' }], R(900, 1400), R(100, 1300), IN); }
      for (let i = 0; i < 6; i++) { const x = c.W * R(.05, .95), d = c.dot(c.U * R(.06, .1), x, c.H * R(.88, .98), 'radial-gradient(circle,rgba(210,195,180,.75),rgba(210,195,180,0) 70%)');
        c.anim(d, [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1, offset: .3 }, { transform: 'translateY(-' + c.U * .08 + 'px) scale(1.6)', opacity: 0 }], 1300, R(200, 1200), 'ease-out'); }
      c.at(150, () => c.word('แผ่นดินไหว!!', c.U * .12, c.W / 2, c.H * .5, -3));
    } },
  };

  async function play(o) {
    const key = P[o && o.key] ? o.key : 'tomato', p = P[key];
    const list = await Promise.all(p.img.map(loadImg));
    const sizes = {}; p.img.forEach((n, i) => { sizes[n] = { w: list[i].naturalWidth, h: list[i].naturalHeight }; });
    const c = ctx(o || {}, sizes);
    let cap = null;
    if (o && o.caption) { cap = document.createElement('div'); cap.className = 'prkcap'; cap.textContent = o.caption; if (p.capLow) { cap.style.top = 'auto'; cap.style.bottom = '12%'; } /* มุกที่ไหลจากขอบบน → ข้อความไว้ล่าง */ document.body.appendChild(cap);
      cap.animate([{ opacity: 0, transform: 'translateX(-50%) scale(.7)' }, { opacity: 1, transform: 'translateX(-50%) scale(1.06)', offset: .1 }, { opacity: 1, transform: 'translateX(-50%) scale(1)', offset: .16 }, { opacity: 1, transform: 'translateX(-50%) scale(1)', offset: .88 }, { opacity: 0, transform: 'translateX(-50%) scale(.95)' }],
        { duration: p.ms + 400, fill: 'both' }); }
    try { p.run(c); } catch (e) { c.cleanup(); if (cap) cap.remove(); throw e; }
    return new Promise((ok) => setTimeout(() => { c.cleanup(); if (cap) cap.remove(); ok(); }, p.ms + 400));
  }

  const KEYS = Object.keys(P);
  window.VJLPrank = {
    play, KEYS,
    /** โหลดรูป+เสียงล่วงหน้า (ตอนอัดตัวอย่าง/ตอนวีเจตั้งกฎ) */
    preload: (k) => Promise.all((P[k] ? P[k].img : []).map(loadImg)).then(() => true),
  };
})();
