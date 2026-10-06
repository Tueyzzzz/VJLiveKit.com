from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np
T = 'C:/Users/btuey/Project/VJLiveKit/packages/overlay/public/themes/'
OUT = 'C:/Users/btuey/Project/VJLiveKit/docs/social/'
F = 'C:/Windows/Fonts/'
def font(b, s): return ImageFont.truetype(F + ('LeelaUIb.ttf' if b else 'LeelawUI.ttf'), s)

def bg(w, h):
    y, x = np.mgrid[0:h, 0:w]; t = ((x / w + y / h) / 2)[..., None]
    a = np.array([255, 228, 240]); b = np.array([236, 228, 255]); c = np.array([222, 247, 240])
    g = np.where(t < .5, a + (b - a) * (t / .5), b + (c - b) * ((t - .5) / .5))
    return Image.fromarray(g.astype('uint8')).convert('RGBA')

def sticker(im, path, box, h):
    s = Image.open(path).convert('RGBA'); s = s.resize((round(s.width * h / s.height), h), Image.LANCZOS)
    sh = Image.new('RGBA', s.size, (0, 0, 0, 0)); sh.putalpha(s.getchannel('A').point(lambda v: v * 0.25))
    sh = sh.filter(ImageFilter.GaussianBlur(12))
    im.alpha_composite(sh, (box[0] + 8, box[1] + 14)); im.alpha_composite(s, box)

def card(d, xy, r=34, fill=(255, 255, 255, 215)):
    d.rounded_rectangle(xy, r, fill=fill)

PINK = (236, 72, 153); INK = (58, 35, 80); MUTED = (110, 90, 130)
logo = Image.open(OUT + 'profile.png').convert('RGBA').resize((96, 96), Image.LANCZOS)
m = Image.new('L', (96, 96), 0); ImageDraw.Draw(m).ellipse([0, 0, 95, 95], fill=255); logo.putalpha(m)

def footer(im, d, W, H):
    im.alpha_composite(logo, (60, H - 136))
    d.text((172, H - 128), 'VJLiveKit', font=font(1, 40), fill=PINK)
    d.text((172, H - 80), 'vjlivekit.com · ใช้ฟรีเดือนแรก', font=font(0, 30), fill=MUTED)

# ---------- โพสต์ 1: วิธีใส่วิดเจ็ต ----------
W, H = 1080, 1350
im = bg(W, H); d = ImageDraw.Draw(im)
d.text((60, 60), 'วิธีใส่วิดเจ็ตใน', font=font(1, 64), fill=INK)
d.text((60, 140), 'TikTok LIVE Studio', font=font(1, 72), fill=PINK)
d.rounded_rectangle([60, 250, 330, 310], 30, fill=PINK); d.text((88, 254), 'ภายใน 1 นาที', font=font(1, 38), fill='white')
sticker(im, T + 'jar-heart.webp', (800, 60), 230)
steps = [('1', 'สมัคร vjlivekit.com', 'ใส่ชื่อ TikTok ของคุณ'),
         ('2', 'เลือกวิดเจ็ตที่ชอบ', 'กด "คัดลอก URL"'),
         ('3', 'เปิด TikTok LIVE Studio', 'กด + แหล่งที่มา › ลิงก์ › วาง URL'),
         ('4', 'ลากปรับขนาด แล้วขึ้นไลฟ์!', 'แก้แบบทีหลัง จอเปลี่ยนเองไม่ต้องรีเฟรช')]
y = 370
for n, a, b in steps:
    card(d, [60, y, W - 60, y + 170])
    d.ellipse([90, y + 37, 186, y + 133], fill=PINK)
    tw = d.textlength(n, font=font(1, 56)); d.text((138 - tw / 2, y + 44), n, font=font(1, 56), fill='white')
    d.text((220, y + 30), a, font=font(1, 46), fill=INK)
    d.text((220, y + 98), b, font=font(0, 34), fill=MUTED)
    y += 188
d.text((60, y), 'ใช้กับ OBS ได้เหมือนกัน (Browser Source)', font=font(0, 32), fill=MUTED)
footer(im, d, W, H)
im.convert('RGB').save(OUT + 'post-howto.png')

# ---------- โพสต์ 2: 5 เทคนิค ----------
im = bg(W, H); d = ImageDraw.Draw(im)
d.text((60, 60), '5 เทคนิค', font=font(1, 96), fill=PINK)
d.text((60, 180), 'ให้คนดูอยากส่งของขวัญ', font=font(1, 58), fill=INK)
sticker(im, T + 'hearttank-front.webp', (760, 50), 260)
tips = [('🎯', 'ตั้งเป้าหมายบนจอ', 'คนดูจะช่วยกันดันให้ถึง'),
        ('🎁', 'โชว์ของขวัญสะสม', 'กองล้นจอ คนอยากเติมให้เต็ม'),
        ('🏆', 'ขอบคุณ + Top Gifters', 'ขึ้นชื่อคนส่งบนจอทุกครั้ง'),
        ('🔮', 'ผูกกิฟต์กับ Action', 'ส่งกุหลาบ › เปิดไพ่ทาโร่ทันที'),
        ('⏰', 'ไลฟ์เวลาเดิมทุกวัน', 'แฟนรู้ว่าต้องมาตอนไหน')]
y = 330; nums = ['1', '2', '3', '4', '5']
for i, (_, a, b) in enumerate(tips):
    card(d, [60, y, W - 60, y + 150])
    d.rounded_rectangle([90, y + 31, 178, y + 119], 26, fill=PINK)
    tw = d.textlength(nums[i], font=font(1, 52)); d.text((134 - tw / 2, y + 38), nums[i], font=font(1, 52), fill='white')
    d.text((210, y + 22), a, font=font(1, 44), fill=INK)
    d.text((210, y + 86), b, font=font(0, 32), fill=MUTED)
    y += 168
footer(im, d, W, H)
im.convert('RGB').save(OUT + 'post-tips.png')
print('ok')
