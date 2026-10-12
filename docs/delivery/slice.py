import sys, numpy as np
from PIL import Image
from scipy import ndimage as nd
src, outdir, prev = sys.argv[1], sys.argv[2], sys.argv[3]
FILL={'cloud':10,'stork':6,'chimney':6,'rainbow':4,'rocket':6,'wand':4,'pinata':3}
SHADOW={'truck':.7,'conveyor':.6,'catapult':.7,'slide':.7,'cannon':.7,'vending':.85}
KEEP={'truck':3,'wand':40,'hotair':3,'pinata':3,'vending':4}
names = ['pipe','parachute','balloons','claw','ufo','stork','cloud','rocket','slide','cannon','conveyor','hotair','drone','wand','catapult','chimney','pinata','vending','rainbow','truck']
im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
H, W, _ = im.shape
cw, chh = W/5, H/4
sheet = Image.new('RGBA', (5*260, 4*320), (40,40,60,255))
for i, n in enumerate(names):
    c, r = i % 5, i // 5
    x0, y0, x1, y1 = int(c*cw), int(r*chh), int((c+1)*cw), int((r+1)*chh)
    if n == 'ufo': y1 = y0 + 222
    y0 -= {'hotair':26,'vending':34,'pinata':40}.get(n,0)
    if n == 'hotair': y1 -= 40
    a = im[y0:y1, x0:x1]
    mn, mx = a.min(2), a.max(2)
    white = (mn >= 244) & (mx - mn <= 12)
    lab, k = nd.label(white)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:,0], lab[:,-1]]))) - {0}
    bg = np.isin(lab, list(border))
    fg = ~bg
    if n in FILL:
        filled = nd.binary_fill_holes(nd.binary_closing(fg, structure=np.ones((3,3)), iterations=FILL[n])) | fg
        ring = nd.binary_dilation(~filled, iterations=FILL[n] + 2)  # อย่าเติมมุมเว้าริมนอก (กันขอบขาวหยัก)
        fg = fg | (filled & ~ring)
    fl, fk = nd.label(fg)
    if fk > 1:
        sizes = nd.sum(fg, fl, range(1, fk+1)); main = fl == (1 + int(np.argmax(sizes)))
        near = nd.binary_dilation(main, iterations=KEEP.get(n, 14))
        keep = [i for i in range(1, fk+1) if (near & (fl == i)).any() and sizes[i-1] >= 6]
        fg = np.isin(fl, keep)
    bg = ~fg
    # soft edge: near-bg pixels get alpha from distance to white
    near = nd.binary_dilation(bg, iterations=2) & ~bg
    FILLED = np.zeros_like(bg)
    alpha = np.where(bg, 0.0, 1.0)
    wht = np.clip((255 - mn) / 40.0, 0, 1)  # how far from white
    alpha = np.where(near & ~FILLED, np.maximum(wht, 0.35) * 1.0, alpha)
    alpha = np.minimum(alpha, 1 - nd.gaussian_filter(bg.astype(np.float32), 0.7) * 0.6) * (~bg)
    if n == 'ufo':  # ตัดลำแสงออก ไล่จางขอบล่าง
        alpha[-12:] *= np.linspace(1, 0, 12)[:, None]
    shadow = np.zeros_like(bg)
    if n in SHADOW:  # เงาพื้นสีเทาอ่อน → เงาโปร่งสีเข้ม (ไม่เป็นก้อนขาวบนพื้นมืด)
        cand = (mx - mn <= 18) & (mn >= 190)
        cand[: int(cand.shape[0] * SHADOW[n])] = False
        ys, xs = np.nonzero(fg); box = np.zeros_like(cand); box[ys.min():ys.max() + 10, max(0, xs.min() - 8):xs.max() + 8] = True
        cand &= box
        cl, ck = nd.label(cand)
        touch = set(np.unique(cl[nd.binary_dilation(bg, iterations=1) & cand])) - {0}
        shadow = np.isin(cl, list(touch))
        lum = a.mean(2)
        sh = np.clip((252 - lum) / 60.0, 0, 1) * 0.55
        alpha = np.where(shadow, np.where(sh < 0.06, 0, sh), alpha)
    al = alpha[..., None]
    rgb = np.where(al > 0.02, (a - 255 * (1 - al)) / np.maximum(al, 1e-3), a)
    rgb = np.clip(rgb, 0, 255)
    rgb[shadow] = (70, 45, 80)
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    img = Image.fromarray(out, 'RGBA')
    bb = img.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    img = img.crop(bb)
    img.save(f'{outdir}/{n}.webp', 'WEBP', quality=94, alpha_quality=100, method=6)
    sheet.alpha_composite(img, (c*260 + (260-img.width)//2, r*320 + (320-img.height)//2))
    print(n, img.size, bb)
sheet.save(prev)
