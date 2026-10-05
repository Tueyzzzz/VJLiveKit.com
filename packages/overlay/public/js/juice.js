/**
 * juice.js — ลูกเล่นให้วิดเจ็ต "มีชีวิต" แบบเกม (ใช้ร่วมกันทุก overlay ที่วาดด้วย Canvas 2D)
 *   Juice.Spring       สปริง (ยุบ-ยืด, โหลสั่น, เด้ง)
 *   Juice.Particles    ประกายดาว ✦ / ฝุ่น ตอนตกกระทบ / พลุ
 *   Juice.aura()       ออร่าเรืองแสงตามมูลค่าของขวัญ (แบบเกมกาชา)
 *   Juice.breathe()    ค่าหายใจ (ขยับเบา ๆ ตลอดเวลา)
 * กฎ: feedback ทุกอย่างจบภายใน ~400ms, เงาเป็นสีม่วงไม่ใช้ดำ
 */
window.Juice = (function () {
  class Spring {
    constructor(k = 180, damp = 12) { this.k = k; this.d = damp; this.x = 0; this.v = 0; }
    kick(v) { this.v += v; }
    step(dt) { const a = -this.k * this.x - this.d * this.v; this.v += a * dt; this.x += this.v * dt; return this.x; }
  }

  class Particles {
    constructor(max = 400) { this.list = []; this.max = max; }
    sparkle(x, y, n = 6, color = '#fff6c2') {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 3;
        this.push({ kind: 'star', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, g: 0.05, life: 1, decay: 0.03 + Math.random() * 0.02, size: 5 + Math.random() * 6, rot: Math.random() * 3, color });
      }
    }
    dust(x, y, n = 5) {
      for (let i = 0; i < n; i++) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        this.push({ kind: 'dust', x, y, vx: dir * (0.6 + Math.random() * 1.6), vy: -(0.3 + Math.random() * 0.8), g: 0, life: 1, decay: 0.04, size: 4 + Math.random() * 5, color: 'rgba(255,255,255,.75)' });
      }
    }
    confetti(x, y, n = 40) {
      const cols = ['#ff93c0', '#ffd76a', '#8fe3cf', '#b9a6f2', '#a9d8ff'];
      for (let i = 0; i < n; i++) {
        this.push({ kind: 'conf', x, y, vx: (Math.random() - 0.5) * 14, vy: -(4 + Math.random() * 10), g: 0.35, life: 1, decay: 0.012, size: 8 + Math.random() * 6, rot: 0, vr: (Math.random() - 0.5) * 0.8, color: cols[i % cols.length] });
      }
    }
    /** โน้ตดนตรีลอยขึ้นแกว่งซ้ายขวา (ธีมนักร้อง) */
    notes(x, y, n = 4, cols = ['#F3D9A4', '#E8B4A0', '#ff9ec7', '#fff6c2']) {
      const SYM = ['♪', '♫', '♬', '♩'];
      for (let i = 0; i < n; i++) {
        this.push({ kind: 'note', x: x + (Math.random() - .5) * 30, y, vx: (Math.random() - .5) * 1.2, vy: -(1.2 + Math.random() * 1.6), g: -0.005, life: 1, decay: 0.008 + Math.random() * 0.006,
          size: 18 + Math.random() * 14, rot: (Math.random() - .5) * 0.5, ph: Math.random() * 6.28, color: cols[i % cols.length], sym: SYM[Math.floor(Math.random() * SYM.length)] });
      }
    }
    push(p) { this.list.push(p); if (this.list.length > this.max) this.list.shift(); }
    step() {
      for (let i = this.list.length - 1; i >= 0; i--) {
        const p = this.list[i];
        p.vx *= 0.97; p.vy = p.vy * 0.97 + p.g; p.x += p.vx; p.y += p.vy; p.life -= p.decay; if (p.vr) p.rot += p.vr;
        if (p.life <= 0) this.list.splice(i, 1);
      }
    }
    draw(ctx) {
      for (const p of this.list) {
        ctx.save(); ctx.globalAlpha = Math.max(0, p.life); ctx.translate(p.x, p.y);
        if (p.kind === 'star') {
          ctx.rotate(p.rot); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = p.color;
          const s = p.size * (0.6 + 0.4 * p.life);
          ctx.beginPath(); // ดาว 4 แฉก
          for (let k = 0; k < 8; k++) { const r = k % 2 ? s * 0.28 : s, a = k * Math.PI / 4; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
          ctx.closePath(); ctx.fill();
        } else if (p.kind === 'note') {
          ctx.rotate(p.rot + Math.sin((1 - p.life) * 8 + p.ph) * 0.25); ctx.translate(Math.sin((1 - p.life) * 6 + p.ph) * 10, 0);
          ctx.font = `bold ${Math.round(p.size)}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(255,220,160,.8)'; ctx.shadowBlur = 8; ctx.fillStyle = p.color; ctx.fillText(p.sym, 0, 0);
        } else if (p.kind === 'dust') {
          ctx.beginPath(); ctx.arc(0, 0, p.size * (1.6 - p.life * 0.6), 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.fill();
        } else {
          ctx.rotate(p.rot); ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size * 0.35, p.size, p.size * 0.7);
        }
        ctx.restore();
      }
    }
  }

  // ระดับออร่าตามมูลค่า (เหรียญต่อชิ้น): ทอง >= 1000, ม่วง >= 100, ฟ้า >= 20
  function auraColor(d) { return d >= 1000 ? '255,205,90' : d >= 100 ? '200,150,255' : d >= 20 ? '140,200,255' : null; }
  function aura(ctx, x, y, r, d, t) {
    const c = auraColor(d); if (!c) return;
    const pulse = 0.75 + 0.25 * Math.sin(t * 4 + x * 0.05);
    const g = ctx.createRadialGradient(x, y, r * 0.7, x, y, r * 1.6);
    g.addColorStop(0, `rgba(${c},${0.38 * pulse})`); g.addColorStop(1, `rgba(${c},0)`);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  /**
   * ตัวคูณขนาดตามราคาของขวัญ (เหรียญต่อชิ้น) — ใช้ร่วมทุกวิดเจ็ต ของแพงใหญ่ตามราคา
   * 1 เหรียญ = 1× · 500 = 1.9× · 1,000 = 3× · 30,000+ = 4× (เส้นโค้งตามตาราง เทียบแบบ log)
   * max = เพดานของวิดเจ็ตนั้น (ย่อเส้นโค้งทั้งเส้นให้จบที่ max)
   */
  const SIZE_TABLE = [[1, 1], [20, 1.3], [100, 1.55], [500, 1.9], [1000, 3], [5000, 3.5], [30000, 4]];
  function sizeFor(d, max = 4) {
    const x = Math.log10(Math.max(1, d || 1)), T = SIZE_TABLE;
    let t = T[T.length - 1][1];
    for (let i = 1; i < T.length; i++) { const x1 = Math.log10(T[i][0]); if (x <= x1) { const x0 = Math.log10(T[i - 1][0]); t = T[i - 1][1] + (T[i][1] - T[i - 1][1]) * (x - x0) / (x1 - x0); break; } }
    return 1 + (t - 1) * (max - 1) / 3;
  }
  const breathe = (t, amp = 0.012, hz = 0.5) => 1 + Math.sin(t * Math.PI * 2 * hz) * amp;
  const easeOutBack = (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };

  /**
   * เปลี่ยนสีภาพ (หมุนเฉดสี/ความสด/ความสว่าง) ครั้งเดียวตอนโหลด → คืน canvas ไว้วาดแทนรูปเดิม
   * hue: องศา -180..180, sat/bright: 1 = เท่าเดิม · ไม่เปลี่ยนอะไร = คืนรูปเดิม
   */
  function tinted(img, hue = 0, sat = 1, bright = 1) {
    if (!hue && sat === 1 && bright === 1) return img;
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d'); g.filter = `hue-rotate(${hue}deg) saturate(${sat}) brightness(${bright})`; g.drawImage(img, 0, 0);
    return c;
  }
  /** โหลดรูป + เปลี่ยนสีตามพารามิเตอร์ → { ready(), source } */
  function skin(src, hue, sat, bright) {
    const img = new Image(), out = { source: null, ready: () => !!out.source };
    img.onload = () => { out.source = tinted(img, hue, sat, bright); };
    img.src = window.VJL_VERSION ? src + (src.includes('?') ? '&' : '?') + 'v=' + window.VJL_VERSION : src; // เวอร์ชันใหม่ = URL ใหม่ → ไม่ใช้รูปเก่าในแคช
    return out;
  }

  /**
   * สติกเกอร์คุณภาพสูงของรูปของขวัญ: ย่อแบบหลายขั้น (คมกว่าย่อทีเดียว) ที่ขนาดพิกเซลจริงบนจอ
   * + ขอบขาวแบบสติกเกอร์ + เงาม่วงนุ่ม → แยกชิ้นชัดเวลากองกัน · แคชตามรูป+ขนาด (สร้างครั้งเดียว)
   * px = ความกว้างบนจอเป็นพิกเซลจริง · คืน canvas (ขนาด = px * PAD) หรือ null ถ้ารูปยังไม่พร้อม
   */
  const STICKER_PAD = 1.3, stickerCache = new Map();
  function sticker(img, px) {
    if (!img || !img.complete || !img.naturalWidth) return null;
    const size = Math.max(16, Math.min(512, Math.ceil(px / 8) * 8)), key = img.src + '|' + size;
    let c = stickerCache.get(key); if (c) return c;
    // ย่อทีละครึ่งจนใกล้ขนาดเป้าหมาย
    let src = img, w = img.naturalWidth, h = img.naturalHeight;
    while (w / 2 >= size * 1.1) {
      const t = document.createElement('canvas'); t.width = Math.round(w / 2); t.height = Math.round(h / 2);
      const tg = t.getContext('2d'); tg.imageSmoothingQuality = 'high'; tg.drawImage(src, 0, 0, t.width, t.height); src = t; w = t.width; h = t.height;
    }
    const k = size / Math.max(w, h), iw = w * k, ih = h * k;
    const shape = document.createElement('canvas'); shape.width = shape.height = size;
    const sg = shape.getContext('2d'); sg.imageSmoothingQuality = 'high'; sg.drawImage(src, (size - iw) / 2, (size - ih) / 2, iw, ih);
    const full = Math.ceil(size * STICKER_PAD), off = (full - size) / 2;
    // เงาของรูปร่าง (สีขาวทึบ) สำหรับขอบสติกเกอร์
    const sil = document.createElement('canvas'); sil.width = sil.height = size;
    const lg = sil.getContext('2d'); lg.drawImage(shape, 0, 0); lg.globalCompositeOperation = 'source-in'; lg.fillStyle = '#ffffff'; lg.fillRect(0, 0, size, size);
    c = document.createElement('canvas'); c.width = c.height = full;
    const g = c.getContext('2d'), rim = Math.max(1.5, size * 0.035);
    g.save(); g.shadowColor = 'rgba(80,50,130,.32)'; g.shadowBlur = size * 0.05; g.shadowOffsetY = size * 0.04;
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.drawImage(sil, off + Math.cos(a) * rim, off + Math.sin(a) * rim); } // ขอบขาว + เงา
    g.restore();
    g.drawImage(shape, off, off);
    if (stickerCache.size > 400) stickerCache.delete(stickerCache.keys().next().value);
    stickerCache.set(key, c);
    return c;
  }

  return { Spring, Particles, aura, auraColor, sizeFor, sticker, STICKER_PAD, breathe, easeOutBack, tinted, skin };
})();
