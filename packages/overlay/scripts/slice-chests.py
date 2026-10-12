"""Slice treasure-chest / super-fan-bag sheets (5x2 grid, white bg) -> aligned transparent sprites.
usage: python packages/overlay/scripts/slice-chests.py docs/chest packages/overlay/public/fx [debug_dir]
   อินพุต docs/chest/{chest,bag}-{closed,open}.png (1983x793) · เอาต์พุต fx/{chest,bag}/{kind}-01..10-{closed,open}.webp
   ต้องมี numpy pillow scipy

ขั้นตอน
 1) ชีตไม่มีแสงฟุ้งนอกตัว (หีบทั้งหมด + ถุงปิด): ซิลูเอต flood fill พื้นขาว → ทึบ, ขอบ color-to-alpha
    ถุงเปิด (แสงพุ่งบนพื้นขาว): แมตต์แบบ "color-to-alpha" เทียบพื้นขาว: แสงฟุ้ง/ประกายบนพื้นขาว → กึ่งโปร่ง (ถอดขาวออก) แทนการตัดแข็ง
 2) เนื้อวัตถุ (ห่างจากขาวชัด) + รูเล็กในตัว = ทึบ 100% · ขอบเนื้อจางนุ่ม ~1.5px
 3) แบ่ง 5x2 ตามร่องว่าง · ชิ้นลอย (เหรียญ/หัวใจ) ยกให้ช่องที่จุดศูนย์กลางอยู่
 4) จัดคู่ ปิด/เปิด: ยึด "ฐาน" (กึ่งกลางแถวล่าง 25% ของเนื้อ + ขอบล่าง) ให้ตรงพิกเซลเดียวกัน · ผืนผ้าใบขนาดเท่ากันทั้งคู่
    → ใน JS วาดโดยยึดกลางล่างของภาพ (anchor = W/2, H-PAD) ได้เลย
"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

SRC, OUT = sys.argv[1:3]
DBG = sys.argv[3] if len(sys.argv) > 3 else None
COLS, ROWS, PAD = 5, 2, 6
WHITE = 254.0


def c2a(im):
    """color-to-alpha against white → (alpha, unmixed rgb)"""
    D = (WHITE - im).max(2)
    a = np.clip((D - 3.0) / (WHITE - 3.0), 0, 1)
    return a, D


def flood_sil(D):
    """ซิลูเอตจาก flood fill พื้นขาวจากขอบ (D<10) · ไม่เจาะช่องขาวข้างใน (แสงจ้า/ครีมขาว = เนื้อ)"""
    near = D < 10
    lab, n = ndi.label(near)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])); edge = edge[edge > 0]
    bg = np.isin(lab, edge)
    return ~bg


def build(im, glow=False):
    a, D = c2a(im)
    if not glow:
        # ไม่มีแสงฟุ้งนอกตัว → ใช้ซิลูเอต flood fill ตรง ๆ (ส่วนสีอ่อน/ขาวที่ขอบ เช่น เปลือกหอย ไม่หาย)
        core = ndi.binary_opening(flood_sil(D), iterations=1)
        dist = ndi.distance_transform_edt(core)
        soft = np.clip((dist - 0.5) / 1.5, 0, 1)
        alpha = np.maximum(a, soft); alpha[alpha < 0.02] = 0
        A = np.maximum(alpha, 1e-3)[..., None]
        F = np.clip((im - (1 - A) * WHITE) / A, 0, 255)
        return alpha, F, core & (D > 20)
    core = D > 42
    core = ndi.binary_opening(core, iterations=1)
    # รูในตัว (ไฮไลต์ขาว ลูกไม้ขาว หน้าหมี แสงจ้าในหีบ) → ทึบ: ปิดช่องที่ขอบก่อน (closing) แล้วเติมรูทุกขนาด
    #   พิกเซลที่ closing เติมตรงปากช่อง (แนวขอบนอก) ยังใช้ color-to-alpha ต่อ = ไม่มีเส้นขาวแข็งรอบตัว
    st = ndi.generate_binary_structure(2, 1)
    closed = ndi.binary_closing(np.pad(core, 8), structure=st, iterations=7)[8:-8, 8:-8] | core
    interior = ndi.binary_fill_holes(closed)
    core = core | (interior & (ndi.distance_transform_edt(interior) > 7))
    # ขอบเนื้อนุ่ม: distance-based ramp 0..1 ภายใน 1.5px
    dist = ndi.distance_transform_edt(core)
    soft = np.clip((dist - 0.5) / 1.5, 0, 1)
    alpha = np.maximum(a, soft)
    alpha[alpha < 0.02] = 0
    # ถอดสีขาว: P = A*F + (1-A)*W → F
    A = np.maximum(alpha, 1e-3)[..., None]
    F = (im - (1 - A) * WHITE) / A
    F = np.clip(F, 0, 255)
    return alpha, F, core


def find_cuts(prof, n, L):
    prof = np.convolve(prof.astype(float), np.ones(9) / 9, 'same')
    cuts = [0]
    for k in range(1, n):
        c = int(k * L / n); lo, hi = c - L // (3 * n), c + L // (3 * n)
        seg = prof[lo:hi]
        z = np.where(seg <= seg.min() + 0.5)[0]
        runs = np.split(z, np.where(np.diff(z) > 1)[0] + 1)
        best = max(runs, key=len)
        cuts.append(lo + int(best[len(best) // 2]))
    cuts.append(L)
    return cuts


def split(alpha, core):
    H, W = alpha.shape
    on = alpha > 0.06
    rc = find_cuts(on.sum(1), ROWS, H)
    cells = []
    for r in range(ROWS):
        cc = find_cuts(on[rc[r]:rc[r + 1]].sum(0), COLS, W)
        for c in range(COLS):
            cells.append((rc[r], rc[r + 1], cc[c], cc[c + 1]))
    lab, n = ndi.label(alpha > 0)
    coms = ndi.center_of_mass(alpha, lab, index=np.arange(1, n + 1))
    owner = np.full(n + 1, -1)
    for k, (cy, cx) in enumerate(coms, start=1):
        for i, (y0, y1, x0, x1) in enumerate(cells):
            if y0 <= cy < y1 and x0 <= cx < x1: owner[k] = i; break
    masks = []
    for i in range(len(cells)):
        masks.append(np.isin(lab, np.nonzero(owner == i)[0]))
    return masks


def anchor(core_m):
    ys = np.nonzero(core_m.any(1))[0]
    top, bot = ys.min(), ys.max()
    band = core_m[int(bot - 0.25 * (bot - top)):bot + 1]
    xs = np.nonzero(band)[1]
    return bot, float(xs.mean()), top


def main():
    os.makedirs(DBG, exist_ok=True) if DBG else None
    for kind in ('chest', 'bag'):
        sheets = {}
        for st in ('closed', 'open'):
            im = np.asarray(Image.open(os.path.join(SRC, f'{kind}-{st}.png')).convert('RGB')).astype(np.float64)
            alpha, F, core = build(im, glow=(kind == 'bag' and st == 'open'))
            masks = split(alpha, core)
            sheets[st] = (alpha, F, core, masks)
        od = os.path.join(OUT, kind); os.makedirs(od, exist_ok=True)
        for i in range(COLS * ROWS):
            parts = {}
            for st in ('closed', 'open'):
                alpha, F, core, masks = sheets[st]
                m = masks[i]
                cm = core & m
                # ฐาน: เนื้อชิ้นใหญ่สุดเท่านั้น (กันเหรียญที่หล่นต่ำ)
                l, n = ndi.label(cm)
                ar = ndi.sum(cm, l, index=np.arange(1, n + 1))
                body = l == (int(np.argmax(ar)) + 1)
                by, bx, btop = anchor(body)
                ys, xs = np.nonzero(m)
                parts[st] = dict(a=np.where(m, alpha, 0), F=F, by=by, bx=bx, y0=ys.min(), y1=ys.max(), x0=xs.min(), x1=xs.max(),
                                 bw=body[int(by - 0.25 * (by - btop)):by + 1].any(0).sum())
            # ขนาดผืนผ้าใบร่วม (ยึดฐานตรงกลางล่าง)
            up = max(p['by'] - p['y0'] for p in parts.values()) + PAD
            dn = max(p['y1'] - p['by'] for p in parts.values()) + PAD
            hw = max(max(p['bx'] - p['x0'], p['x1'] - p['bx']) for p in parts.values()) + PAD
            Wc, Hc = int(np.ceil(2 * hw)) + 1, int(up + dn) + 1
            for st, p in parts.items():
                ox = int(round(p['bx'] - Wc / 2)); oy = int(p['by'] - up)
                out = np.zeros((Hc, Wc, 4))
                H, W = p['a'].shape
                sy0, sy1 = max(oy, 0), min(oy + Hc, H); sx0, sx1 = max(ox, 0), min(ox + Wc, W)
                out[sy0 - oy:sy1 - oy, sx0 - ox:sx1 - ox, :3] = p['F'][sy0:sy1, sx0:sx1]
                out[sy0 - oy:sy1 - oy, sx0 - ox:sx1 - ox, 3] = p['a'][sy0:sy1, sx0:sx1] * 255
                img = Image.fromarray(np.clip(np.round(out), 0, 255).astype(np.uint8), 'RGBA')
                fn = os.path.join(od, f'{kind}-{i + 1:02d}-{st}.webp')
                img.save(fn, 'WEBP', quality=92, alpha_quality=100, method=6)
                if DBG:
                    bg = Image.new('RGBA', img.size, (24, 18, 40, 255)); bg.alpha_composite(img)
                    bg.convert('RGB').save(os.path.join(DBG, f'{kind}-{i + 1:02d}-{st}.png'))
            print(kind, i + 1, 'canvas', Wc, Hc, 'base widths', parts['closed']['bw'], parts['open']['bw'], 'dn', dn)


main()
