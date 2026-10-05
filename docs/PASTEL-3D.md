# แนวทางกราฟิก Pastel Soft 3D (Claymorphism / Toy 3D) สำหรับ overlay

สรุปจากการศึกษา (5 ต.ค. 2026) — ใช้เป็นมาตรฐานเวลาวาดวิดเจ็ตด้วย Canvas 2D

## หลักการแสงเงา
- **แสงทิศเดียวทั้งฉาก**: key light ซ้ายบน (`LIGHT = {x:-0.6, y:-0.8}`) — ทุก gradient/ไฮไลต์/เงาอ้างทิศนี้
- **ลำดับ value**: highlight → light → midtone → **core shadow (terminator)** → reflected light → AO → contact/cast shadow
- **ของเล่น/ดินน้ำมัน**: มุมโค้งมาก (radius ≥ 1/4 ของด้านสั้น), ขอบ bevel มีสันสว่าง, เงานุ่มยาว, มี rim light ฝั่งตรงข้ามแสง (สำคัญบนพื้นหลังเกม/กล้อง)
- **Clay** = ไฮไลต์ใหญ่ฟุ้ง 20–40% · **Plastic** = ไฮไลต์ฟุ้ง + specular จุดเล็กคม

## สีพาสเทล
- พื้นผิวหลัก: HSL S 40–75%, L 78–90% (หรือ OKLCH L 0.82–0.93, C 0.04–0.12)
- **ห้ามเงาดำ/ไฮไลต์ขาวล้วน** — เงา: หมุน hue ไปทางเย็น 10–30°, S +5–15%, L −10–20 · ไฮไลต์: หมุนไปทางอุ่น 10–25°, S −10–25%, L ขึ้น
- เงาบนพื้น/AO ใช้ม่วง `rgba(90,70,140,α)` + `multiply`; ตัวอักษร/เส้นใช้ `#4B3F72`
- พาเลต (base / shadow / highlight):
  Pink `#FFB5C8/#D98AB5/#FFE3DA` · Mint `#A8E6CF/#6FBFB8/#E4FBD9` · Lavender `#C9B8FF/#9C8BE0/#EEE6FF`
  Peach `#FFD3A5/#E3A08F/#FFF1D6` · Sky `#A9D8FF/#7BA4E6/#E2F4FF` · Butter `#FFF1A8/#E0C27F/#FFFBE0`

## สูตร Canvas 2D
- ทรงกลม/ปุ่ม: radial gradient 3 stop (hi → base → core shadow) + ขอบ reflected + specular ด้วย `screen`
- Inner shadow (clay): clip รูปทรง แล้วเติม "วงแหวน" (`evenodd`) พร้อม `shadowBlur` — สว่างบนซ้าย + มืดล่างขวา
- Extrusion/bevel: ซ้อน rounded rect จากหลังมาหน้า ไล่สี shadow → base แล้ววางหน้าหลัก + สันขาว
- Contact shadow/AO: วงรี/gradient แคบสีม่วง α 0.3 → 0 ตรงจุดสัมผัส (ใต้กล่อง, ร่องฝา, ใต้ลูกกลิ้ง)
- แก้ว: tint ฟ้า/ลาเวนเดอร์ α 0.12–0.2 · Fresnel (ขอบซ้าย/ขวาขาวกว่ากลาง) · specular แถบโค้งขอบคม · ขอบปากวงรีหน้า/หลัง · ก้นหนา
- Blend: `screen` ไฮไลต์/glow · `multiply` เงา · `soft-light` noise บาง ๆ ให้ผิวไม่ดิจิทัลเกิน
- **Performance (OBS)**: ชิ้นที่นิ่ง (ตัวเครื่อง/โหล/เงา) วาดลง offscreen canvas ครั้งเดียวแล้ว `drawImage`; อย่าใช้ `shadowBlur` ทุกเฟรม

## Sprite vs Procedural
- เจ้าดัง ๆ (เช่น VJ-Studio) ใช้ภาพ render ล่วงหน้า (PNG/WebP/WebM จาก Blender/Spline/C4D) สำหรับตัวเครื่อง + โค้ดเฉพาะส่วนไดนามิก
- แนะนำ hybrid: วาด procedural → cache เป็น bitmap; ถ้ามี asset 3D ในอนาคตสลับเป็น sprite ได้โดยไม่รื้อระบบ
- อยากได้ refraction/SSS จริง → three.js (`MeshPhysicalMaterial` transmission/clearcoat) แต่หนักกว่า

## Checklist ที่จะนำไปใช้
1. ล็อกแสงจุดเดียว 2. เงาทั้งหมดเป็นม่วง+multiply 3. palette helper (hue-shift) 4. ตัวเครื่อง rounded + extrusion + สันบน
5. inner shadow คู่ให้แผง/ปุ่ม/ช่องปล่อย 6. ปุ่ม/หมุดแบบ ball() 7. ลูกกลิ้งทรงกระบอก + AO สายพาน + เงาใต้สายพาน
8. contact shadow ใต้ของขวัญ (+ squash เล็กน้อยตอนตก) 9. —
10. โหล: tint + Fresnel + specular 2 เส้น + ขอบปากหน้า/หลัง + ก้นหนา 11. ของในโหล: AO จุดซ้อน, ฝาแบบ clay
12. rim light ทุกชิ้น + cache ชิ้นนิ่งลง offscreen canvas

แหล่งอ้างอิงหลัก: proko.com (light & form), muddycolors.com (core shadow, anatomy of shadows), evilmartians.com (OKLCH),
MDN globalCompositeOperation, dorian-iten.com/fresnel, claymorphism (theplusaddons, bamboolab)
