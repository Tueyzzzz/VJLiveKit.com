/**
 * พรีวิววิดเจ็ตแบบซูมพอดี: วัดกรอบรวมของสิ่งที่มองเห็นในหน้า overlay (iframe โดเมนเดียวกัน)
 * ไม่นับพื้นหลัง/แคนวาสเต็มจอ แล้วคืนค่าซูม + จุดกึ่งกลาง (หน่วยพิกเซลของจอจำลอง W×H)
 */
export interface Fit { z: number; cx: number; cy: number }

/**
 * กรอบรวมของสิ่งที่มองเห็นในหน้า overlay (พิกัดจอจำลอง W×H) — null = หาไม่เจอ
 * - องค์ประกอบ DOM ทั่วไป (ไม่นับพื้นหลัง/กล่องเต็มจอ)
 * - [data-fit] = วิดเจ็ตบอกกรอบเนื้อหาเอง
 * - แคนวาสเต็มจอ (เกม/รถลาก/เครื่องหยอดเหรียญ ...) → สแกนพิกเซลที่วาดจริง
 *   เดิมข้ามแคนวาสเต็มจอทั้งอัน ทำให้ซูมไปที่ป้ายตัวเลขด้านบนอย่างเดียว ตัวเกมหลุดกรอบ
 */
export function contentBox(d: Document, W: number, H: number): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const add = (l: number, t: number, r: number, b: number) => { x0 = Math.min(x0, Math.max(0, l)); y0 = Math.min(y0, Math.max(0, t)); x1 = Math.max(x1, Math.min(W, r)); y1 = Math.max(y1, Math.min(H, b)); };
  for (const el of Array.from(d.body.querySelectorAll<HTMLElement>('*'))) {
    if (/^(SCRIPT|STYLE|IFRAME)$/.test(el.tagName)) continue;
    const r = el.getBoundingClientRect();
    if (el.hasAttribute('data-fit')) { add(r.left, r.top, r.right, r.bottom); continue; } // วิดเจ็ตบอกกรอบเนื้อหาเอง
    if (r.width < 4 || r.height < 4 || r.right < 0 || r.bottom < 0 || r.left > W || r.top > H) continue;
    const cs = d.defaultView!.getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05) continue;
    if (r.width > W * 0.88 && r.height > H * 0.88) { // เต็มจอ: แคนวาส → หาพิกเซลที่วาดจริง · อย่างอื่น (พื้นหลัง) ไม่นับ
      if (el.tagName === 'CANVAS') { const b = canvasBox(el as HTMLCanvasElement, r); if (b) add(b[0], b[1], b[2], b[3]); }
      continue;
    }
    if (!el.children.length || el.tagName === 'IMG' || el.tagName === 'CANVAS' || cs.backgroundImage !== 'none' || cs.backgroundColor !== 'rgba(0, 0, 0, 0)') add(r.left, r.top, r.right, r.bottom);
  }
  return x1 > x0 && y1 > y0 ? { x0, y0, x1, y1 } : null;
}

/**
 * กรอบพิกเซลที่ไม่โปร่งใสบนแคนวาส (พิกัดหน้าจอ)
 * แคนวาสที่วาดรูปของขวัญจากโดเมนอื่นแล้ว (tainted) อ่านพิกเซลไม่ได้ → ใช้ผลครั้งก่อนที่อ่านได้ (วัดครั้งแรกก่อนของขวัญโผล่)
 */
const lastCanvasBox = new WeakMap<HTMLCanvasElement, [number, number, number, number]>();
function canvasBox(cv: HTMLCanvasElement, r: DOMRect): [number, number, number, number] | null {
  const b = readCanvasBox(cv, r);
  if (b) lastCanvasBox.set(cv, b);
  return b ?? lastCanvasBox.get(cv) ?? null;
}
function readCanvasBox(cv: HTMLCanvasElement, r: DOMRect): [number, number, number, number] | null {
  try {
    const w = cv.width, h = cv.height; if (!w || !h) return null;
    // ย่อลงก่อนแล้วค่อยอ่าน (เร็ว: ~240 พิกเซลกว้าง)
    const k = Math.min(1, 240 / w), sw = Math.max(1, Math.round(w * k)), sh = Math.max(1, Math.round(h * k));
    const tmp = cv.ownerDocument.createElement('canvas'); tmp.width = sw; tmp.height = sh;
    const g = tmp.getContext('2d', { willReadFrequently: true }); if (!g) return null;
    g.drawImage(cv, 0, 0, sw, sh);
    const px = g.getImageData(0, 0, sw, sh).data;
    let a = sw, b = sh, c = -1, e = -1;
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) if (px[(y * sw + x) * 4 + 3]! > 24) { if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > e) e = y; }
    if (c < 0) return null;
    const fx = r.width / sw, fy = r.height / sh;
    return [r.left + a * fx, r.top + b * fy, r.left + (c + 1) * fx, r.top + (e + 1) * fy];
  } catch { return null; } // tainted canvas
}

export function measureFit(frame: HTMLIFrameElement | null, W: number, H: number, maxZ = 3): Fit | null {
  let d: Document | null | undefined;
  try { d = frame?.contentDocument; } catch { return null; }
  if (!d?.body) return null;
  const box = contentBox(d, W, H); if (!box) return null;
  const w = box.x1 - box.x0, h = box.y1 - box.y0;
  return { z: Math.max(0.4, Math.min(maxZ, 0.88 * Math.min(W / w, H / h))), cx: (box.x0 + box.x1) / 2, cy: (box.y0 + box.y1) / 2 };
}

/** transform ของ iframe ขนาด W×H ให้จุด (cx,cy) อยู่กลางกรอบ boxW×boxH ที่ซูม z */
export function fitTransform(f: Fit, W: number, H: number, boxW: number, boxH: number): string {
  const S = (boxW / W) * f.z;
  let tx = boxW / 2 - f.cx * S, ty = boxH / 2 - f.cy * S;
  if (S * W >= boxW) tx = Math.min(0, Math.max(boxW - W * S, tx)); // ไม่ให้เห็นขอบจอจำลอง
  if (S * H >= boxH) ty = Math.min(0, Math.max(boxH - H * S, ty));
  return `translate(${tx}px, ${ty}px) scale(${S})`;
}
