/**
 * mvpframe.js — แท่นกรอบรูปภาพ MVP (10 ธีม · mvp/frame-01..10.webp) ใช้ร่วมกันโดย pkmvp.html และ ranking.js (topgifters/toplikers)
 * ตำแหน่งช่องต่าง ๆ (ป้ายหัวข้อ · แคปซูลคะแนน ซ้าย/ขวา · วงรูป 3 วง · ป้ายชื่อ 3 ป้าย) วัดจากรูปจริง → mvp/frames.json (สัดส่วน 0–1)
 *
 *   MvpFrame.ready().then(() => {
 *     const f = MvpFrame.create(parentEl, '01', { width: 360 });
 *     f.setTitle('👑 MVP ของ PK'); f.setCaps('💖 120', '80 😈'); f.setTop([{ name, avatar, score }], '⚔️');
 *     f.highlight(true)  // เน้น MVP อันดับ 1 (จบ PK)
 *   });
 */
window.MvpFrame = (function () {
  const IDS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];
  let table = null, loading = null;
  const CSS = `
  .mvf{position:relative;-webkit-font-smoothing:antialiased;font-family:'Mali','Itim',sans-serif}
  .mvf .fimg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;filter:drop-shadow(0 6px 12px rgba(30,10,40,.35))}
  .mvf .av{position:absolute;z-index:1;border-radius:50%;overflow:hidden;display:grid;place-items:center;color:#fff;font-family:'Itim',sans-serif;font-weight:700;
    background:radial-gradient(circle at 35% 30%,#ffd6ea,#c9a8ff 70%);text-shadow:0 2px 3px rgba(80,20,80,.45)}
  .mvf .av img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .mvf .av.empty{background:radial-gradient(circle at 40% 30%,rgba(255,255,255,.55),rgba(255,255,255,.12) 70%);color:rgba(120,70,120,.55);text-shadow:none}
  .mvf .av.in{animation:mvfIn .55s cubic-bezier(.2,1.5,.4,1)}
  .mvf .txt{position:absolute;z-index:3;display:flex;align-items:center;justify-content:center;white-space:nowrap;overflow:hidden;line-height:1.05;font-weight:700;text-align:center}
  .mvf .ttl{font-family:'Itim',sans-serif}
  .mvf .cap{font-family:'Itim',sans-serif;font-variant-numeric:tabular-nums}
  .mvf .sc{position:absolute;z-index:3;transform:translate(-50%,-50%);padding:.12em .6em;border-radius:999px;white-space:nowrap;font-family:'Itim',sans-serif;font-weight:700;
    color:#fff;background:linear-gradient(180deg,rgba(60,20,60,.82),rgba(30,8,35,.82));border:1.5px solid rgba(255,230,160,.85);box-shadow:0 2px 6px rgba(0,0,0,.35);font-variant-numeric:tabular-nums}
  .mvf .sc:empty{display:none}
  .mvf .pop{animation:mvfPop .6s cubic-bezier(.2,1.6,.4,1)}
  .mvf .sc.pop{animation:mvfPopC .6s cubic-bezier(.2,1.6,.4,1)}
  .mvf .glow{position:absolute;z-index:0;border-radius:50%;pointer-events:none;background:radial-gradient(circle,rgba(255,226,120,.85),rgba(255,190,80,0) 70%);animation:mvfGlow 2.2s ease-in-out infinite}
  .mvf .spk{position:absolute;z-index:4;pointer-events:none;color:#fff6c2;text-shadow:0 0 6px #ffd76a,0 0 2px #fff;animation:mvfSpk 2.2s ease-in-out infinite}
  .mvf .crown{position:absolute;z-index:4;transform:translate(-50%,-50%);pointer-events:none;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4));animation:mvfBob 1.6s ease-in-out infinite}
  .mvf.hl .s0.av{box-shadow:0 0 0 3px #ffe17a,0 0 24px #ffcf5c}
  .mvf .tag{position:absolute;z-index:5;transform:translate(-50%,-50%);padding:.15em .8em;border-radius:999px;font-family:'Itim',sans-serif;font-weight:700;white-space:nowrap;
    color:#5a2b00;background:linear-gradient(180deg,#fff3b0,#ffc94a);border:2px solid #fff;box-shadow:0 3px 10px rgba(160,90,0,.45);animation:mvfIn .6s cubic-bezier(.2,1.5,.4,1)}
  @keyframes mvfIn{from{transform:scale(.3);opacity:0}to{transform:none;opacity:1}}
  @keyframes mvfPop{40%{transform:scale(1.3)}}
  @keyframes mvfPopC{0%{transform:translate(-50%,-50%)}40%{transform:translate(-50%,-50%) scale(1.35);box-shadow:0 0 0 3px #ffe17a,0 0 16px #ffcf5c}100%{transform:translate(-50%,-50%)}}
  @keyframes mvfGlow{50%{opacity:.45;transform:scale(1.08)}}
  @keyframes mvfSpk{0%,100%{opacity:0;transform:scale(.3) rotate(0)}50%{opacity:1;transform:scale(1) rotate(90deg)}}
  @keyframes mvfBob{50%{transform:translate(-50%,-62%) rotate(-6deg)}}`;

  function ready() {
    if (table) return Promise.resolve(table);
    if (!loading) {
      const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
      loading = fetch('mvp/frames.json').then((r) => r.json()).then((t) => (table = t)).catch(() => (table = {}));
    }
    return loading;
  }
  const fmt = (n) => (Math.round(Number(n)) || 0).toLocaleString('en-US');
  const firstChar = (n) => (Array.from(String(n || '?').trim())[0] || '?').toUpperCase();
  const okAvatar = (u) => typeof u === 'string' && /^(https:\/\/|avatars\/)/.test(u);

  /** ย่อตัวอักษรจนพอดีกล่อง */
  function fit(el, maxPx, minPx) {
    let s = maxPx; el.style.fontSize = s + 'px';
    for (let k = 0; k < 30 && s > minPx && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2); k++) { s *= 0.92; el.style.fontSize = s + 'px'; }
  }

  function create(parent, id, opts) {
    opts = opts || {};
    const F = table && (table[id] || table['01']);
    if (!F) return null;
    const W = opts.width || 360, H = Math.round(W / F.aspect);
    const root = document.createElement('div'); root.className = 'mvf'; root.style.width = W + 'px'; root.style.height = H + 'px';
    const px = (fx, fy) => [fx * W, fy * H];
    const boxEl = (b, cls, ink) => {
      const e = document.createElement('div'); e.className = 'txt ' + cls;
      const [x0, y0] = px(b[0], b[1]), [x1, y1] = px(b[2], b[3]), pad = (x1 - x0) * 0.04;
      Object.assign(e.style, { left: x0 + pad + 'px', top: y0 + 'px', width: (x1 - x0 - pad * 2) + 'px', height: (y1 - y0) + 'px', color: ink,
        textShadow: ink === '#fff' ? '0 1px 2px rgba(0,0,0,.85),0 0 6px rgba(0,0,0,.5)' : '0 1px 0 rgba(255,255,255,.9),0 0 4px rgba(255,255,255,.7)' });
      e._h = y1 - y0; root.appendChild(e); return e;
    };
    // รูปโปรไฟล์ (อยู่หลังกรอบ — กรอบเจาะรูใสไว้แล้ว)
    const slots = F.slots.map((s, i) => {
      const r = s.r * W * 1.06, [cx, cy] = px(s.cx, s.cy);
      const glow = document.createElement('div'); glow.className = 'glow'; glow.style.display = 'none';
      Object.assign(glow.style, { left: cx - r * 1.5 + 'px', top: cy - r * 1.5 + 'px', width: r * 3 + 'px', height: r * 3 + 'px' });
      const av = document.createElement('div'); av.className = 'av empty s' + i;
      Object.assign(av.style, { left: cx - r + 'px', top: cy - r + 'px', width: r * 2 + 'px', height: r * 2 + 'px', fontSize: r * 0.9 + 'px' });
      root.append(glow, av);
      return { s, av, glow, cx, cy, r, key: null, score: null };
    });
    const img = document.createElement('img'); img.className = 'fimg'; img.alt = ''; img.src = 'mvp/frame-' + F.id + '.webp'; root.appendChild(img);
    const ttl = boxEl(F.banner, 'ttl', F.bannerInk);
    const capL = boxEl(F.capL, 'cap', F.capInkL), capR = boxEl(F.capR, 'cap', F.capInkR);
    slots.forEach((o) => {
      o.nm = boxEl(o.s.name, 'nm', o.s.ink);
      o.sc = document.createElement('div'); o.sc.className = 'sc';
      const [x, y] = px(o.s.score[0], o.s.score[1]);
      Object.assign(o.sc.style, { left: x + 'px', top: y + 'px', fontSize: Math.max(10, W * (o.s.r > 0.11 ? 0.042 : 0.036)) + 'px' });
      root.appendChild(o.sc);
    });
    // ประกายรอบอันดับ 1 + มงกุฎเด้ง ๆ
    const one = slots[0];
    for (let k = 0; k < 7; k++) {
      const sp = document.createElement('span'); sp.className = 'spk'; sp.textContent = '✦';
      const a = (k / 7) * Math.PI * 2 + Math.random() * 0.5, rr = one.r * (1.18 + Math.random() * 0.22);
      Object.assign(sp.style, { left: one.cx + Math.cos(a) * rr - 6 + 'px', top: one.cy + Math.sin(a) * rr - 8 + 'px', animationDelay: (-Math.random() * 2.2).toFixed(2) + 's', fontSize: (W * 0.03 + Math.random() * W * 0.02) + 'px' });
      root.appendChild(sp);
    }
    parent.appendChild(root);

    let title = '', cl = '', cr = '', tag = null, crown = null;
    const api = {
      el: root, frame: F,
      setTitle(t) { if (t === title) return; title = t; ttl.textContent = t; fit(ttl, ttl._h * 0.62, 8); },
      setCaps(l, r, popSide) {
        if (l !== cl) { cl = l; capL.textContent = l; fit(capL, capL._h * 0.66, 7); }
        if (r !== cr) { cr = r; capR.textContent = r; fit(capR, capR._h * 0.66, 7); }
        const pe = popSide === 'l' ? capL : popSide === 'r' ? capR : null;
        if (pe) { pe.classList.remove('pop'); void pe.offsetWidth; pe.classList.add('pop'); }
      },
      /** list: [{ name, avatar, score }] เรียงมาก→น้อย · icon นำหน้าคะแนน */
      setTop(list, icon) {
        slots.forEach((o, i) => {
          const m = list[i];
          const key = m ? m.name + '|' + (m.avatar || '') : '';
          if (key !== o.key) {
            o.key = key; o.av.innerHTML = '';
            o.av.className = 'av s' + i + (m ? ' in' : ' empty');
            o.av.textContent = m ? firstChar(m.name) : (i + 1);
            if (m && okAvatar(m.avatar)) {
              const im = document.createElement('img'); im.alt = ''; im.referrerPolicy = 'no-referrer'; im.src = m.avatar; im.onerror = () => im.remove();
              o.av.appendChild(im);
            }
            o.nm.textContent = m ? m.name : '—'; fit(o.nm, o.nm._h * 0.6, 7);
            o.score = null;
          }
          const sc = m ? (icon ? icon + ' ' : '') + fmt(m.score) : '';
          if (sc !== o.score) {
            const rise = o.score !== null && m;
            o.score = sc; o.sc.textContent = sc;
            if (rise) { o.sc.classList.remove('pop'); void o.sc.offsetWidth; o.sc.classList.add('pop'); }
          }
        });
        one.glow.style.display = list[0] ? '' : 'none';
      },
      /** จบ PK: เน้น MVP อันดับ 1 (มงกุฎ + ป้าย) */
      highlight(on, label) {
        root.classList.toggle('hl', !!on);
        if (tag) { tag.remove(); tag = null; } if (crown) { crown.remove(); crown = null; }
        if (!on) return;
        crown = document.createElement('div'); crown.className = 'crown'; crown.textContent = '👑';
        Object.assign(crown.style, { left: one.cx + one.r * 0.78 + 'px', top: one.cy - one.r * 0.78 + 'px', fontSize: one.r * 0.62 + 'px' });
        tag = document.createElement('div'); tag.className = 'tag'; tag.textContent = label || '👑 MVP';
        Object.assign(tag.style, { left: one.cx + 'px', top: one.cy + one.r * 0.78 + 'px', fontSize: Math.max(11, W * 0.042) + 'px' });
        root.append(crown, tag);
      },
    };
    return api;
  }
  return { ready, create, IDS, has: (id) => IDS.includes(id) };
})();
