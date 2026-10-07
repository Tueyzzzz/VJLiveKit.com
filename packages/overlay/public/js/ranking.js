/**
 * ranking.js — ป้ายอันดับแบบกระจกโปร่งแสง ใช้ร่วมกันโดย topgifters.html / toplikers.html
 * ใช้คู่กับ overlay-client.js · เซิร์ฟเวอร์ส่งอันดับสะสมทั้งไลฟ์มากับ state (เปิด/รีเฟรชกลางไลฟ์ได้ครบ)
 *
 * พารามิเตอร์ URL:
 *   ?max=5        จำนวนอันดับ (1–20)
 *   ?label=...    หัวข้อ
 *   ?bg=35        ความทึบพื้นหลัง % (0 = ใสทั้งหมด)
 *   ?pos=tr       ตำแหน่ง tr | tl | br | bl (บนขวา/บนซ้าย/ล่างขวา/ล่างซ้าย)
 *   ?reset=1      ล้างอันดับที่จำไว้ (ปกติล้างเองเมื่อเริ่มไลฟ์ใหม่)
 *   ?list=false   ซ่อนรายการอันดับ 4 ลงไป (เหลือแค่แท่น Top 3)
 *   ?frames=a     แท่น Top 3: a | b (พระราชวัง) | gaming | singer | toy | off
 *
 * Ranking.mount({ mode: 'gifts' | 'likes', title, icon })
 */
window.Ranking = (function () {
  const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Itim&family=Mali:wght@500;700&display=swap');
  html,body{margin:0;width:100%;height:100%;background:transparent;overflow:hidden;font-family:'Mali','Itim',sans-serif}
  #board{position:fixed;width:min(340px,80vw);background:rgba(25,12,35,var(--bg,.35));border:1.5px solid rgba(255,255,255,.35);
    border-radius:22px;padding:14px 16px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
  #board.clear{border-color:transparent;backdrop-filter:none;-webkit-backdrop-filter:none;padding:0}
  #board.tr{top:20px;right:20px} #board.tl{top:20px;left:20px} #board.br{bottom:20px;right:20px} #board.bl{bottom:20px;left:20px}
  .tt{font-family:'Itim',sans-serif;font-size:20px;color:#fff;margin:0 0 8px;text-shadow:0 2px 4px rgba(0,0,0,.6)}
  ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px}
  li{display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:14px;background:rgba(255,255,255,.12)}
  li.bump{animation:bump .5s ease}
  @keyframes bump{50%{transform:scale(1.04);background:rgba(255,106,168,.35)}}
  .rk{width:26px;text-align:center;font-family:'Itim',sans-serif;font-size:18px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.6)}
  .ava{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;color:#fff;font-family:'Itim',sans-serif;background-size:cover;background-position:center;flex:none;border:2px solid rgba(255,255,255,.7)}
  .nm{flex:1;min-width:0;font-size:16px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.7);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .val{font-family:'Itim',sans-serif;font-size:15px;color:#ffd76a;text-shadow:0 1px 3px rgba(0,0,0,.7);font-variant-numeric:tabular-nums}
  .empty{font-size:14px;color:rgba(255,255,255,.8);background:none;text-shadow:0 1px 3px rgba(0,0,0,.6)}
  /* ---- แท่น Top 3: กรอบพระราชวัง (ที่ 1) · องครักษ์ (ที่ 2–3) — รูปโปรไฟล์ขยับทั้งรูป ไม่แก้หน้าตา ---- */
  #board.pod{width:min(400px,94vw)}
  .podium{display:flex;justify-content:center;align-items:flex-end;margin:2px 0 8px;perspective:600px}
  .pd{position:relative;display:flex;flex-direction:column;align-items:center;width:var(--w);margin:0 -6px}
  .pd.p1{--w:150px;z-index:2} .pd.p2,.pd.p3{--w:118px;margin-bottom:10px}
  .pf{position:relative;width:var(--w);height:var(--w);animation:pfFloat 3.2s ease-in-out infinite}
  .pd.p2 .pf{animation:pfSway 2.6s ease-in-out infinite;transform-origin:50% 90%} .pd.p3 .pf{animation:pfSway 2.6s ease-in-out -1.3s infinite;transform-origin:50% 90%}
  .pa{position:absolute;border-radius:50%;background:#3a2350 center/cover no-repeat;display:grid;place-items:center;color:#fff;font-family:'Itim',sans-serif;
    animation:paLook 6s ease-in-out infinite, paBreath 2.4s ease-in-out infinite;transform-style:preserve-3d}
  .pa::after{content:'';position:absolute;inset:0;border-radius:50%;background:linear-gradient(115deg,transparent 35%,rgba(255,255,255,.45) 50%,transparent 65%) -150% 0/250% 100% no-repeat;animation:paGloss 6s ease-in-out infinite}
  .pfi{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;filter:drop-shadow(0 6px 10px rgba(40,10,50,.45))}
  .pshine{position:absolute;inset:0;pointer-events:none;-webkit-mask:var(--m) center/100% 100% no-repeat;mask:var(--m) center/100% 100% no-repeat;
    background:linear-gradient(110deg,transparent 40%,rgba(255,255,230,.85) 50%,transparent 60%) -120% 0/260% 100% no-repeat;animation:pShine 3.5s ease-in-out infinite;mix-blend-mode:screen}
  .pd.p2 .pshine{animation-delay:1.1s} .pd.p3 .pshine{animation-delay:2.2s}
  .prib{position:absolute;left:22%;right:22%;display:flex;align-items:center;justify-content:center;font-family:'Itim',sans-serif;font-weight:700;white-space:nowrap;overflow:hidden;line-height:1}
  .pval{margin-top:1px;font-family:'Itim',sans-serif;font-size:15px;color:#ffd76a;text-shadow:0 1px 3px rgba(0,0,0,.8);font-variant-numeric:tabular-nums}
  .pd.p1 .pval{font-size:17px}
  .spk{position:absolute;color:#fff6c2;text-shadow:0 0 6px #ffd76a;pointer-events:none;animation:spk 2.2s ease-in-out infinite;font-size:12px}
  .pd.crown .pf{animation:pfThrone 1.4s cubic-bezier(.2,1.4,.4,1), pfFloat 3.2s ease-in-out 1.4s infinite}
  .burst{position:absolute;left:50%;top:45%;width:10px;height:10px;border-radius:50%;pointer-events:none;transform:translate(-50%,-50%);
    box-shadow:0 0 0 0 rgba(255,215,106,.9);animation:burst 1.2s ease-out forwards}
  @keyframes pfFloat{50%{transform:translateY(-5px)}}
  @keyframes pfSway{0%,100%{transform:rotate(-2.2deg)}50%{transform:rotate(2.2deg)}}
  @keyframes paLook{0%,100%{transform:rotateY(0) rotateX(0)}20%{transform:rotateY(14deg) rotateX(-3deg)}45%{transform:rotateY(0)}70%{transform:rotateY(-14deg) rotateX(3deg)}}
  @keyframes paBreath{50%{scale:1.035}}
  @keyframes paGloss{0%,60%{background-position:-150% 0}85%,100%{background-position:150% 0}}
  @keyframes pShine{0%,55%{background-position:-120% 0}85%,100%{background-position:140% 0}}
  @keyframes spk{0%,100%{opacity:0;transform:scale(.4) rotate(0)}50%{opacity:1;transform:scale(1) rotate(90deg)}}
  @keyframes pfThrone{0%{transform:translateY(60px) scale(.5);opacity:0}60%{transform:translateY(-14px) scale(1.12);opacity:1}100%{transform:none}}
  @keyframes burst{to{box-shadow:0 0 0 90px rgba(255,215,106,0);opacity:0}}
  /* ---- มินิมอล: วงแหวนโลหะบาง ๆ วาดด้วยโค้ด (ทอง/เงิน/ทองแดง) ---- */
  .mring{position:absolute;inset:14%;border-radius:50%;padding:var(--bw,4px);background:conic-gradient(from var(--a,0deg),var(--c1),var(--c2),var(--c1),var(--c3),var(--c1));
    -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);
    animation:mspin 6s linear infinite;box-shadow:0 0 18px var(--glow)}
  @property --a{syntax:'<angle>';inherits:false;initial-value:0deg}
  @keyframes mspin{to{--a:360deg}}
  .mhalo{position:absolute;inset:8%;border-radius:50%;border:1px solid var(--c1);opacity:.45}
  .mcrown{position:absolute;left:50%;top:-1%;width:30%;transform:translateX(-50%);filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));animation:mcrown 2.4s ease-in-out infinite}
  @keyframes mcrown{50%{transform:translateX(-50%) translateY(-4px) rotate(-4deg)}}
  .mbadge{position:absolute;left:50%;bottom:8%;transform:translateX(-50%);min-width:22%;height:16%;padding:0 6%;border-radius:999px;display:grid;place-items:center;
    background:linear-gradient(135deg,var(--c2),var(--c1) 55%,var(--c3));color:#2b1a10;font-family:'Itim',sans-serif;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.35)}
  .mname{margin-top:2px;max-width:100%;font-family:'Itim',sans-serif;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`;
  /** กรอบ: ตำแหน่งรูของรูปโปรไฟล์ (สัดส่วนของรูปกรอบ) + แถบริบบิ้นใส่ชื่อ — วัดจากรูปจริง */
  const FRAMES = {
    r1: { cx: .5001, cy: .5221, r: .25, rib: .845, ribH: .095, ink: '#fff', sh: 'rgba(120,0,20,.7)' },
    r2: { cx: .4997, cy: .5097, r: .26, rib: .862, ribH: .09, ink: '#173a6b', sh: 'rgba(255,255,255,.6)' },
    r3: { cx: .4995, cy: .4934, r: .28, rib: .868, ribH: .09, ink: '#6b2f1e', sh: 'rgba(255,255,255,.6)' },
    r1b: { cx: .5006, cy: .5292, r: .265, rib: .865, ribH: .095, ink: '#fff', sh: 'rgba(120,0,20,.7)' },
    r3b: { cx: .5001, cy: .4624, r: .26, rib: .857, ribH: .09, ink: '#6b2f1e', sh: 'rgba(255,255,255,.6)' },
    // เกมมิ่ง (นีออน) · นักร้อง (เวที/ไวน์แดง) · Toy Cute (ของเล่นพาสเทล)
    g1: { cx: .4998, cy: .5482, r: .244, rib: .862, ribH: .085, ink: '#d6faff', sh: 'rgba(0,190,255,.95)' },
    g2: { cx: .4999, cy: .5303, r: .232, rib: .835, ribH: .085, ink: '#d6faff', sh: 'rgba(0,190,255,.95)' },
    g3: { cx: .4998, cy: .5055, r: .24, rib: .833, ribH: .085, ink: '#ffe0fb', sh: 'rgba(255,60,220,.95)' },
    s1: { cx: .5042, cy: .5112, r: .258, rib: .862, ribH: .085, ink: '#fff', sh: 'rgba(120,0,20,.8)' },
    s2: { cx: .4999, cy: .4672, r: .252, rib: .83, ribH: .085, ink: '#5a2a22', sh: 'rgba(255,255,255,.7)' },
    s3: { cx: .5022, cy: .4632, r: .289, rib: .83, ribH: .085, ink: '#6b4a2a', sh: 'rgba(255,255,255,.7)' },
    t1: { cx: .5051, cy: .5144, r: .216, rib: .85, ribH: .085, ink: '#fff', sh: 'rgba(210,60,130,.95)' },
    t3: { cx: .4983, cy: .4799, r: .234, rib: .83, ribH: .085, ink: '#fff', sh: 'rgba(210,60,120,.95)' },
  };
  /** มินิมอล (วาดด้วยโค้ด) — สีโลหะ c1 หลัก · c2 ไฮไลต์ · c3 เงา */
  const MINI = [
    { c1: '#f3c969', c2: '#fff4c9', c3: '#b8862b', glow: 'rgba(243,201,105,.55)', bw: 5 },
    { c1: '#cfd6e2', c2: '#ffffff', c3: '#8b95a7', glow: 'rgba(207,214,226,.45)', bw: 4 },
    { c1: '#e0a37a', c2: '#ffe0c9', c3: '#9c5f3a', glow: 'rgba(224,163,122,.45)', bw: 4 },
  ];
  const CROWN = '<svg viewBox="0 0 64 40"><path d="M4 36 L8 10 L22 24 L32 4 L42 24 L56 10 L60 36 Z" fill="url(#mg)" stroke="#fff6d8" stroke-width="2" stroke-linejoin="round"/><defs><linearGradient id="mg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1b8"/><stop offset="1" stop-color="#e2a93a"/></linearGradient></defs><circle cx="32" cy="4" r="3.5" fill="#fff6d8"/><circle cx="8" cy="10" r="3" fill="#fff6d8"/><circle cx="56" cy="10" r="3" fill="#fff6d8"/></svg>';
  const FRAME_SETS = { minimal: 'minimal', a: ['r1', 'r2', 'r3'], b: ['r1b', 'r2', 'r3b'], gaming: ['g1', 'g2', 'g3'], singer: ['s1', 's2', 's3'], toy: ['t1', 't3', 't3'] };

  function mount(opts) {
    const P = (k, d) => Overlay.param(k, d);
    const MAX = Math.max(1, Math.min(20, parseInt(P('max', '5'), 10) || 5));
    const BG = Math.max(0, Math.min(100, parseFloat(P('bg', '35')) || 0)) / 100;
    const pos = ['tr', 'tl', 'br', 'bl'].includes(P('pos', 'tr')) ? P('pos', 'tr') : 'tr';

    const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
    const board = document.createElement('div'); board.id = 'board'; board.className = pos;
    board.style.setProperty('--bg', String(BG)); if (BG === 0) board.classList.add('clear');
    board.innerHTML = '<div class="tt"></div><ol><li class="empty"></li></ol>';
    document.body.appendChild(board);
    board.querySelector('.tt').textContent = P('label', opts.title);
    board.querySelector('.empty').textContent = opts.empty;
    const list = board.querySelector('ol');

    const cols = ['#ff93c0', '#b9a6f2', '#8fe3cf', '#ffcf5c', '#ff6aa8', '#9d86e8'];
    const colOf = (nm) => cols[(nm || '?').charCodeAt(0) % cols.length];
    const MEDAL = ['🥇', '🥈', '🥉'];
    const totals = new Map(); // id -> { nm, avatar, value }
    const fset = FRAME_SETS[P('frames', 'a')] || null; // off = ป้ายรายการธรรมดาเหมือนเดิม
    let podium = null, lastFirst = null;
    if (fset) {
      board.classList.add('pod');
      podium = document.createElement('div'); podium.className = 'podium';
      board.insertBefore(podium, list);
      if (Array.isArray(fset)) fset.forEach((f) => { const i = new Image(); i.src = 'frames/' + f + '.webp'; }); // โหลดกรอบล่วงหน้า
    }
    function avaFill(el, g, size) {
      if (g.avatar && /^(https:\/\/|avatars\/demo)/.test(g.avatar)) el.style.backgroundImage = `url("${g.avatar.replace(/"/g, '')}")`;
      else { el.style.background = colOf(g.nm); el.textContent = (g.nm || '?')[0]; el.style.fontSize = Math.round(size * 0.45) + 'px'; }
    }
    function miniCard(g, rank) {
      const M = MINI[rank], w = rank === 0 ? 130 : 104;
      const pd = document.createElement('div'); pd.className = 'pd p' + (rank + 1); pd.style.setProperty('--w', w + 'px');
      const pf = document.createElement('div'); pf.className = 'pf';
      Object.entries({ '--c1': M.c1, '--c2': M.c2, '--c3': M.c3, '--glow': M.glow, '--bw': M.bw + 'px' }).forEach(([k, v]) => pf.style.setProperty(k, v));
      const d = Math.round(w * 0.72 - M.bw * 2);
      const pa = document.createElement('div'); pa.className = 'pa';
      Object.assign(pa.style, { width: d + 'px', height: d + 'px', left: (w / 2 - d / 2) + 'px', top: (w / 2 - d / 2) + 'px', animationDelay: `${-rank * 1.7}s, ${-rank * .6}s` });
      avaFill(pa, g, d);
      const halo = document.createElement('div'); halo.className = 'mhalo';
      const ring = document.createElement('div'); ring.className = 'mring';
      const badge = document.createElement('div'); badge.className = 'mbadge'; badge.textContent = String(rank + 1); badge.style.fontSize = Math.round(w * 0.11) + 'px';
      pf.append(halo, pa, ring, badge);
      if (rank === 0) { const c = document.createElement('div'); c.className = 'mcrown'; c.innerHTML = CROWN; pf.appendChild(c); }
      const nm = document.createElement('div'); nm.className = 'mname'; nm.textContent = g.nm; nm.style.fontSize = (rank === 0 ? 16 : 14) + 'px';
      const val = document.createElement('div'); val.className = 'pval'; val.textContent = opts.icon + ' ' + Overlay.fmt(g.value);
      pd.append(pf, nm, val);
      return pd;
    }
    function podiumCard(g, rank) {
      if (fset === 'minimal') return miniCard(g, rank);
      const key = fset[rank], F = FRAMES[key];
      const pd = document.createElement('div'); pd.className = 'pd p' + (rank + 1);
      const w = rank === 0 ? 150 : 118;
      const pf = document.createElement('div'); pf.className = 'pf'; pf.style.setProperty('--m', `url(frames/${key}.webp)`);
      const d = Math.round(w * F.r * 2 * 1.04);
      const pa = document.createElement('div'); pa.className = 'pa';
      Object.assign(pa.style, { width: d + 'px', height: d + 'px', left: (w * F.cx - d / 2) + 'px', top: (w * F.cy - d / 2) + 'px', animationDelay: `${-rank * 1.7}s, ${-rank * .6}s` });
      avaFill(pa, g, d);
      const fi = document.createElement('img'); fi.className = 'pfi'; fi.src = 'frames/' + key + '.webp'; fi.alt = '';
      const sh = document.createElement('div'); sh.className = 'pshine';
      const rib = document.createElement('div'); rib.className = 'prib'; rib.textContent = g.nm;
      const fs = Math.max(9, Math.min(w * F.ribH * 1.0, (w * 0.6) / Math.max(4, [...(g.nm || '')].length) * 1.7));
      Object.assign(rib.style, { top: (w * (F.rib - F.ribH / 2)) + 'px', height: (w * F.ribH) + 'px', fontSize: fs + 'px', color: F.ink, textShadow: `0 1px 1px ${F.sh}` });
      pf.append(pa, fi, sh, rib);
      for (let k = 0; k < (rank === 0 ? 5 : 3); k++) { // ประกายดาวรอบกรอบ
        const sp = document.createElement('span'); sp.className = 'spk'; sp.textContent = '✦';
        const a = Math.random() * Math.PI * 2, rr = 0.42 + Math.random() * 0.08;
        Object.assign(sp.style, { left: (50 + Math.cos(a) * rr * 100) + '%', top: (45 + Math.sin(a) * rr * 100) + '%', animationDelay: (-Math.random() * 2.2) + 's', fontSize: (9 + Math.random() * 7) + 'px' });
        pf.appendChild(sp);
      }
      const val = document.createElement('div'); val.className = 'pval'; val.textContent = opts.icon + ' ' + Overlay.fmt(g.value);
      pd.append(pf, val);
      return pd;
    }

    function render(bumpId) {
      const top = [...totals.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, MAX);
      if (!top.length) return;
      list.innerHTML = '';
      const rest = fset ? top.slice(3) : top;
      if (fset) {
        // คนเดิมอันดับเดิม → อัปเดตแค่ยอด (ไม่สร้างใหม่ ภาพเคลื่อนไหวไม่สะดุด)
        const sig = top.slice(0, 3).map(([id, g]) => id + '|' + g.avatar).join(',');
        if (sig === podium.dataset.sig) {
          top.slice(0, 3).forEach(([, g], r) => { const v = podium.querySelector(`.p${r + 1} .pval`); if (v) v.textContent = opts.icon + ' ' + Overlay.fmt(g.value); });
        } else {
        podium.dataset.sig = sig;
        podium.innerHTML = '';
        const cards = top.slice(0, 3).map(([, g], i) => podiumCard(g, i));
        [cards[1], cards[0], cards[2]].forEach((c) => c && podium.appendChild(c)); // ที่ 2 · ที่ 1 · ที่ 3
        const first = top[0] && top[0][0];
        if (first && lastFirst !== null && first !== lastFirst && cards[0]) { // ขึ้นบัลลังก์ใหม่!
          cards[0].classList.add('crown');
          const b = document.createElement('div'); b.className = 'burst'; cards[0].querySelector('.pf').appendChild(b);
        }
        lastFirst = first || lastFirst;
        }
        list.style.display = rest.length && P('list', 'true') !== 'false' ? '' : 'none'; // ?list=false = โชว์แค่แท่น Top 3
      }
      rest.forEach(([id, g], j) => { const i = fset ? j + 3 : j;
        const li = document.createElement('li'); if (id === bumpId) li.className = 'bump';
        const ava = document.createElement('div'); ava.className = 'ava';
        if (g.avatar && /^(https:\/\/|avatars\/demo)/.test(g.avatar)) ava.style.backgroundImage = `url("${g.avatar.replace(/"/g, '')}")`;
        else { ava.style.background = colOf(g.nm); ava.textContent = (g.nm || '?')[0]; }
        const rk = document.createElement('span'); rk.className = 'rk'; rk.textContent = MEDAL[i] || String(i + 1);
        const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = g.nm;
        const val = document.createElement('span'); val.className = 'val'; val.textContent = opts.icon + ' ' + Overlay.fmt(g.value);
        li.append(rk, ava, nm, val); list.appendChild(li);
      });
    }
    function add(user, value) {
      if (!value) return;
      const id = user ? (user.uniqueId || user.userId || user.nickname) : '?';
      const cur = totals.get(id) || { nm: user ? (user.nickname || user.uniqueId) : 'ผู้ชม', avatar: user && user.avatar, value: 0 };
      cur.value += value; if (user && user.avatar) cur.avatar = user.avatar; totals.set(id, cur); render(id); save();
    }

    // จำอันดับไว้ในเครื่อง (เซิร์ฟเวอร์รีสตาร์ท/deploy แล้วไม่หาย) — ล้างเองเมื่อเริ่มไลฟ์ใหม่ (roomId เปลี่ยน) หรือ ?reset=1
    const KEY = 'vjl-rank:' + opts.mode + ':' + (P('t', '') || P('username', 'demo')).slice(-24);
    let roomId = null, saveT = null;
    function save() {
      clearTimeout(saveT);
      saveT = setTimeout(saveNow, 400);
    }
    function saveNow() { clearTimeout(saveT); try { localStorage.setItem(KEY, JSON.stringify({ roomId, totals: [...totals.entries()] })); } catch { /* storage ปิด */ } }
    addEventListener('pagehide', saveNow); // รีเฟรช/ปิด → บันทึกทันที
    try {
      if (P('reset', '0') === '1') localStorage.removeItem(KEY);
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved) { roomId = saved.roomId || null; (saved.totals || []).forEach(([id, g]) => totals.set(id, g)); render(); }
    } catch { /* ignore */ }

    const stateKey = opts.mode === 'likes' ? 'topLikers' : 'topGifters';
    Overlay.on('state', (s) => {
      if (!s || !Array.isArray(s[stateKey])) return;
      if (s.roomId && roomId && s.roomId !== roomId) totals.clear(); // ไลฟ์ใหม่ → เริ่มอันดับใหม่
      if (s.roomId) roomId = s.roomId;
      // รวมกับที่จำไว้: เอาค่ามากกว่า (เซิร์ฟเวอร์อาจเพิ่งรีสตาร์ทจนนับใหม่)
      s[stateKey].forEach((g) => {
        const id = g.uniqueId || g.nickname, cur = totals.get(id);
        if (!cur || g.value > cur.value) totals.set(id, { nm: g.nickname || g.uniqueId, avatar: g.avatar || (cur && cur.avatar), value: g.value });
      });
      render(); save();
    });
    Overlay.on('event', (e) => {
      if (opts.mode === 'gifts' && e.type === 'gift' && !e.streaking) add(e.user, e.totalValue || (e.diamondCount || 0) * (e.repeatCount || 1));
      if (opts.mode === 'likes' && e.type === 'like') add(e.user, e.likeCount || 1);
    });

    if (!Overlay.connected) {
      const names = ['mimi', 'บิ๊ก', 'lisa', 'ต้นน้ำ', 'somchai', 'เฟิร์น', 'gamer_x'];
      const vals = opts.mode === 'likes' ? [1, 3, 8, 15, 30] : [1, 5, 20, 99, 1000];
      // รูปโปรไฟล์ตัวอย่าง (ตัวละคร VJ ของเราเอง) · ?fill=N ใส่ N ครั้งรวดเดียว (ถ่ายภาพตัวอย่าง)
      const one = () => { const i = Math.floor(Math.random() * names.length), nm = names[i]; add({ uniqueId: nm, nickname: nm, avatar: 'avatars/demo' + (i + 1) + '.webp' }, vals[Math.floor(Math.random() * vals.length)]); };
      for (let i = 0, n = Math.min(80, parseInt(P('fill', '0'), 10) || 0); i < n; i++) setTimeout(one, i * 40);
      setInterval(one, 1400);
    }
  }

  return { mount };
})();
