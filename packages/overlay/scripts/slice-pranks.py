"""Slice prank sprites (effect=prank) -> fx/prank/<name>.webp
usage: python packages/overlay/scripts/slice-pranks.py docs/prank packages/overlay/public/fx/prank [contact.png]
   อินพุต docs/prank/prank-sheet-{a,b,c}.png (ชีต 3x3 พื้นขาว) + ภาพเดี่ยว prank-<ชื่อ>.png (พื้นเขียว #00FF00 หรือพื้นใสมาแล้ว)
   ต้องมี numpy pillow scipy

ขั้นตอน
 1) ชีต: ซิลูเอต = flood fill พื้นขาวจากขอบ (min ช่อง >= 232 + สีซีด) · ขอบนุ่มแบบ color-to-alpha เทียบขาว
 2) แบ่ง 3x3 ตามร่องว่าง (หยดสี/เศษกระจายที่ลอยแยกชิ้นยังอยู่ช่องเดียวกัน) · ทิ้งจุดเล็กกว่า 40px
 3) ภาพเดี่ยว: พื้นเขียว → คีย์ตามความเขียว (g สูง r,b ต่ำ) ขอบนุ่ม + ลดเขียวติดขอบ · พื้นใสมาแล้ว → ตัดฝุ่น alpha ต่ำ ๆ ทิ้ง
 4) ครอปชิดตัว + ขอบ 6px · ด้านยาวสุด <= 512px · webp q90 alpha 100
"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

SRC, OUT = sys.argv[1:3]
CONTACT = sys.argv[3] if len(sys.argv) > 3 else None
PAD, MAXS = 6, 512
SHEETS = {
    'a': ['tomato', 'egg', 'pie', 'ink', 'paint', 'bubble', 'pan', 'duck', 'cushion'],
    'b': ['roach', 'spider', 'mosquito', 'bomb', 'chicken', 'hammer', 'hand', 'nose', 'bucket'],
    'c': ['pigeon', 'snowball', 'kiss', 'note-yellow', 'note-pink', 'tape', 'balloon-pop', 'alarm', 'fart-cloud'],
}
SINGLES = ['crack', 'jail', 'slime', 'ghost', 'banana', 'pie2']


def sheet_alpha(im):
    mn, mx = im.min(2), im.max(2)
    near = (mn >= 232) & (mx - mn <= 14)
    lab, _ = ndi.label(near)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])); edge = edge[edge > 0]
    bg = np.isin(lab, edge)
    core = ndi.binary_opening(~bg, iterations=1)
    D = (254.0 - im).max(2)
    a = np.clip((D - 3.0) / 60.0, 0, 1)  # ขอบนอก: ยิ่งต่างจากขาวยิ่งทึบ
    soft = np.clip((ndi.distance_transform_edt(core) - 0.5) / 1.5, 0, 1)
    alpha = np.where(core, np.maximum(a, soft), 0.0)
    A = np.maximum(alpha, 1e-3)[..., None]
    F = np.clip((im - (1 - A) * 254.0) / A, 0, 255)  # ถอดสีขาวที่ปนขอบออก
    return alpha, F


SOLID = {'snowball'}  # วัตถุขาวล้วน (หิมะ) ขอบกลืนกับพื้นขาว → ซิลูเอตจาก "ต่างจากขาวนิดเดียว" + ปิดช่อง + เติมรู


def solid_fill(im, alpha, F, m):
    D = (254.0 - im).max(2) * (m > 0)
    blob = ndi.binary_opening(D > 5, iterations=2)
    lab, n = ndi.label(blob)
    if n: blob = lab == (np.argmax(ndi.sum(blob, lab, range(1, n + 1))) + 1)  # ก้อนใหญ่สุด (เกล็ดรอบ ๆ ใช้ alpha เดิม)
    blob = ndi.binary_fill_holes(ndi.binary_closing(np.pad(blob, 10), iterations=5)[10:-10, 10:-10])
    soft = np.clip((ndi.distance_transform_edt(blob) - 0.5) / 2.0, 0, 1)
    add = (m > 0) & (soft > alpha)
    F[add] = im[add]  # พิกเซลที่เติมเข้ามา = สีจริงของหิมะ (ไม่ถอดขาว)
    return np.where(add, soft, alpha)


def cuts(prof, n, L):
    prof = np.convolve(prof.astype(float), np.ones(9) / 9, 'same')
    out = [0]
    for k in range(1, n):
        c = int(k * L / n); lo, hi = c - L // (3 * n), c + L // (3 * n)
        seg = prof[lo:hi]; z = np.where(seg <= seg.min() + 0.5)[0]
        runs = np.split(z, np.where(np.diff(z) > 1)[0] + 1); best = max(runs, key=len)
        out.append(lo + int(best.mean()))
    return out + [L]


def despeckle(alpha, minpx=40):
    lab, n = ndi.label(alpha > 0.05)
    if n:
        sz = ndi.sum(np.ones_like(alpha), lab, range(1, n + 1))
        small = np.isin(lab, np.where(sz < minpx)[0] + 1)
        alpha = np.where(small, 0, alpha)
    return alpha


def save(name, alpha, F):
    alpha = despeckle(alpha)
    ys, xs = np.where(alpha > 0.02)
    y0, y1, x0, x1 = max(0, ys.min() - PAD), min(alpha.shape[0], ys.max() + PAD + 1), max(0, xs.min() - PAD), min(alpha.shape[1], xs.max() + PAD + 1)
    rgba = np.dstack([F[y0:y1, x0:x1], alpha[y0:y1, x0:x1, None] * 255]).round().clip(0, 255).astype(np.uint8)
    img = Image.fromarray(rgba, 'RGBA')
    s = MAXS / max(img.size)
    if s < 1: img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    img.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=90, alpha_quality=100, method=6)
    return img


def single(path):
    im = Image.open(path).convert('RGBA'); a = np.asarray(im).astype(float)
    rgb, al = a[..., :3], a[..., 3] / 255.0
    g, mrb = rgb[..., 1], np.maximum(rgb[..., 0], rgb[..., 2])
    gness = g - mrb
    if (al > 0.9).mean() > 0.95 and ((gness > 150) & (al > 0.9)).mean() > 0.15:  # พื้นเขียวทึบ → คีย์
        k = 1 - np.clip((gness - 70) / 80.0, 0, 1)
        k = np.where(ndi.binary_fill_holes(k > 0.5) & (k < 0.5) & (gness < 200), np.maximum(k, 0.5), k)
        alpha = k
        edge = (alpha > 0) & (alpha < 1) | (ndi.binary_dilation(alpha < 0.98, iterations=2) & (alpha > 0))
        rgb = rgb.copy(); rgb[..., 1] = np.where(edge, np.minimum(g, mrb + 40), g)  # ลดเขียวติดขอบ
        A = np.maximum(alpha, 1e-3)[..., None]
        bg = np.array([0, 255, 0.0])
        F = np.where(edge[..., None], np.clip((rgb - (1 - A) * bg) / A, 0, 255), rgb)
        F[..., 1] = np.where(edge, np.minimum(F[..., 1], mrb + 40), F[..., 1])
    else:  # พื้นใสมาแล้ว (ตัวสร้างภาพถอดพื้นให้) → ตัดฝุ่น alpha ต่ำ + ยืดช่วง alpha ให้ทึบเต็ม
        alpha = np.clip((al - 0.05) / (0.97 - 0.05), 0, 1)
        F = rgb.copy()
        if (gness > 120).any():  # ขอบเขียวหลงเหลือ
            F[..., 1] = np.where((gness > 120) & (alpha < 1), mrb, F[..., 1])
    return alpha, F


os.makedirs(OUT, exist_ok=True)
done = []
for sk, names in SHEETS.items():
    p = os.path.join(SRC, 'prank-sheet-%s.png' % sk)
    if not os.path.exists(p): print('missing', p); continue
    im = np.asarray(Image.open(p).convert('RGB')).astype(float)
    alpha, F = sheet_alpha(im)
    H, W = alpha.shape
    cy, cx = cuts((alpha > 0.1).sum(1), 3, H), cuts((alpha > 0.1).sum(0), 3, W)
    for i, name in enumerate(names):
        r, c = divmod(i, 3)
        m = np.zeros_like(alpha); m[cy[r]:cy[r + 1], cx[c]:cx[c + 1]] = 1
        if name in SOLID: alpha = solid_fill(im, alpha, F, m)
        done.append((name, save(name, alpha * m, F)))
for name in SINGLES:
    p = os.path.join(SRC, 'prank-%s.png' % name)
    if not os.path.exists(p): print('missing', p); continue
    alpha, F = single(p)
    done.append((name, save(name, alpha, F)))
for n, im in done: print('%-12s %dx%d %5.1fKB' % (n, im.width, im.height, os.path.getsize(os.path.join(OUT, n + '.webp')) / 1024))
if CONTACT:  # ชีตตรวจ: พื้นตารางหมากรุก + ชื่อ
    from PIL import ImageDraw
    T = 200; cols = 8; rows = (len(done) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * T, rows * (T + 18)), (60, 60, 70)); d = ImageDraw.Draw(sheet)
    for i, (n, im) in enumerate(done):
        x, y = (i % cols) * T, (i // cols) * (T + 18)
        bgc = Image.new('RGB', (T, T), (120, 170, 120) if (i % 2) else (110, 110, 140))
        t = im.copy(); t.thumbnail((T - 8, T - 8), Image.LANCZOS)
        bgc.paste(t, ((T - t.width) // 2, (T - t.height) // 2), t)
        sheet.paste(bgc, (x, y)); d.text((x + 4, y + T + 2), n, fill=(255, 255, 255))
    sheet.save(CONTACT)
