# ภาพ GPT 2x2 (พื้นขาว ชิ้นละมุม) → 4 sprite พื้นใส fx/sp/<ชื่อ>-0..3.webp (ด้านยาว 256px)
# ใช้: python -I slice-sprites4.py <ภาพ.png> <ชื่อ>   เช่น  docs/halloween/hw-bats.png bat
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as nd

src, name = sys.argv[1], sys.argv[2]
OUT = __file__.replace(chr(92), '/').rsplit('/scripts/', 1)[0] + '/public/' + (sys.argv[3] if len(sys.argv) > 3 else 'fx/sp') + '/'  # โฟลเดอร์ปลายทาง (ไม่ใส่ = fx/sp)
NAMES = sys.argv[4].split(',') if len(sys.argv) > 4 else None  # ชื่อไฟล์ 4 ชิ้น (บนซ้าย บนขวา ล่างซ้าย ล่างขวา)
MAXPX = int(sys.argv[5]) if len(sys.argv) > 5 else 256
im = Image.open(src).convert('RGB'); a = np.asarray(im).astype(np.int16)
mn = a.min(2); sp = a.max(2) - mn
lab, _ = nd.label((mn >= 232) & (sp <= 20))
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
fg = nd.binary_opening(~np.isin(lab, list(border)), iterations=1)
al = (fg * 255).astype(np.float32); edge = fg & ~nd.binary_erosion(fg, iterations=2)
al[edge] *= np.clip((255 - mn.astype(np.float32)) / 22.0, 0, 1)[edge]
al = np.array(Image.fromarray(al.astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6)))
rgba = np.dstack([np.asarray(im), al.astype(np.uint8)])
H, W = al.shape
# แยกตามชิ้นจริง: แต่ละก้อน (connected component) เป็นของมุมที่จุดศูนย์กลางของมันอยู่ → ชิ้นที่ยื่นข้ามเส้นกลางไม่ติดไปกับมุมอื่น
lab2, n2 = nd.label(al > 8)
cent = nd.center_of_mass(al > 8, lab2, range(1, n2 + 1)); size = nd.sum(al > 8, lab2, range(1, n2 + 1))
for i, (qy, qx) in enumerate([(0, 0), (0, 1), (1, 0), (1, 1)]):  # บนซ้าย บนขวา ล่างซ้าย ล่างขวา
    ids = [k + 1 for k, (cy, cx) in enumerate(cent) if size[k] > 30 and (cy >= H / 2) == bool(qy) and (cx >= W / 2) == bool(qx)]
    m = np.isin(lab2, ids); ys, xs = np.nonzero(m)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    piece = rgba.copy(); piece[..., 3] = np.where(m, piece[..., 3], 0)
    c = Image.fromarray(piece).crop((max(0, x0 - 3), max(0, y0 - 3), min(W, x1 + 4), min(H, y1 + 4)))
    c.thumbnail((MAXPX, MAXPX), Image.LANCZOS)
    c.save(f'{OUT}{NAMES[i] if NAMES else name + "-" + str(i)}.webp', 'WEBP', quality=90, alpha_quality=95, method=6)
    print(name, i, c.size)
