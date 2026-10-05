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
    img.src = src;
    return out;
  }

  return { Spring, Particles, aura, auraColor, breathe, easeOutBack, tinted, skin };
})();
