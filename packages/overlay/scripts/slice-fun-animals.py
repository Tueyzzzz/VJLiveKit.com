"""Slice 6-frame sprite sheets (white bg) -> aligned transparent frames (native resolution, sharp).
usage: python packages/overlay/scripts/slice-fun-animals.py docs/fun packages/overlay/public/fx/animals <debug_dir> [names...]
   ต้องมี numpy pillow scipy"""
import sys, os, glob, json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

SRC, OUT, DBG = sys.argv[1:4]
ONLY = sys.argv[4:]
MAX_H = 720   # ผืนรวมสูงเกินนี้ค่อยย่อ (ปกติชีตให้ตัวสูง ~450–560px → เก็บความละเอียดเดิม ไม่ resample เลย)
PAD = 8

def process(path):
    name = os.path.basename(path)[4:-4]
    im = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    H, W, _ = im.shape
    mn, mx = im.min(2), im.max(2)
    bgc = float(np.median(np.concatenate([im[:4].reshape(-1, 3), im[-4:].reshape(-1, 3)]).min(1)))
    # 1) พื้นขาว: ไล่จากขอบ (ขาวเกือบล้วน ไม่มีสี)
    near = (mn >= bgc - 9) & (mx - mn <= 10)
    lab, n = ndi.label(near)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    # ช่องขาวปิดล้อม (ระหว่างแขนกับตัว ฯลฯ): ขาวล้วนมาก + ใหญ่พอ
    sizes = ndi.sum(np.ones_like(mn), lab, index=np.arange(n + 1))
    strict = (mn >= bgc - 3) & (mx - mn <= 4)
    for k in range(1, n + 1):
        if k in border or sizes[k] < 250: continue
        m = lab == k
        if strict[m].mean() > 0.9: bg |= m
    fg = ~bg
    fg = ndi.binary_opening(fg, iterations=1)
    fg = ndi.binary_fill_holes(fg) & ~(bg & strict)
    # 2) แบ่ง 6 เฟรม: เส้นตัดที่จุดต่ำสุดของโปรไฟล์คอลัมน์ใกล้ k*W/6
    prof = np.convolve(fg.sum(0).astype(float), np.ones(9) / 9, 'same')
    cuts = [0]
    for k in range(1, 6):
        c = int(k * W / 6); lo, hi = c - W // 14, c + W // 14
        seg = prof[lo:hi]
        z = np.where(seg <= seg.min() + 0.5)[0]
        runs = np.split(z, np.where(np.diff(z) > 1)[0] + 1)
        best = max(runs, key=len)
        cuts.append(lo + int(best[len(best) // 2]))
    cuts.append(W)
    # ชิ้นที่ล้ำเส้นตัด (หูกระต่าย ฯลฯ) → ยกทั้งชิ้นให้เฟรมที่มันอยู่ส่วนใหญ่ · ชิ้นที่ติดกันสองตัวจริง ๆ ค่อยตัดตามเส้น
    LF, NF = ndi.label(fg)
    owner = np.full(NF + 1, -1)
    for k, sl in enumerate(ndi.find_objects(LF), start=1):
        cm = LF[sl] == k
        colsum = cm.sum(0); xs0 = sl[1].start
        share = [colsum[max(0, cuts[i] - xs0):max(0, cuts[i + 1] - xs0)].sum() for i in range(6)]
        tot = sum(share)
        if tot and max(share) >= 0.8 * tot: owner[k] = int(np.argmax(share))
    frames = []
    for i in range(6):
        own = np.isin(LF, np.nonzero(owner == i)[0])
        cut = np.zeros_like(fg); cut[:, cuts[i]:cuts[i + 1]] = True
        mi = own | (fg & cut & np.isin(LF, np.nonzero(owner == -1)[0]))
        xs = np.nonzero(mi.any(0))[0]
        x0, x1 = int(xs.min()), int(xs.max()) + 1
        m = mi[:, x0:x1].copy()
        l2, n2 = ndi.label(m)
        ar = ndi.sum(m, l2, index=np.arange(1, n2 + 1))
        mainl = int(np.argmax(ar)) + 1
        near_main = ndi.binary_dilation(l2 == mainl, iterations=14)
        mm = np.zeros_like(m)
        for j in range(1, n2 + 1):
            if ar[j - 1] < 0.035 * ar.max(): continue   # เส้นเคลื่อนไหว/ประกายเล็ก ๆ ทิ้ง
            cj = l2 == j
            if j == mainl or (cj & near_main).any() or ar[j - 1] >= 0.15 * ar.max(): mm |= cj
        frames.append((x0, mm))
    # 3) อัลฟานุ่มเฉพาะขอบ 2px + ถอดสีขาวที่ปนขอบออก (ไม่เบลอเนื้อใน → คมเท่าต้นฉบับ)
    rgba = []
    for x0, m in frames:
        sub = im[:, x0:x0 + m.shape[1]]
        smn, smx = sub.min(2), sub.max(2)
        inner = ndi.binary_erosion(m, iterations=2)
        band = m & ~inner
        a = np.where(inner, 1.0, 0.0)
        soft = np.clip((bgc - smn) / 26.0, 0, 1)
        a[band] = soft[band]
        a = ndi.gaussian_filter(a, 0.55) * ndi.binary_dilation(m, iterations=1)
        a = np.clip(a, 0, 1); a[inner] = 1.0
        col = sub.copy()
        e = (a > 0.02) & (a < 0.999)
        for ch in range(3):
            c = col[..., ch]; c[e] = (c[e] - (1 - a[e]) * bgc) / a[e]
        col = np.clip(col, 0, 255)
        # เงาพื้นสีเทาอ่อน → เงาโปร่งสีเข้มนุ่ม ๆ (ไม่เป็นคราบขาวบนกล้อง)
        ys = np.nonzero(m.any(1))[0]
        yb0 = int(ys.max() - (ys.max() - ys.min()) * 0.10)
        band2 = np.zeros_like(m); band2[yb0:] = True
        sh = band2 & m & (smx - smn <= 9) & (smn >= 195)
        l3, n3 = ndi.label(sh)
        if n3:
            touch = np.unique(l3[ndi.binary_dilation(~ndi.binary_dilation(m, iterations=1), iterations=2) & sh])
            sh = np.isin(l3, touch[touch > 0])
        sa = np.clip((bgc - sub.mean(2)) / 40.0, 0, 1) * 0.5
        a[sh] = sa[sh]; col[sh] = (60, 40, 70)
        rgba.append((x0, m, np.dstack([col, a * 255]).round().astype(np.uint8)))
    # 4) จัดตำแหน่ง: เท้าแนบพื้นเดียวกัน (เฟรมลอยกลางอากาศคงความสูงเดิม) + x ตามจุดศูนย์กลางครึ่งล่างของตัว
    info = []
    for x0, m, px in rgba:
        ys, xs = np.nonzero(m)
        top = ys.min()
        rows = m.sum(1); thr = max(3, rows.max() * 0.04)
        bot2 = int(np.nonzero(rows >= thr)[0].max())
        lower = m.copy(); lower[:int(top + (bot2 - top) * 0.5)] = False
        info.append(dict(top=int(top), bot=bot2, cx=float(np.nonzero(lower)[1].mean()), w=m.shape[1]))
    ground = max(f['bot'] for f in info)
    hgt = np.median([f['bot'] - f['top'] for f in info])
    for f in info:
        f['dy'] = ground - f['bot'] if ground - f['bot'] <= 0.05 * hgt else 0
    canv_w = int(max(max(f['cx'], f['w'] - f['cx']) for f in info) * 2) + 2 * PAD + 4
    tops = [f['top'] + f['dy'] for f in info]
    bots = [int(np.nonzero(rgba[i][1].any(1))[0].max()) + info[i]['dy'] for i in range(6)]
    y0, y1 = min(tops) - PAD, max(bots) + PAD
    canv_h = y1 - y0
    outs = []
    for (x0, m, px), f in zip(rgba, info):
        c = Image.new('RGBA', (canv_w, canv_h), (0, 0, 0, 0))
        c.paste(Image.fromarray(px, 'RGBA'), (int(round(canv_w / 2 - f['cx'])), int(f['dy'] - y0)))  # เลื่อนเป็นจำนวนเต็ม = ไม่ resample
        outs.append(c)
    union = np.zeros((canv_h, canv_w), bool)
    for c in outs: union |= np.asarray(c)[..., 3] > 8
    ys, xs = np.nonzero(union)
    half = max(canv_w / 2 - xs.min(), xs.max() + 1 - canv_w / 2) + PAD
    bx0, bx1 = int(canv_w / 2 - half), int(canv_w / 2 + half)
    by0, by1 = max(0, ys.min() - PAD), min(canv_h, ys.max() + 1 + PAD)
    cw, chh = bx1 - bx0, by1 - by0
    sc = min(1.0, MAX_H / chh)
    ow, oh = int(round(cw * sc)), int(round(chh * sc))
    od = os.path.join(OUT, name); os.makedirs(od, exist_ok=True)
    final = []
    for i, c in enumerate(outs):
        cc = Image.new('RGBA', (cw, chh), (0, 0, 0, 0)); cc.paste(c, (-bx0, -by0))
        if sc < 1:  # ย่อครั้งเดียวด้วย LANCZOS แบบ premultiplied (กันขอบดำ)
            arr = np.asarray(cc).astype(np.float32); al = arr[..., 3:4] / 255
            pm = np.dstack([arr[..., :3] * al, arr[..., 3:]])
            r = np.stack([np.asarray(Image.fromarray(pm[..., k]).resize((ow, oh), Image.LANCZOS)) for k in range(4)], -1)
            a2 = np.clip(r[..., 3:4], 0, 255) / 255
            rgb = np.where(a2 > 0.003, r[..., :3] / np.maximum(a2, 1e-3), 0)
            cc = Image.fromarray(np.dstack([np.clip(rgb, 0, 255), np.clip(r[..., 3], 0, 255)]).round().astype(np.uint8), 'RGBA')
        cc.save(os.path.join(od, f'{i}.webp'), 'WEBP', quality=92, method=6, alpha_quality=100, exact=False)
        final.append(cc)
    strip = Image.new('RGBA', (ow * 6, oh * 2), (0, 0, 0, 255))
    for i, o in enumerate(final):
        d = Image.new('RGBA', (ow, oh), (40, 30, 60, 255)); d.alpha_composite(o); strip.paste(d, (i * ow, 0))
        d = Image.new('RGBA', (ow, oh), (255, 140, 200, 255)); d.alpha_composite(o); strip.paste(d, (i * ow, oh))
    strip.convert('RGB').save(os.path.join(DBG, f'{name}.png'))
    return name, ow, oh

os.makedirs(DBG, exist_ok=True)
res = {}
for p in sorted(glob.glob(os.path.join(SRC, 'fun-*.png'))):
    nm = os.path.basename(p)[4:-4]
    if ONLY and nm not in ONLY: continue
    name, ow, oh = process(p)
    res[name] = [ow, oh]; print(name, ow, oh, flush=True)
print(json.dumps(res))
