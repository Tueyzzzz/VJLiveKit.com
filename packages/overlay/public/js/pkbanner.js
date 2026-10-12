/* ⚔️ ป้าย PK สไตล์ GPT (effect=pkbanner, style=<หมวด>-<NN> เช่น win-03) — รูปพื้นใสใน pkb/<style>.webp
   เด้งเข้ากลางจอ · แสงวิบวับวิ่งผ่าน · ประกายรอบป้าย · ลอยเบา ๆ · ข้อความประกอบใต้ป้าย · เด้งออก
   window.VJLPkBanner.play({style, caption, durationMs, volume}) → Promise (reject ถ้ารูปโหลดไม่ได้) */
(function () {
  const V = window.VJL_VERSION ? '?v=' + window.VJL_VERSION : '';
  const SFX = { start: 'airhorn', win: 'tada', lose: 'heart', draw: 'correct', mvp: 'fanfare', top2: 'kaching', top3: 'kaching', glove: 'punch', critical: 'boom', smoke: 'whoosh', extra: 'alarm' };
  const css = document.createElement('style');
  css.textContent = `
.pkb{position:fixed;left:50%;top:50%;width:min(76vw,88vh);transform:translate(-50%,-50%);pointer-events:none;z-index:60}
.pkb .in{position:relative;animation:pkbIn .7s cubic-bezier(.2,1.6,.4,1) both}
.pkb.out .in{animation:pkbOut .45s ease-in both}
.pkb .fl{animation:pkbFloat 2.4s ease-in-out .7s infinite}
.pkb img.b{display:block;width:100%;height:auto;filter:drop-shadow(0 1.2vh 2.4vh rgba(0,0,0,.35))}
.pkb .sh{position:absolute;inset:0;-webkit-mask:var(--m) center/100% 100% no-repeat;mask:var(--m) center/100% 100% no-repeat;overflow:hidden}
.pkb .sh::before{content:'';position:absolute;top:-20%;bottom:-20%;width:22%;left:-40%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.75),transparent);transform:skewX(-18deg);animation:pkbShine 1.6s ease-in-out .55s 2}
.pkb .sp{position:absolute;width:2.2vmin;height:2.2vmin;background:radial-gradient(circle,#fff 0 18%,rgba(255,240,180,.9) 30%,transparent 70%);border-radius:50%;opacity:0;animation:pkbSpark 1.2s ease-out both}
.pkb .cap{position:relative;left:50%;width:94vw;margin:1.2vh 0 0 -47vw;text-align:center;font:900 min(5.6vh,4.6vw)/1.2 Kanit,sans-serif;color:#fff;-webkit-text-stroke:min(.9vh,.75vw) #b82f73;paint-order:stroke fill;text-shadow:0 .6vh 1.4vh rgba(0,0,0,.35);animation:pkbCap .5s .45s cubic-bezier(.2,1.4,.4,1) both}
@keyframes pkbIn{0%{transform:scale(.2) rotate(-6deg);opacity:0}60%{opacity:1}100%{transform:scale(1) rotate(0)}}
@keyframes pkbOut{to{transform:scale(.6);opacity:0}}
@keyframes pkbFloat{50%{transform:translateY(-1.2vh) scale(1.015)}}
@keyframes pkbShine{to{left:120%}}
@keyframes pkbSpark{0%{opacity:0;transform:translate(0,0) scale(.3)}25%{opacity:1}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(1.2)}}
@keyframes pkbCap{from{transform:translateY(2vh) scale(.7);opacity:0}}`;
  document.head.appendChild(css);
  const cache = {};
  function load(style) {
    if (!cache[style]) cache[style] = new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im.src); im.onerror = () => { delete cache[style]; no(new Error('pkb ' + style)); }; im.src = 'pkb/' + style + '.webp' + V; });
    return cache[style];
  }
  let busyUntil = 0;
  async function play(o) {
    const style = /^[a-z0-9]+-\d\d$/.test(o.style || '') ? o.style : 'win-01';
    const src = await load(style);
    const now = Date.now(), dur = Math.max(2500, Math.min(20000, o.durationMs || 5000));
    if (now < busyUntil) await new Promise((r) => setTimeout(r, busyUntil - now)); // หลายกฎพร้อมกัน → เข้าคิว ไม่ซ้อนป้าย
    busyUntil = Date.now() + dur + 300;
    const cat = style.split('-')[0];
    if (window.VJLSfx && SFX[cat]) VJLSfx.play(SFX[cat], Math.max(0, Math.min(1.5, o.volume == null ? 0.8 : o.volume)));
    const box = document.createElement('div'); box.className = 'pkb';
    box.innerHTML = '<div class="in"><div class="fl"><div style="position:relative"><img class="b" alt=""><div class="sh"></div></div></div></div>';
    box.querySelector('img').src = src; box.querySelector('.sh').style.setProperty('--m', `url("${src}")`);
    const fl = box.querySelector('.fl > div');
    for (let i = 0; i < 16; i++) { // ประกายแตกออกจากขอบป้าย
      const s = document.createElement('i'); s.className = 'sp'; const a = Math.random() * Math.PI * 2;
      s.style.left = 50 + Math.cos(a) * 42 + '%'; s.style.top = 50 + Math.sin(a) * 36 + '%';
      s.style.setProperty('--dx', Math.cos(a) * (4 + Math.random() * 6) + 'vmin'); s.style.setProperty('--dy', Math.sin(a) * (4 + Math.random() * 6) + 'vmin');
      s.style.animationDelay = (0.35 + Math.random() * 0.9) + 's'; fl.appendChild(s);
    }
    if (o.caption) { const c = document.createElement('div'); c.className = 'cap'; c.textContent = o.caption; box.querySelector('.in').appendChild(c); }
    document.body.appendChild(box);
    setTimeout(() => box.classList.add('out'), dur - 450);
    setTimeout(() => box.remove(), dur);
  }
  window.VJLPkBanner = { play, preload: load };
})();
