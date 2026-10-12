"""Slice PHOTOREALISTIC 12-frame sprite sheets (4x3 grid, white studio bg) -> aligned transparent frames.
usage: python packages/overlay/scripts/slice-real-animals.py docs/real packages/overlay/public/fx/animals <debug_dir> [names...]
   อินพุต docs/real/real-<ชื่อ>.png · เอาต์พุต <out>/real-<ชื่อ>/0..11.webp (ความละเอียดเดิม ไม่ขยาย)
   ต้องมี numpy pillow scipy

ขั้นตอน
 1) คีย์พื้นขาว: flood fill จากขอบ (ขาวเกือบล้วน) + ช่องขาวปิดล้อมที่ใหญ่พอ
 2) แบ่งช่อง 4x3 ตามร่องขาว · ชิ้นที่ล้ำเส้น (หาง/หู) ยกทั้งชิ้นให้ช่องที่มันอยู่ส่วนใหญ่ · กิ่งไม้ยาวทะลุช่อง → ตัดตามเส้นแล้วจางปลาย
 3) แมตต์นุ่มสำหรับขนจริง: แถบขอบ ~4px คำนวณอัลฟาจากสีขนข้างใน (F) เทียบพื้น (B) → alpha = <B-P, B-F>/|B-F|²
    แล้วถอดสีขาวที่ปนขอบออก (decontaminate) · เนื้อในทึบ 100% ไม่เบลอ = คมเท่าต้นฉบับ
 4) เงาพื้นสีเทา → เงาโปร่งสีเข้ม (คูณแสงจริง) จาง ๆ
 5) จัดตำแหน่ง: ปรับสเกล (ย่ออย่างเดียว) ให้ขนาดตัวเท่ากัน + ยึดเท้ากลางล่าง (x = centroid ครึ่งล่างของตัว)
"""
import sys, os, glob, json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

SRC, OUT, DBG = sys.argv[1:4]
ONLY = sys.argv[4:]
PAD = 10
COLS, ROWS = 4, 3

# โหมดจัดตำแหน่งต่อตัว: feet = เท้าแนบพื้นเดียวกัน · perch = ยึดกิ่งไม้ · hop = เก็บความสูงตอนกระโดด · center = นอนหงาย (ยึดจุดศูนย์กลางตัว)
# scale = ปรับขนาดให้ตัวเท่ากันไหม (ท่าที่ขนาดตัวเปลี่ยนจริง เช่น ยืดตัว/ยกแขน → ปิด) · drop = เฟรมที่ทิ้ง (กล้อง/ท่าหลุด)
CFG = {
    'budgie': dict(mode='perch', scale=False), 'owl': dict(mode='perch'),
    'lamb': dict(mode='hop', scale=False), 'kittenswat': dict(mode='center', scale=False, low=0.0, gap=True),
    'catstretch': dict(scale=False, gap=True, drop=[10, 11]), 'hedgehog': dict(gap=True), 'puppywave': dict(scale=False, gap=True), 'redpanda': dict(scale=False, gap=True), 'raccoon': dict(gap=True), 'shibatilt': dict(gap=True), 'panda': dict(scale=False),
    'foxyawn': dict(scale=False), 'corgiwiggle': dict(scale=False, gap=True), 'penguin': dict(scale=False, holes=True),
}


def sstep(x):
    x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)


def key_sheet(im):
    """คืน fg mask (รวมเงา), ค่าพื้น B (3,), ระยะห่างจากพื้น D"""
    H, W, _ = im.shape
    border = np.concatenate([im[:3].reshape(-1, 3), im[-3:].reshape(-1, 3), im[:, :3].reshape(-1, 3), im[:, -3:].reshape(-1, 3)])
    B = np.median(border, 0)
    mn, mx = im.min(2), im.max(2)
    dl = np.clip(B[None, None, :] - im, 0, None).max(2)          # มืดลงจากพื้น
    ch = np.clip((mx - mn) - (B.max() - B.min()), 0, None)       # มีสีขึ้นมา
    D = np.maximum(dl, ch * 1.4)
    near = D < 6.0
    lab, n = ndi.label(near)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    # ช่องขาวปิดล้อม (ระหว่างแขนกับตัว ฯลฯ): ต้องขาวล้วนมาก + ใหญ่พอ (ขนขาวในตัวมีลาย/เงา → ไม่ผ่าน)
    sizes = ndi.sum(np.ones_like(D), lab, index=np.arange(n + 1))
    strict = D < 2.5
    sl = ndi.find_objects(lab)
    lum = im.mean(2)
    for k in range(1, n + 1):
        if k in edge or sizes[k] < 300: continue
        m = lab[sl[k - 1]] == k
        core = ndi.binary_erosion(m, iterations=3)
        if core.sum() < 120: continue
        # พื้นสตูดิโอ = เรียบมาก (ขนขาวมีลายเส้น → std สูงกว่า)
        if strict[sl[k - 1]][core].mean() > 0.97 and lum[sl[k - 1]][core].std() < 1.2: bg[sl[k - 1]] |= m
    fg = ~bg
    fg = ndi.binary_opening(fg, iterations=1)
    return fg, B, D


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


def split_cells(fg):
    """แบ่ง 12 ช่อง → list ของ (y0,y1,x0,x1, mask ในกรอบ)"""
    H, W = fg.shape
    rcuts = find_cuts(fg.sum(1), ROWS, H)
    cells = []
    for r in range(ROWS):
        ccuts = find_cuts(fg[rcuts[r]:rcuts[r + 1]].sum(0), COLS, W)
        for c in range(COLS):
            cells.append((rcuts[r], rcuts[r + 1], ccuts[c], ccuts[c + 1]))
    LF, NF = ndi.label(fg)
    owner = np.full(NF + 1, -1)
    for k, sl in enumerate(ndi.find_objects(LF), start=1):
        cm = LF[sl] == k
        ys, xs = np.nonzero(cm); ys = ys + sl[0].start; xs = xs + sl[1].start
        share = np.zeros(len(cells))
        for i, (y0, y1, x0, x1) in enumerate(cells):
            share[i] = ((ys >= y0) & (ys < y1) & (xs >= x0) & (xs < x1)).sum()
        if share.sum() and share.max() >= 0.8 * share.sum(): owner[k] = int(np.argmax(share))
    out = []
    for i, (y0, y1, x0, x1) in enumerate(cells):
        own = np.isin(LF, np.nonzero(owner == i)[0])
        cut = np.zeros_like(fg); cut[y0:y1, x0:x1] = True
        mi = own | (fg & cut & np.isin(LF, np.nonzero(owner == -1)[0]))
        # ทิ้งเศษเล็ก ๆ ที่ไม่ใช่ตัว
        l2, n2 = ndi.label(mi)
        if n2:
            ar = ndi.sum(mi, l2, index=np.arange(1, n2 + 1))
            keep = np.nonzero(ar >= 0.01 * ar.max())[0] + 1
            mi = np.isin(l2, keep)
        out.append((mi, (y0, y1, x0, x1)))
    return out


def matte(im, m, B, D, fade_x=None, low=0.80, gap=False, holes=False):
    """แมตต์นุ่ม + ถอดสีขาว + เงาโปร่ง → (rgba float, body mask, shadow mask) ตามกรอบ m"""
    H, W = m.shape
    mn, mx = im.min(2), im.max(2)
    chroma = (mx - mn) - (B.max() - B.min())
    # เงา: เทาไร้สี สว่าง อยู่ใต้ตัว
    shadowlike = m & (chroma <= 6) & (D < 48)
    core = m & ~shadowlike
    core = ndi.binary_opening(core, iterations=2)
    l, n = ndi.label(core)
    if n:
        ar = ndi.sum(core, l, index=np.arange(1, n + 1))
        core = np.isin(l, np.nonzero(ar >= 0.02 * ar.max())[0] + 1)
    ys = np.nonzero(core.any(1))[0]
    top, bot = ys.min(), ys.max()
    hgt = bot - top
    # "ข้างนอก" = พื้นขาวจริง + ขาวที่ทะลุถึงข้างนอกผ่านเงาใต้ตัว (เช่น ช่องระหว่างขาลูกแกะ ที่เงาพื้นปิดไว้)
    lowzone = np.zeros_like(m); lowzone[int(top + low * hgt):] = True
    # เงาใต้ตัวบางภาพอมสี (แสงสะท้อนขนส้ม) → ใช้ "เรียบ + สีจาง" แทนสีเทาล้วน (ขนมีลายเส้น → std สูง)
    L = im.mean(2); hp = L - ndi.gaussian_filter(L, 1.5)          # high-pass: ไล่เฉดเงาไม่นับ · ลายขนนับ
    tex = np.sqrt(ndi.uniform_filter(hp * hp, 5))
    sat = (mx - mn) / np.maximum(mx, 1)
    smooth_sh = (m & lowzone & (((tex < 2.2) & (sat < 0.09) & (D < 110)) | ((tex < 5) & (sat < 0.06) & (D < 90)))) if gap else np.zeros_like(m)  # gap=True เฉพาะตัวที่มีเงาใต้ท้องระหว่างขา
    shadowlike = shadowlike | smooth_sh
    passable = ~m | (m & (D < 6) & (chroma <= 4)) | (shadowlike & lowzone)
    lp, npass = ndi.label(passable)
    outl = np.unique(lp[~m]); outl = outl[outl > 0]
    outside = np.isin(lp, outl)
    # ช่องพื้นขาวแคบ ๆ ระหว่างขา (ปิดล้อมด้วยขา+เงา) = ขาวสนิทเรียบ (ขนขาวจริงยังมีเฉดอยู่ D~4) · เฉพาะครึ่งล่าง (กันประกายตา)
    pure = m & (D < 6) & (chroma <= 4) & ~outside
    lq, nq = ndi.label(pure)
    for k, slq in enumerate(ndi.find_objects(lq), start=1):
        if slq is None: continue
        q = lq[slq] == k
        if q.sum() < 60 or slq[0].stop < top + 0.45 * hgt: continue
        dm = D[slq][q].mean()
        if dm < 2.5 or (dm < 4.5 and slq[0].start > top + 0.6 * hgt): outside[slq] |= q
    if holes:  # ช่องสว่างเรียบ ๆ ระหว่างเท้า (พื้นขาวที่โดนเงาบัง ปิดล้อมด้วยเท้า+เงาสัมผัส) → เป็นเงาโปร่ง
        lit = m & ~outside & (D < 60) & (sat < 0.07) & (tex < 3.0)
        lq, nq = ndi.label(lit)
        for k, slq in enumerate(ndi.find_objects(lq), start=1):
            if slq is None: continue
            q = lq[slq] == k
            if q.sum() < 40 or slq[0].start < top + 0.6 * hgt: continue
            if D[slq][q].mean() < 45: outside[slq] |= q
    sh = outside & m & lowzone & ((chroma <= 8) | smooth_sh | (D < 60)) & (D >= 4)
    body = m & ~outside
    l, n = ndi.label(body)
    if n:
        ar = ndi.sum(body, l, index=np.arange(1, n + 1))
        body = np.isin(l, np.nonzero(ar >= 0.01 * ar.max())[0] + 1)
    # ---- แมตต์ของตัว (แถบขอบกว้าง ~8px: ขนจริงมีปลายฟูและแสงขอบขาวติดมา) ----
    dist_in = ndi.distance_transform_edt(body)
    inner = dist_in > 8
    band = ndi.binary_dilation(body, iterations=1) & ~inner
    # สีขนข้างใน (F) ใกล้ ๆ แต่ละจุดขอบ: normalized convolution จากชั้นในถัดจากแถบขอบ
    ring = (dist_in > 8) & (dist_in <= 14)
    wts = ndi.gaussian_filter(ring.astype(np.float32), 4.0)
    F = np.dstack([ndi.gaussian_filter(im[..., c] * ring, 4.0) for c in range(3)]) / np.maximum(wts, 1e-4)[..., None]
    BF = B[None, None, :] - F
    BP = B[None, None, :] - im
    den = (BF * BF).sum(2)
    a_col = np.clip((BP * BF).sum(2) / np.maximum(den, 1.0), 0, 1)
    # ตัวสีอ่อนใกล้ขาว (ลูกแกะ/ขนขาว) |B-F| เล็ก → เชื่อระยะจากขอบมากกว่า
    rel = sstep((np.sqrt(den) - 12) / 28)
    a_geo = np.minimum(np.clip(dist_in / 3.0, 0, 1), np.clip((D - 5) / 16.0, 0, 1))
    a_c = rel * a_col + (1 - rel) * a_geo
    floor = sstep((dist_in - 3) / 6)               # ลึกเข้าไปในตัว → ทึบขึ้นเรื่อย ๆ (กันรูโหว่)
    a = np.where(inner, 1.0, np.maximum(a_c, floor))
    a = np.where(inner, 1.0, ndi.gaussian_filter(a, 0.5))
    a *= ndi.binary_dilation(body, iterations=1)
    a = np.clip(a, 0, 1)
    # ถอดสีขาว: C = B + (P-B)/a_c · a_c ต่ำ (ขอบที่เป็นแสงขาวล้วน) → ใช้สีขนข้างใน F
    col = im.copy()
    e = band & (a > 0.01)
    est = np.clip(B[None, None, :] + (im - B[None, None, :]) / np.maximum(a_c, 0.05)[..., None], 0, 255)
    wgt = sstep((a_c - 0.08) / 0.55)[..., None]
    mix = wgt * est + (1 - wgt) * F
    col[e] = mix[e]
    col = np.clip(col, 0, 255)
    # ---- เงาโปร่ง: P = (1-s)B + s*S, S = สีเงาเข้ม ----
    S = np.array([38.0, 30.0, 44.0])
    s = np.clip((B.mean() - im.mean(2)) / (B.mean() - S.mean()), 0, 1) * 0.85
    s = ndi.gaussian_filter(s * sh, 1.2)
    s[body & (a > 0.5)] = 0
    # รวม: ตัวทับเงา
    A = a + s * (1 - a)
    C = (col * a[..., None] + S[None, None, :] * (s * (1 - a))[..., None]) / np.maximum(A, 1e-4)[..., None]
    if fade_x is not None:  # กิ่งไม้ยาวทะลุช่อง → จางปลายซ้าย-ขวา
        x0, x1 = fade_x
        xs = np.arange(W)[None, :]
        A = A * sstep((xs - x0) / 34.0) * sstep((x1 - xs) / 34.0)
    return np.dstack([np.clip(C, 0, 255), np.clip(A, 0, 1) * 255]), body, sh


def resize_rgba(px, sc):
    """ย่อแบบ premultiplied LANCZOS (กันขอบดำ)"""
    h, w = px.shape[:2]
    ow, oh = max(1, int(round(w * sc))), max(1, int(round(h * sc)))
    al = px[..., 3:4] / 255
    pm = np.dstack([px[..., :3] * al, px[..., 3:]]).astype(np.float32)
    r = np.stack([np.asarray(Image.fromarray(pm[..., k], 'F').resize((ow, oh), Image.LANCZOS)) for k in range(4)], -1)
    a2 = np.clip(r[..., 3:4], 0, 255) / 255
    rgb = np.where(a2 > 0.003, r[..., :3] / np.maximum(a2, 1e-3), 0)
    return np.dstack([np.clip(rgb, 0, 255), np.clip(r[..., 3], 0, 255)])


def measure(body, mode):
    ys, xs = np.nonzero(body)
    top = ys.min()
    rows = body.sum(1); thr = max(3, rows.max() * 0.04)
    bot = int(np.nonzero(rows >= thr)[0].max())
    hgt = bot - top
    if mode == 'perch':  # กิ่งไม้ = แถวที่กว้างที่สุด (ช่วงล่างของตัว)
        lo = int(top + 0.5 * hgt)
        sm = np.convolve(rows.astype(float), np.ones(7) / 7, 'same')
        gy = lo + int(np.argmax(sm[lo:bot + 1]))
        band = body.copy(); band[:int(gy - 0.28 * hgt)] = False; band[gy - 6:] = False
        return dict(top=int(top), bot=gy, cx=float(np.nonzero(band)[1].mean()), hgt=hgt, area=float(body[:gy - 6].sum()))
    if mode == 'center':
        return dict(top=int(top), bot=int(round(ys.mean() + 0.5 * hgt)), cx=float(xs.mean()), hgt=hgt, area=float(body.sum()))
    lower = body.copy(); lower[:int(top + hgt * 0.5)] = False
    return dict(top=int(top), bot=bot, cx=float(np.nonzero(lower)[1].mean()), hgt=hgt, area=float(body.sum()))


def process(path):
    name = os.path.basename(path)[5:-4]
    cfg = CFG.get(name, {})
    mode = cfg.get('mode', 'feet')
    im = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    fg, B, D = key_sheet(im)
    cells = split_cells(fg)
    frames = []
    for idx, (mi, (y0, y1, x0, x1)) in enumerate(cells):
        ys, xs = np.nonzero(mi)
        by0, by1 = max(0, ys.min() - 6), min(im.shape[0], ys.max() + 7)
        bx0, bx1 = max(0, xs.min() - 6), min(im.shape[1], xs.max() + 7)
        sub, m, d = im[by0:by1, bx0:bx1], mi[by0:by1, bx0:bx1], D[by0:by1, bx0:bx1]
        fade = (max(0, x0 - bx0), min(bx1, x1) - bx0) if mode == 'perch' else None
        if fade:  # กิ่ง: กรอบเท่าช่อง
            m = m.copy(); m[:, :fade[0]] = False; m[:, fade[1]:] = False
        px, body, sh = matte(sub, m, B, d, None, cfg.get('low', 0.80), cfg.get('gap', False), cfg.get('holes', cfg.get('gap', False)))
        f = dict(px=px, body=body, row=idx // COLS, oy=by0, **measure(body, mode))
        if fade: f['reach'] = min(f['cx'] - fade[0], fade[1] - f['cx'])
        frames.append(f)
    drop = set(cfg.get('drop', []))
    # ---- สเกล: ย่อเฟรมที่ใหญ่กว่าค่ากลางลงมา (ไม่ขยายเฟรมเล็ก) ----
    if cfg.get('scale', True):
        key = np.array([np.sqrt(f['area']) for f in frames])
        ref = np.median(key)
        for f, k in zip(frames, key):
            sc = ref / k
            if sc < 0.975:
                sc = max(sc, 0.9)
                f['px'] = resize_rgba(f['px'], sc)
                bm = Image.fromarray((f['body'] * 255).astype(np.uint8)).resize((f['px'].shape[1], f['px'].shape[0]), Image.BILINEAR)
                f['body'] = np.asarray(bm) > 127
                f.update(measure(f['body'], mode)); f['row'] = f['row']
            f['sc'] = round(float(min(1.0, max(sc, 0.9))), 3)
    # ---- พื้น: hop = เก็บความสูงตอนลอย (เทียบพื้นของแถวเดียวกันในชีต) · อื่น ๆ = แนบพื้นทั้งหมด ----
    for f in frames: f['dy'] = 0.0
    if mode == 'hop':
        hgt = np.median([f['hgt'] for f in frames])
        for r in range(ROWS):
            fr = [f for f in frames if f['row'] == r]
            ab = lambda f: f['bot'] + f['oy']  # ก้นเท้าในพิกัดชีต (แถวเดียวกัน = พื้นเดียวกัน)
            gmax = max(ab(f) for f in fr)
            grounded = [ab(f) for f in fr if gmax - ab(f) <= 0.03 * hgt]
            g = float(np.median(grounded))
            for f in fr:
                f['dy'] = -(g - ab(f)) if g - ab(f) > 0.03 * hgt else 0.0
    # ผืนรวม: วางทุกเฟรมให้จุดยึด (cx, bot+dy) ตรงกัน → ปัดเป็นจำนวนเต็ม (ไม่ resample)
    left = max(f['cx'] for f in frames); right = max(f['px'].shape[1] - f['cx'] for f in frames)
    up = max(f['bot'] - f['dy'] for f in frames); down = max(f['px'].shape[0] - f['bot'] + f['dy'] for f in frames)
    half = max(left, right)
    cw, chh = int(np.ceil(2 * half)) + 2 * PAD, int(np.ceil(up + down)) + 2 * PAD
    ax, ay = cw / 2, PAD + up
    canv = []
    for f in frames:
        c = np.zeros((chh, cw, 4), np.float32)
        ox, oy = int(round(ax - f['cx'])), int(round(ay - f['bot'] + f['dy']))
        h, w = f['px'].shape[:2]
        c[oy:oy + h, ox:ox + w] = f['px']
        canv.append(c)
    if mode == 'perch':  # กิ่งไม้ทุกเฟรมยาวเท่ากัน (ตัดที่ระยะสั้นสุด) แล้วจางปลายนุ่ม ๆ
        R = min(f['reach'] for f in frames) - 4
        xs_ = np.abs(np.arange(cw) - ax)
        fx = sstep((R - xs_) / 40.0)
        for c in canv: c[..., 3] *= fx[None, :]
    # ครอปให้พอดีทุกเฟรม (สมมาตรแกนกลาง)
    union = np.zeros((chh, cw), bool)
    for i, c in enumerate(canv):
        if i not in drop: union |= c[..., 3] > 6
    ys, xs = np.nonzero(union)
    hx = max(ax - xs.min(), xs.max() + 1 - ax) + PAD
    X0, X1 = int(np.floor(ax - hx)), int(np.ceil(ax + hx))
    Y0, Y1 = max(0, ys.min() - PAD), min(chh, ys.max() + 1 + PAD)
    od = os.path.join(OUT, 'real-' + name); os.makedirs(od, exist_ok=True)
    for old in glob.glob(os.path.join(od, '*.webp')): os.remove(old)
    keep = [i for i in range(len(canv)) if i not in drop]
    final = []
    for j, i in enumerate(keep):
        c = np.zeros((Y1 - Y0, X1 - X0, 4), np.float32)
        sx0, sx1 = max(0, X0), min(cw, X1)
        c[:, sx0 - X0:sx1 - X0] = canv[i][Y0:Y1, sx0:sx1]
        img = Image.fromarray(c.round().clip(0, 255).astype(np.uint8), 'RGBA')
        img.save(os.path.join(od, f'{j}.webp'), 'WEBP', quality=92, method=6, alpha_quality=100, exact=False)
        final.append(img)
    ow, oh = final[0].size
    # ดีบัก: พื้นเข้ม / ชมพู / ลายตาราง + เส้นพื้น
    strip = Image.new('RGB', (ow * 6, oh * 4))
    for j, o in enumerate(final):
        r, cix = divmod(j, 6)
        for k, bgc in enumerate([(36, 26, 52), (255, 140, 200)]):
            d = Image.new('RGBA', (ow, oh), bgc + (255,)); d.alpha_composite(o)
            strip.paste(d.convert('RGB'), (cix * ow, (r * 2 + k) * oh))
    strip.save(os.path.join(DBG, f'real-{name}.png'))
    return name, ow, oh, [f.get('sc', 1) for f in frames], [round(f['dy']) for f in frames], len(keep)


os.makedirs(DBG, exist_ok=True)
res = {}
for p in sorted(glob.glob(os.path.join(SRC, 'real-*.png'))):
    nm = os.path.basename(p)[5:-4]
    if ONLY and nm not in ONLY: continue
    name, ow, oh, sc, dy, nk = process(p)
    res[name] = [ow, oh, nk]; print(name, ow, oh, 'frames', nk, 'scale', sc, 'dy', dy, flush=True)
print(json.dumps(res))
