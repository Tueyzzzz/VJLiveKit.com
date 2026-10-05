/**
 * ranking.js — ป้ายอันดับแบบกระจกโปร่งแสง ใช้ร่วมกันโดย topgifters.html / toplikers.html
 * ใช้คู่กับ overlay-client.js · เซิร์ฟเวอร์ส่งอันดับสะสมทั้งไลฟ์มากับ state (เปิด/รีเฟรชกลางไลฟ์ได้ครบ)
 *
 * พารามิเตอร์ URL:
 *   ?max=5        จำนวนอันดับ (1–20)
 *   ?label=...    หัวข้อ
 *   ?bg=35        ความทึบพื้นหลัง % (0 = ใสทั้งหมด)
 *   ?pos=tr       ตำแหน่ง tr | tl | br | bl (บนขวา/บนซ้าย/ล่างขวา/ล่างซ้าย)
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
  .empty{font-size:14px;color:rgba(255,255,255,.8);background:none;text-shadow:0 1px 3px rgba(0,0,0,.6)}`;

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

    function render(bumpId) {
      const top = [...totals.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, MAX);
      if (!top.length) return;
      list.innerHTML = '';
      top.forEach(([id, g], i) => {
        const li = document.createElement('li'); if (id === bumpId) li.className = 'bump';
        const ava = document.createElement('div'); ava.className = 'ava';
        if (g.avatar && /^https:\/\//.test(g.avatar)) ava.style.backgroundImage = `url("${g.avatar.replace(/"/g, '')}")`;
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
      cur.value += value; if (user && user.avatar) cur.avatar = user.avatar; totals.set(id, cur); render(id);
    }

    const stateKey = opts.mode === 'likes' ? 'topLikers' : 'topGifters';
    Overlay.on('state', (s) => {
      if (!s || !Array.isArray(s[stateKey])) return;
      totals.clear();
      s[stateKey].forEach((g) => totals.set(g.uniqueId || g.nickname, { nm: g.nickname || g.uniqueId, avatar: g.avatar, value: g.value }));
      render();
    });
    Overlay.on('event', (e) => {
      if (opts.mode === 'gifts' && e.type === 'gift' && !e.streaking) add(e.user, e.totalValue || (e.diamondCount || 0) * (e.repeatCount || 1));
      if (opts.mode === 'likes' && e.type === 'like') add(e.user, e.likeCount || 1);
    });

    if (!Overlay.connected) {
      const names = ['mimi', 'บิ๊ก', 'lisa', 'ต้นน้ำ', 'somchai', 'เฟิร์น', 'gamer_x'];
      const vals = opts.mode === 'likes' ? [1, 3, 8, 15, 30] : [1, 5, 20, 99, 1000];
      setInterval(() => { const nm = names[Math.floor(Math.random() * names.length)]; add({ uniqueId: nm, nickname: nm }, vals[Math.floor(Math.random() * vals.length)]); }, 1400);
    }
  }

  return { mount };
})();
