/**
 * overlay-client.js — ตัวช่วยเชื่อม Socket.IO สำหรับหน้า overlay ทุกหน้า
 * ใช้: <script src="/socket.io/socket.io.js"></script> ก่อน แล้วตามด้วยไฟล์นี้
 *
 * อ่านพารามิเตอร์จาก URL:
 *   ?t=<overlay jwt>   -> โหมดจริง (ผูกกับบัญชีผู้ใช้)
 *   ?username=<ชื่อ>    -> โหมดเดโม (เฉพาะตอนเซิร์ฟเวอร์เปิด DEMO_MODE)
 *   ?demo=1            -> โหมดเดโมในเบราว์เซอร์ล้วน (ไม่ต่อเซิร์ฟเวอร์)
 */
window.Overlay = (function () {
  const params = new URLSearchParams(location.search);
  const handlers = { event: [], stats: [], status: [], state: [], action: [], donation: [] };
  const fire = (k, d) => handlers[k].forEach((fn) => fn(d));

  // ---- ตั้งค่าจาก Dashboard (บันทึกในบัญชี) ----
  // ลำดับความสำคัญ: พารามิเตอร์ใน URL > ตั้งค่าใน Dashboard > ค่าเริ่มต้นของวิดเจ็ต
  // เก็บสำเนาไว้ในเครื่องเพื่อให้วิดเจ็ตอ่านได้ทันทีตอนโหลด; เซิร์ฟเวอร์ส่งค่าใหม่มา → โหลดหน้าใหม่
  const widgetName = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
  const owner = (params.get('t') || '').slice(-24);
  const CFG_KEY = 'vjl-cfg:' + widgetName + ':' + owner;
  let cfg = {};
  try { cfg = owner ? JSON.parse(localStorage.getItem(CFG_KEY) || '{}') : {}; } catch { cfg = {}; }
  // ปุ่ม "ล้าง/เริ่มใหม่" ใน Dashboard (resetAt เปลี่ยน) → ลบข้อมูลที่วิดเจ็ตจำไว้ (กองของขวัญ, อันดับ, เวลา)
  const STORE_PREFIX = { giftjar: 'vjl-giftjar:', belly: 'vjl-belly:', aquarium: 'vjl-aquarium:', spacedome: 'vjl-spacedome:', snowglobe: 'vjl-snowglobe:', vehicle: 'vjl-vehicle:', garden: 'vjl-garden:', tree: 'vjl-tree:', coinjar: 'vjl-coinjar2:', pile: 'vjl-pile:', timer: 'vjl-timer:', league: 'vjl-league:', topgifters: 'vjl-rank:gifts:', toplikers: 'vjl-rank:likes:' };
  try {
    const RESET_KEY = 'vjl-resetAt:' + widgetName + ':' + owner;
    if (cfg.resetAt && localStorage.getItem(RESET_KEY) !== String(cfg.resetAt)) {
      const prefix = STORE_PREFIX[widgetName];
      if (prefix) Object.keys(localStorage).filter((k) => k.startsWith(prefix)).forEach((k) => localStorage.removeItem(k));
      // ล้างกองของขวัญ = ล้างกองกลางที่ทุกแบบใช้ร่วมกันด้วย
      if (['giftjar', 'belly', 'aquarium', 'spacedome', 'snowglobe', 'vehicle', 'garden', 'tree', 'coinjar', 'pile'].includes(widgetName)) Object.keys(localStorage).filter((k) => k.startsWith('vjl-collect:')).forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(RESET_KEY, String(cfg.resetAt));
    }
  } catch { /* storage ปิด */ }

  const api = {
    param: (k, def) => {
      if (params.get(k) != null) return params.get(k);
      if (cfg[k] !== undefined && cfg[k] !== null && cfg[k] !== '') return String(cfg[k]);
      const D = window.VJL_DEFAULTS; if (D && D[k] !== undefined) return String(D[k]); // ค่าเริ่มต้นของวิดเจ็ตแฝง (เช่น tree = garden แบบต้นไม้)
      return def;
    },
    on(type, fn) { if (handlers[type]) handlers[type].push(fn); return api; },
    esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    fmt: (n) => (Math.round(n) || 0).toLocaleString('en-US'),
    widget: widgetName,
    isDemo: params.get('demo') === '1' || (!params.get('t') && !!params.get('username')),
  };

  const token = params.get('t');
  const username = params.get('username');

  // โหมดเดโมล้วน (ไม่มี socket) — ให้หน้า overlay generate เองผ่าน fallback
  if (params.get('demo') === '1' || (!token && !username)) {
    api.connected = false;
    return api;
  }

  // เชื่อม Socket.IO
  if (typeof io === 'function') {
    // ชื่อวิดเจ็ตจากชื่อไฟล์ (เช่น /overlay/tts.html -> tts) ให้เซิร์ฟเวอร์ตรวจสิทธิ์ตามแพลน
    const widget = widgetName;
    const query = token ? { token, widget } : { username, widget };
    const socket = io({ query });
    // แสดงข้อความ error มุมจอ (ช่วยผู้ใช้ debug ใน OBS) — ซ่อนเองเมื่อเชื่อมต่อได้
    let badge = null;
    const showBadge = (text) => {
      if (!badge) {
        badge = document.createElement('div');
        badge.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99999;max-width:90vw;padding:6px 12px;border-radius:10px;' +
          'background:rgba(40,20,50,.85);color:#fff;font:14px/1.4 sans-serif;pointer-events:none';
        document.body.appendChild(badge);
      }
      badge.textContent = 'VJLiveKit: ' + text;
      badge.style.display = 'block';
      clearTimeout(badge._t); badge._t = setTimeout(() => { badge.style.display = 'none'; }, 8000); // ไม่ค้างบนจอไลฟ์
    };
    socket.on('disconnect', (reason) => { if (reason === 'io server disconnect') setTimeout(() => socket.connect(), 60_000); }); // ต่ออายุแล้วกลับมาเอง
    socket.on('status', (s) => {
      // บนจอไลฟ์โชว์เฉพาะปัญหาลิงก์/สิทธิ์ (fatal) — error ชั่วคราวของ TikTok/การเชื่อมต่อ ไม่ให้คนดูเห็น (ต่อใหม่เอง)
      if (s && s.type === 'error' && s.fatal) showBadge(s.message);
      else if (s && (s.type === 'error' || s.type === 'offline')) console.warn('[VJLiveKit]', s.message);
      else if (s && (s.type === 'connected' || s.type === 'resumed') && badge) badge.style.display = 'none';
    });
    socket.on('state', (s) => { if (s && s.connected && badge) badge.style.display = 'none'; });
    // อัปเดตตัวเองอัตโนมัติ: เวอร์ชันของหน้านี้ฝังมากับ HTML (window.VJL_VERSION)
    // ไม่ตรงกับเซิร์ฟเวอร์ = หน้านี้มาจากแคชเก่า หรือเพิ่ง deploy → โหลดใหม่ด้วย URL ใหม่ (&_v=) บังคับข้ามแคช
    let version = window.VJL_VERSION || null;
    socket.on('version', (v) => {
      if (!v) return;
      if (version === null) { version = v; return; }
      if (v === version) return;
      const u = new URL(location.href);
      if (u.searchParams.get('_v') === v) return; // โหลดใหม่แล้วยังเก่า → ไม่วนลูป
      u.searchParams.set('_v', v);
      setTimeout(() => location.replace(u.toString()), window.VJL_VERSION ? 300 : 1500 + Math.random() * 3000);
    });
    socket.on('config', (c) => {
      const next = JSON.stringify(c || {});
      if (next === JSON.stringify(cfg)) return;
      try { localStorage.setItem(CFG_KEY, next); } catch { /* storage ปิด */ }
      location.reload(); // ใช้ตั้งค่าใหม่
    });
    // ป้ายเล็ก ๆ มุมขวาล่าง สำหรับแพลนฟรี/ทดลอง — ไม่โชว์ค้าง (จะบังหน้าวีเจ) : โผล่ 6 วิ ตอนเปิด แล้วทุก 10 นาที
    // สมัคร Pro แล้วเซิร์ฟเวอร์ส่ง show:false ป้ายหายเอง
    let brand = null, brandTimer = null;
    const flash = () => { if (!brand) return; brand.style.opacity = '.85'; setTimeout(() => { if (brand) brand.style.opacity = '0'; }, 6000); };
    socket.on('brand', (b) => {
      const show = !!(b && b.show) && widgetName !== 'collect'; // collect = กรอบหุ้ม ป้ายอยู่ในวิดเจ็ตข้างในแล้ว
      if (!show) { clearInterval(brandTimer); brandTimer = null; if (brand) { brand.remove(); brand = null; } return; }
      if (!brand) {
        brand = document.createElement('div');
        brand.style.cssText = 'position:fixed;right:6px;bottom:6px;z-index:99998;display:flex;align-items:center;gap:5px;' +
          'padding:3px 9px 3px 6px;border-radius:999px;background:rgba(255,255,255,.85);box-shadow:0 2px 8px rgba(80,30,90,.18);' +
          "font:700 11px/1 'Segoe UI',Tahoma,sans-serif;color:#e0468e;letter-spacing:.2px;pointer-events:none;opacity:0;transition:opacity .8s";
        brand.innerHTML = '<svg width="13" height="13" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="33" r="27" fill="#ffcf5c"/>' +
          '<path d="M32 50c-8-5.6-15-11-15-18.6A8 8 0 0 1 32 27a8 8 0 0 1 15 4.4C47 39 40 44.4 32 50z" fill="#ff6aa8"/></svg>vjlivekit.com';
        document.body.appendChild(brand);
        setTimeout(flash, 50);
      }
      if (!brandTimer) brandTimer = setInterval(flash, Math.max(1, Number(b.every) || 10) * 60 * 1000);
    });
    socket.on('tiktok-event', (e) => fire('event', e));
    socket.on('stats', (s) => fire('stats', s));
    socket.on('status', (s) => fire('status', s));
    socket.on('state', (s) => fire('state', s));
    socket.on('action', (a) => fire('action', a));
    socket.on('donation', (d) => fire('donation', d));
    api.connected = true;
    api.socket = socket;
  } else {
    console.warn('[overlay] ไม่พบ socket.io client — โหลด /socket.io/socket.io.js ก่อน');
    api.connected = false;
  }

  return api;
})();
