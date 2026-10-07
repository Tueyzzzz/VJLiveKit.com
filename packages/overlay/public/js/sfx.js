/* เสียงสำเร็จรูป (สังเคราะห์ด้วย WebAudio — ไม่ต้องมีไฟล์/ลิงก์) ใช้ทั้งใน overlay fx และปุ่มฟังตัวอย่างในแดชบอร์ด
 * VJLSfx.play('chime', volume0to1) · VJLSfx.list = [[id, ชื่อไทย], ...]
 */
(function () {
  let ac = null;
  const ctx = () => (ac = ac || new (window.AudioContext || window.webkitAudioContext)());

  function tone(c, out, { f, f2, t = 0, d = 0.3, type = 'sine', v = 0.25, a = 0.01 }) {
    const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + t;
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(v, t0 + a); g.gain.exponentialRampToValueAtTime(0.001, t0 + d);
    o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + d + 0.05);
  }
  function noise(c, out, { t = 0, d = 0.2, v = 0.3, hp = 800, lp = 8000 }) {
    const n = Math.floor(c.sampleRate * d), b = c.createBuffer(1, n, c.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(), h = c.createBiquadFilter(), l = c.createBiquadFilter(), g = c.createGain(), t0 = c.currentTime + t;
    s.buffer = b; h.type = 'highpass'; h.frequency.value = hp; l.type = 'lowpass'; l.frequency.value = lp; g.gain.value = v;
    s.connect(h); h.connect(l); l.connect(g); g.connect(out); s.start(t0);
  }

  const SOUNDS = {
    chime: ['🔔 กริ๊ง', (c, o) => [880, 1175, 1568, 2093].forEach((f, i) => tone(c, o, { f, t: i * 0.11, d: 0.6, type: 'triangle', v: 0.2 }))],
    coin: ['🪙 เหรียญ', (c, o) => { tone(c, o, { f: 988, d: 0.08, type: 'square', v: 0.12 }); tone(c, o, { f: 1319, t: 0.08, d: 0.4, type: 'square', v: 0.12 }); }],
    levelup: ['⬆️ เลเวลอัป', (c, o) => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(c, o, { f, t: i * 0.07, d: 0.25, type: 'square', v: 0.1 }))],
    fanfare: ['🎺 ฟันแฟร์', (c, o) => { [[523, 0, .15], [523, .16, .15], [523, .32, .15], [659, .48, .5], [784, .98, .7]].forEach(([f, t, d]) => { tone(c, o, { f, t, d, type: 'sawtooth', v: 0.09 }); tone(c, o, { f: f * 2, t, d, type: 'triangle', v: 0.05 }); }); }],
    magic: ['✨ เวทมนตร์', (c, o) => { for (let i = 0; i < 14; i++) tone(c, o, { f: 1200 + Math.random() * 2400, t: i * 0.05, d: 0.35, type: 'sine', v: 0.08 }); tone(c, o, { f: 400, f2: 1600, d: 0.9, type: 'sine', v: 0.08 }); }],
    pop: ['🫧 ป๊อป', (c, o) => tone(c, o, { f: 600, f2: 1400, d: 0.12, type: 'sine', v: 0.3, a: 0.005 })],
    whoosh: ['💨 วู้ช', (c, o) => noise(c, o, { d: 0.6, v: 0.35, hp: 300, lp: 3000 })],
    drum: ['🥁 ตึ่งโป๊ะ', (c, o) => { tone(c, o, { f: 160, f2: 60, d: 0.25, v: 0.5 }); tone(c, o, { f: 160, f2: 60, t: 0.18, d: 0.25, v: 0.5 }); noise(c, o, { t: 0.42, d: 0.35, v: 0.35, hp: 3000 }); }],
    boing: ['🌀 ดึ๋ง', (c, o) => tone(c, o, { f: 220, f2: 880, d: 0.45, type: 'triangle', v: 0.25 })],
    heart: ['💗 หัวใจ', (c, o) => { tone(c, o, { f: 784, d: 0.3, type: 'sine', v: 0.2 }); tone(c, o, { f: 1047, t: 0.12, d: 0.5, type: 'sine', v: 0.2 }); tone(c, o, { f: 1568, t: 0.24, d: 0.7, type: 'sine', v: 0.12 }); }],
    applause: ['👏 ปรบมือ', (c, o) => { for (let i = 0; i < 26; i++) noise(c, o, { t: i * 0.06 + Math.random() * 0.04, d: 0.06, v: 0.25, hp: 1200, lp: 6000 }); }],
    punch: ['🥊 ต่อยน่ารัก', (c, o) => {
      noise(c, o, { d: 0.22, v: 0.3, hp: 600, lp: 4000 });                              // วู้ช
      tone(c, o, { f: 180, f2: 55, t: 0.2, d: 0.22, v: 0.55, a: 0.003 });                 // ปั้ก
      noise(c, o, { t: 0.2, d: 0.08, v: 0.35, hp: 1500 });
      tone(c, o, { f: 420, f2: 1250, t: 0.34, d: 0.32, type: 'triangle', v: 0.22 });      // ดึ๋ง ~
      [1568, 2093, 2637].forEach((f, i) => tone(c, o, { f, t: 0.6 + i * 0.07, d: 0.25, type: 'sine', v: 0.12 })); // วิ้ง ๆ
    }],
    alarm: ['🚨 ไซเรน', (c, o) => { for (let i = 0; i < 3; i++) tone(c, o, { f: 700, f2: 1300, t: i * 0.4, d: 0.38, type: 'sawtooth', v: 0.08 }); }],
  };

  window.VJLSfx = {
    list: Object.entries(SOUNDS).map(([id, [name]]) => [id, name]),
    has: (id) => !!SOUNDS[id],
    play(id, vol = 1) {
      const s = SOUNDS[id]; if (!s) return false;
      try {
        const c = ctx(); if (c.state === 'suspended') c.resume();
        const g = c.createGain(); g.gain.value = Math.max(0, Math.min(1.5, vol)); g.connect(c.destination);
        s[1](c, g); return c.state === 'running';
      } catch { return false; }
    },
  };
})();
