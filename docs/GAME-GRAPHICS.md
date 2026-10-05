# เรียนจากเกม: แผนยกระดับกราฟิก overlay (5 ต.ค. 2026)

สรุปจากการศึกษาวิธีทำกราฟิกของเกม casual/mobile และเกมสาย cute ระดับท็อป — ใช้คู่กับ [PASTEL-3D.md](PASTEL-3D.md)

## ข้อสรุปหลัก
- เกม/คู่แข่งที่ดูพรีเมียม **ไม่ได้วาดด้วยโค้ด** แต่ใช้ภาพที่เรนเดอร์จาก 3D (Blender/Spline) หรือ AI แล้วแก้มือ → จัดเป็นชั้น
  `[เงา] → [ด้านหลัง back.webp] → [ของขวัญ + ฟิสิกส์] → [ด้านหน้า front.webp บังของ] → [แสง/ประกาย]`
  ชั้นหน้าที่ "บัง" ของขวัญคือสิ่งที่ทำให้ดูอยู่ในโหลจริงมากที่สุด
- ตัวเรนเดอร์แนะนำ **PixiJS v8 (WebGL)**: เร็วกว่า Canvas 2D มาก, มี filter (Glow, Bloom, Displacement ทำกระจกหักเห, ColorMatrix เปลี่ยนสีธีม), ParticleContainer — ฟิสิกส์ custom เดิมใช้ต่อได้ (แยกฟิสิกส์ออกจากการวาด)
- OBS: WebGL ต้องเปิด Browser Source Hardware Acceleration (ค่าเริ่มต้นเปิด) — เก็บ Canvas 2D เดิมไว้เป็น fallback
- ภาพ: WebP q≈85 มี alpha, ขนาด @1x = ขนาดจริงบนจอ 1080p, atlas ด้วย free-tex-packer (trim + extrude) ระวังขอบดำ/halo (premultiplied alpha)

## "Juice" — ทำให้มีชีวิต (กฎ: ทุก event มี feedback ≥ 3 ชั้น และจบใน 400ms)
- ยุบ-ยืดตอนตกกระทบ (คงปริมาตร sx·sy≈1), โหลสั่นแบบสปริงเมื่อของใหญ่ตก, ฝุ่นตอนลงพื้น, ประกายตอนของเข้า
- เครื่อง "หายใจ" (scale ±1.5% ที่ 0.5Hz), กิ่งไม้แกว่งแบบมี phase ต่อชั้น, ตัวเลขนับวิ่ง + เด้ง
- ของขวัญแพง: ออร่าตามระดับราคา (ทอง/ม่วง/ฟ้า) + ลำดับ reveal (แสงรวม → แฟลช → ปรากฏ), hit-stop 40–80ms, สั่นจอเบา ๆ เฉพาะของใหญ่
```js
class Spring { constructor(k=180,d=12){this.k=k;this.d=d;this.x=0;this.v=0;this.target=0}
  kick(v){this.v+=v} step(dt){const a=-this.k*(this.x-this.target)-this.d*this.v;this.v+=a*dt;this.x+=this.v*dt;return this.x} }
```

## แสงแบบเกม 2D
อบแสงในภาพ (ทิศซ้ายบนทุกชิ้น) · เงาสัมผัสเป็นวงรีนุ่ม multiply · glow เป็นภาพเรืองแสง blend add (ถูกกว่า filter) ·
ไฮไลต์กระจกเป็นชั้นหน้า + DisplacementFilter · Bloom เฉพาะชั้น fx · ห้าม vignette (บังหน้ากล้อง) · ColorMatrix ทำธีมกลางคืน/เทศกาล

## บทเรียนจากเกมเทพ
| เกม | จุดเด่น | เอามาใช้ |
|---|---|---|
| Cookie Run: Kingdom | 2D + Spine mesh, ทรงมน, outline สีเข้มของสีเดิม | outline สีเข้มของสีเนื้อ (ไม่ใช่ดำ), เครื่องหายใจ |
| Animal Crossing | toon shading + rim light, UI ฟองเด้ง | ป้ายแจ้งเตือนทรงฟอง pop-in easeOutBack |
| Fall Guys | วัสดุไวนิล/ของเล่นเป่าลม, โยกเยก | ของขวัญโยกตัวหลังลงพื้น (spring rotation) |
| Monument Valley | พาเลตคุมเข้ม 3 โทน/วัตถุ, มุมกล้องเดียว | พาเลต 5–6 สี/ธีม, ทุกภาพมุมเดียวกัน |
| Candy Crush | specular จุดแรง ๆ เหมือนลูกอม, ข้อความ combo | ประกายวิ่งบนของขวัญ, "x5 COMBO!" |
| Genshin (ไอคอน) | กรอบ/ออร่าตามความหายาก, reveal ที่ชัด | ออร่าตามมูลค่าของขวัญ |
| Royal Match | ทุกชิ้น wiggle, แอนิเมชัน ≤ 400ms | idle wiggle phase ต่างกัน, ตัวเลข count-up + punch |

**Art Bible**: ไม่มีมุมแหลม · พาเลตพาสเทล 5–6 สี เงาม่วง/ฟ้า · แสงซ้ายบน + rim · outline สีเข้มของสีเดิม · ทุกชิ้นขยับเบา ๆ ตลอด · feedback ≥ 3 ชั้น ≤ 400ms

## หาภาพแบบประหยัด
- AI (gpt-image ที่รองรับพื้นใส, Midjourney, Flux, SDXL+LayerDiffuse) — ใช้ "style anchor" prompt เดียวกันทุกภาพ + ภาพอ้างอิง/seed เดิม, สร้างทั้งชุดพร้อมกันให้แสงตรงกัน, แยกชั้นหน้า/หลังเองใน Photopea/Krita, upscale (Upscayl), ลบพื้น (rembg) แล้วตรวจขอบ
- ร้านค้า: Kenney (CC0), itch.io, Sketchfab (โมเดล → เรนเดอร์เอง) — อ่าน license ทุกชิ้น
- จ้าง Fiverr/ArtStation ~$50–300/ธีม: ระบุโอนลิขสิทธิ์เต็ม + ได้ไฟล์ .blend + ใช้ใน SaaS ได้
- ⚠️ ภาพ AI ล้วนจดลิขสิทธิ์ไม่ได้ (US Copyright Office 2025) → ควรแก้มือมาก ๆ / ห้าม prompt ชื่อเกมหรือ IP คนอื่น / ToS ของผู้ให้บริการ AI ต้องอนุญาตเชิงพาณิชย์

## แผนย้ายทีละขั้น
1. Art Bible + style prompt (S)
2. ทดลอง PixiJS v8 กับโหลแก้ว 1 ใบ (ฟิสิกส์เดิม) วัด CPU ใน OBS (S)
3. ภาพชุดแรก jar_back / jar_front / shadow / glow → WebP + atlas (M)
4. Juice พื้นฐาน: Spring, ยุบ-ยืด, โหลสั่น, ฝุ่น, ประกาย, หายใจ (S) — ทำได้ทันทีแม้ยังเป็น Canvas 2D
5. Theme manifest JSON (ชั้นภาพ + collider + anchor) + loader + ตรวจ schema (M)
6. เงาสัมผัส + glow sprite + ไฮไลต์กระจกชั้นหน้า (S)
7. DisplacementFilter กระจกหักเห + ParticleContainer หิมะ/confetti (M)
8. แกลเลอรีธีมใน Dashboard + สลับธีมโดยของไม่หาย + ปรับสีด้วย ColorMatrix (M)
9. เครื่องมือวาง collider/anchor + ย้ายวิดเจ็ตที่เหลือ: เครื่องจักร → รถ → กระถาง (L)
10. Pipeline ผลิตธีม (เทมเพลต Blender, checklist license), พิจารณา Spine สำหรับมาสคอต (L)

แหล่งอ้างอิงหลัก: pixijs.com (v8 performance, filters, ParticleContainer), github.com/pixijs/filters, free-tex-packer.org,
บทความ game juice (valdemird.com, gameanalytics.com), OpenAI cookbook (transparent assets), copyright.gov/ai,
บทวิเคราะห์ Royal Match (naavik.co), Fall Guys art (ArtStation magazine), Monument Valley design analysis
