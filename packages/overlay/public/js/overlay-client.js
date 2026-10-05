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
  const handlers = { event: [], stats: [], status: [], state: [], action: [] };
  const fire = (k, d) => handlers[k].forEach((fn) => fn(d));

  const api = {
    param: (k, def) => (params.get(k) == null ? def : params.get(k)),
    on(type, fn) { if (handlers[type]) handlers[type].push(fn); return api; },
    esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    fmt: (n) => (Math.round(n) || 0).toLocaleString('en-US'),
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
    const widget = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
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
    };
    socket.on('status', (s) => {
      if (s && (s.type === 'error' || s.type === 'offline')) showBadge(s.message);
      else if (s && s.type === 'connected' && badge) badge.style.display = 'none';
    });
    socket.on('state', (s) => { if (s && s.connected && badge) badge.style.display = 'none'; });
    socket.on('tiktok-event', (e) => fire('event', e));
    socket.on('stats', (s) => fire('stats', s));
    socket.on('status', (s) => fire('status', s));
    socket.on('state', (s) => fire('state', s));
    socket.on('action', (a) => fire('action', a));
    api.connected = true;
    api.socket = socket;
  } else {
    console.warn('[overlay] ไม่พบ socket.io client — โหลด /socket.io/socket.io.js ก่อน');
    api.connected = false;
  }

  return api;
})();
