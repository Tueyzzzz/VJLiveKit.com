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
  const handlers = { event: [], stats: [], status: [], state: [] };
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
    const query = token ? { token } : { username };
    const socket = io({ query });
    socket.on('tiktok-event', (e) => fire('event', e));
    socket.on('stats', (s) => fire('stats', s));
    socket.on('status', (s) => fire('status', s));
    socket.on('state', (s) => fire('state', s));
    api.connected = true;
    api.socket = socket;
  } else {
    console.warn('[overlay] ไม่พบ socket.io client — โหลด /socket.io/socket.io.js ก่อน');
    api.connected = false;
  }

  return api;
})();
