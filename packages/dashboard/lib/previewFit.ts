/**
 * พรีวิววิดเจ็ตแบบซูมพอดี: วัดกรอบรวมของสิ่งที่มองเห็นในหน้า overlay (iframe โดเมนเดียวกัน)
 * ไม่นับพื้นหลัง/แคนวาสเต็มจอ แล้วคืนค่าซูม + จุดกึ่งกลาง (หน่วยพิกเซลของจอจำลอง W×H)
 */
export interface Fit { z: number; cx: number; cy: number }

export function measureFit(frame: HTMLIFrameElement | null, W: number, H: number, maxZ = 3): Fit | null {
  let d: Document | null | undefined;
  try { d = frame?.contentDocument; } catch { return null; }
  if (!d?.body) return null;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const el of Array.from(d.body.querySelectorAll<HTMLElement>('*'))) {
    if (/^(SCRIPT|STYLE|IFRAME)$/.test(el.tagName)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || (r.width > W * 0.88 && r.height > H * 0.88) || r.right < 0 || r.bottom < 0 || r.left > W || r.top > H) continue;
    const cs = d.defaultView!.getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05) continue;
    if (!el.children.length || el.tagName === 'IMG' || el.tagName === 'CANVAS' || cs.backgroundImage !== 'none' || cs.backgroundColor !== 'rgba(0, 0, 0, 0)') {
      x0 = Math.min(x0, Math.max(0, r.left)); y0 = Math.min(y0, Math.max(0, r.top)); x1 = Math.max(x1, Math.min(W, r.right)); y1 = Math.max(y1, Math.min(H, r.bottom));
    }
  }
  if (x1 <= x0) return null;
  const w = x1 - x0, h = y1 - y0;
  return { z: Math.max(0.4, Math.min(maxZ, 0.88 * Math.min(W / w, H / h))), cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

/** transform ของ iframe ขนาด W×H ให้จุด (cx,cy) อยู่กลางกรอบ boxW×boxH ที่ซูม z */
export function fitTransform(f: Fit, W: number, H: number, boxW: number, boxH: number): string {
  const S = (boxW / W) * f.z;
  let tx = boxW / 2 - f.cx * S, ty = boxH / 2 - f.cy * S;
  if (S * W >= boxW) tx = Math.min(0, Math.max(boxW - W * S, tx)); // ไม่ให้เห็นขอบจอจำลอง
  if (S * H >= boxH) ty = Math.min(0, Math.max(boxH - H * S, ty));
  return `translate(${tx}px, ${ty}px) scale(${S})`;
}
