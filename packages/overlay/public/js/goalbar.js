/* 🎯 แถบเป้าหมายแบบฝัง (ใช้ในวิดเจ็ตโดเนทขึ้นจอ) — แบบกรอบ GPT (goal/frames.json, style=f-NN) หรือแถบพาสเทลเรียบ (style=bar)
   const g = VJLGoalBar.mount({ style, title, target, pos:'top'|'bottom', size, unit:'฿' }); g.set(value) */
(function () {
  const V = window.VJL_VERSION ? '?v=' + window.VJL_VERSION : '';
  const css = document.createElement('style');
  css.textContent = `
.vgb{position:fixed;left:50%;transform:translateX(-50%);width:min(calc(620px*var(--hs,1)),94vw);z-index:5;filter:drop-shadow(0 8px 16px rgba(40,10,50,.35));pointer-events:none}
.vgb.top{top:14px}.vgb.bottom{bottom:14px}
.vgb img.fr{display:block;width:100%;height:auto;position:relative;z-index:2}
.vgb .ft,.vgb .ftr,.vgb .fnum{position:absolute;display:flex;align-items:center;justify-content:center}
.vgb .ft{z-index:3;font-family:'Itim',sans-serif;color:var(--ink,#5a2a3a);white-space:nowrap;overflow:hidden}
.vgb .ftr{z-index:1;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.28)}
.vgb .ffill{position:absolute;left:0;top:0;bottom:0;width:0%;border-radius:999px;background:linear-gradient(90deg,#ff8fc4,#ff4fa3);transition:width .8s cubic-bezier(.3,.8,.4,1);overflow:hidden}
.vgb .ffill::after{content:'';position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.55) 50%,transparent 70%);animation:vgbShine 2.2s linear infinite}
.vgb .fnum{z-index:4;font-family:'Itim',sans-serif;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.75),0 0 2px rgba(0,0,0,.6);font-variant-numeric:tabular-nums;white-space:nowrap}
.vgb.plain{padding:10px 14px 12px;border-radius:22px;background:linear-gradient(135deg,rgba(255,111,170,.9),rgba(150,110,240,.9));border:2px solid rgba(255,255,255,.7);box-sizing:border-box}
.vgb.plain .pt{font:20px/1.2 'Itim',sans-serif;color:#fff;text-align:center;text-shadow:0 2px 4px rgba(60,10,60,.45);margin-bottom:6px}
.vgb.plain .ptr{position:relative;height:30px;border-radius:999px;background:rgba(255,255,255,.3);overflow:hidden}
.vgb.plain .ffill{background:linear-gradient(90deg,#fff3a8,#ffd25c)}
.vgb.plain .fnum{inset:0;font-size:17px}
.vgb.done{animation:vgbGlow 1.2s ease-in-out infinite alternate}
@keyframes vgbShine{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
@keyframes vgbGlow{to{filter:drop-shadow(0 0 18px rgba(255,220,120,.95))}}`;
  document.head.appendChild(css);
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  function mount(o) {
    const st = /^f-\d\d$/.test(o.style || '') ? o.style.slice(2) : '';
    const el = document.createElement('div'); el.className = 'vgb ' + (o.pos === 'top' ? 'top' : 'bottom');
    el.style.setProperty('--hs', String(Math.max(0.4, Math.min(3, Number(o.size) || 1))));
    const unit = o.unit || '';
    let target = Math.max(1, Number(o.target) || 1), fill, num;
    if (st) {
      el.innerHTML = '<div class="ftr"><div class="ffill"></div></div><img class="fr" alt=""><div class="ft"></div><div class="fnum"></div>';
      fill = el.querySelector('.ffill'); num = el.querySelector('.fnum');
      const t = el.querySelector('.ft'), img = el.querySelector('img'); t.textContent = o.title || '';
      el.style.visibility = 'hidden';
      fetch('goal/frames.json' + V).then((r) => r.json()).then((all) => {
        const F = all[st]; if (!F) return;
        const place = (e, b) => { e.style.left = b[0] * 100 + '%'; e.style.top = b[1] * 100 + '%'; e.style.width = (b[2] - b[0]) * 100 + '%'; e.style.height = (b[3] - b[1]) * 100 + '%'; };
        place(t, F.title); place(el.querySelector('.ftr'), F.track); place(num, F.track); el.style.setProperty('--ink', F.ink || '#5a2a3a');
        const fit = () => { t.style.fontSize = Math.max(10, t.clientHeight * 0.62) + 'px'; num.style.fontSize = Math.max(10, num.clientHeight * 0.5) + 'px';
          let fs = parseFloat(t.style.fontSize); for (let k = 0; k < 20 && t.scrollWidth > t.clientWidth && fs > 10; k++) { fs *= 0.92; t.style.fontSize = fs + 'px'; } };
        img.onload = () => { el.style.visibility = ''; fit(); }; img.src = 'goal/frame-' + F.id + '.webp' + V; addEventListener('resize', fit);
      }).catch(() => {});
    } else {
      el.classList.add('plain');
      el.innerHTML = '<div class="pt"></div><div class="ptr"><div class="ffill"></div><div class="fnum"></div></div>';
      el.querySelector('.pt').textContent = o.title || ''; fill = el.querySelector('.ffill'); num = el.querySelector('.fnum');
    }
    document.body.appendChild(el);
    let cur = 0;
    function set(v) {
      cur = Math.max(0, Number(v) || 0); const pct = Math.min(100, (cur / target) * 100);
      fill.style.width = pct + '%'; num.textContent = `${unit}${fmt(cur)} / ${unit}${fmt(target)} · ${Math.floor(pct)}%`; el.classList.toggle('done', pct >= 100);
    }
    set(0);
    return { set, get: () => cur, el };
  }
  window.VJLGoalBar = { mount };
})();
