# Prompt สร้างภาพธีมด้วย AI (สไตล์ Pastel Toy 3D)

ใช้กับ ChatGPT (สร้างภาพ), Midjourney, Leonardo, Flux หรือเครื่องมืออื่นก็ได้ — **ใช้ "Style anchor" เดียวกันทุกภาพ** ภาพจะได้แสง/สี/มุมกล้องตรงกันทั้งชุด

## กติกาไฟล์
- ขนาด **2048×2048** (หรือใหญ่สุดที่เครื่องมือให้) · **PNG พื้นหลังโปร่งใส** (ถ้าเครื่องมือทำพื้นใสไม่ได้ ให้พื้นขาวล้วน — ฉันลบพื้นให้)
- วัตถุ **อยู่กลางภาพ** กินพื้นที่ ~80% · **ไม่มีตัวหนังสือ/โลโก้** (ป้าย VJLiveKit เราใส่เอง) · **ไม่มีเงาบนพื้น** (เราทำเงาเอง)
- มุมกล้อง: **มองตรงจากด้านหน้า ก้มลงเล็กน้อย ~15°** ทุกภาพ · แสงหลัก **ซ้ายบน**
- เซฟไว้ที่ `C:\Users\btuey\Project\VJLiveKit\assets\ai\` ตั้งชื่อตามตาราง แล้วบอกฉัน — ฉันจะตัดขอบ แปลงเป็น WebP สร้างเส้นขอบชนจากรูป (ฟิสิกส์) แล้วใส่เป็นธีมให้
- ⚠️ ห้ามใส่ชื่อเกม/แบรนด์/ตัวละครของคนอื่นใน prompt · ใช้บัญชีที่อนุญาตใช้เชิงพาณิชย์ · ภาพ AI ล้วนจดลิขสิทธิ์ไม่ได้ (ถ้าจะกันลอก ให้แก้มือเพิ่มภายหลัง)

## Style anchor (วางหน้าทุก prompt)
```
Cute pastel 3D toy render, soft matte vinyl and clay material, chunky rounded shapes with thick bevelled edges,
no sharp corners, soft studio lighting from the top-left, gentle rim light, subtle ambient occlusion,
pastel palette (soft pink #FFC8DD, lavender #CDB4FF, mint #BDE8DA, butter yellow #FFF1B8, baby blue #BDE0FE, cream #FFF6E5),
shadows tinted lilac not black, clean premium mobile-game asset, front view tilted down about 15 degrees,
centered, isolated object, transparent background, no text, no logo, no ground shadow
```

## ภาพที่ต้องการ (ทีละภาพ: Style anchor + บรรทัดนี้)
| ไฟล์ | ใช้กับ | Prompt ต่อท้าย |
|---|---|---|
| `machine.png` | coinjar (เครื่องจักร) | `a toy gift-dispensing machine shaped like a cute arcade cabinet on four short legs, square body, a dark rounded opening on the lower left side where gifts come out, a small screen panel on the front, a carry handle on top, small round buttons` |
| `belt.png` | coinjar (สายพาน) | `a short toy conveyor belt seen from the front-side, dark rubber belt with pastel rails, round lavender rollers underneath, two small legs, long horizontal shape` |
| `jar.png` | โหลแก้ว | `an empty clear glass candy jar with a narrow neck and a pastel screw lid ring, highly transparent glass with soft reflections, nothing inside` |
| `bowl.png` | โหลกลม | `an empty round fishbowl-shaped clear glass jar with a wide rolled rim, highly transparent glass, nothing inside` |
| `mason.png` | โหลฝาผ้า | `an empty clear glass mason jar with a red gingham cloth cover tied with twine in a bow, transparent glass, nothing inside` |
| `globe.png` | ลูกแก้วหิมะ | `a snow globe with a cream ornate base decorated with pink roses and two tiny bunnies, inside a tiny cozy cottage and a small pine tree on snow, the upper half of the glass dome empty` |
| `car.png` | รถ | `a cute retro pastel minivan seen from directly behind, mint and cream two-tone body, pink stripe, round tail lights, blank license plate, a flat roof rack with rails on top, small yellow flag` |
| `pot.png` | กระถางต้นไม้ | `an ornate cream ceramic flower pot with embossed swirl patterns and a tiny bunny relief, filled with dark soil, no plant` |
| `gift-frame-gold.png` (ออปชัน) | ออร่าของแพง | `a round decorative golden badge frame with sparkles, empty center, for a game reward icon` |

> เคล็ดลับให้ทั้งชุดเข้ากัน: สร้างภาพแรก (เช่น jar) ให้ถูกใจก่อน แล้วภาพต่อไปแนบภาพแรกเป็น "ภาพอ้างอิงสไตล์" (ChatGPT: แนบรูปแล้วบอก "same style as this image") หรือ Midjourney ใช้ `--sref <url>` + seed เดิม

## สิ่งที่ฉันจะทำเมื่อได้ภาพ
1. ลบพื้น (ถ้ายังไม่ใส) ตัดขอบใส แปลง WebP q85 ขนาดพอดีจอ 1080p
2. **สร้างเส้นขอบชนจากรูปอัตโนมัติ** (อ่านความโปร่งใสของภาพ → โปรไฟล์ความกว้างโหล/หลังคารถ) ฟิสิกส์จึงตรงกับรูปเป๊ะ
3. ใส่เป็นธีม: รูปเป็นชั้นหลัง → ของขวัญ → ไฮไลต์กระจก/ขอบปากชั้นหน้า (วาดด้วยโค้ดให้กลืนกับรูป)
4. เพิ่มในหน้าตั้งค่า (เลือกธีม "รูปภาพ" หรือ "วาดด้วยโค้ด") — ลิงก์ใน OBS ไม่ต้องเปลี่ยน
