/**
 * ฟอร์มตั้งค่าวิดเจ็ต — ชื่อ key ตรงกับพารามิเตอร์ที่ overlay อ่าน (Overlay.param)
 * ค่าที่บันทึกถูกส่งให้ overlay ผ่าน socket → จอเปลี่ยนทันทีโดยไม่ต้องเปลี่ยนลิงก์
 */

export type FieldDef =
  | { key: string; label: string; type: 'range'; min: number; max: number; step: number; def: number; unit?: string; hint?: string; when?: (v: Values) => boolean }
  | { key: string; label: string; type: 'number'; min?: number; max?: number; def: number; hint?: string; when?: (v: Values) => boolean }
  | { key: string; label: string; type: 'select'; /** [ค่า, ชื่อ, กลุ่ม?, รูปย่อ?] — มีรูปย่อ = แสดงเป็นการ์ดรูปให้กดเลือก */ options: [string, string, string?, string?][]; def: string; hint?: string; when?: (v: Values) => boolean }
  | { key: string; label: string; type: 'toggle'; def: boolean; hint?: string; when?: (v: Values) => boolean }
  | { key: string; label: string; type: 'swatch'; /** [ค่า, สีที่แสดง, ชื่อ] */ options: [number, string, string][]; def: number; hint?: string; when?: (v: Values) => boolean }
  | { key: string; label: string; type: 'color'; def: string; hint?: string; when?: (v: Values) => boolean }
  | { key: string; label: string; type: 'text'; def: string; placeholder?: string; hint?: string; when?: (v: Values) => boolean };

export type Values = Record<string, string | number | boolean>;
export interface Section { title: string; fields: FieldDef[] }
export interface WidgetSettingsDef { sections: Section[]; /** มีข้อมูลที่จำไว้ (กองของขวัญ/อันดับ/เวลา) ให้ล้างได้ */ resettable?: string }

const FONTS: [string, string][] = [['Kanit', 'Kanit'], ['Prompt', 'Prompt'], ['Mitr', 'Mitr'], ['Sriracha', 'Sriracha (ลายมือ)'], ['Chakra Petch', 'Chakra Petch']];
const bg = (def = 35): FieldDef => ({ key: 'bg', label: 'ความทึบพื้นหลัง', type: 'range', min: 0, max: 100, step: 5, def, unit: '%', hint: '0 = ใสทั้งหมด' });
const size = (def = 1): FieldDef => ({ key: 'scale', label: 'ขนาด', type: 'range', min: 0.4, max: 2, step: 0.05, def, unit: '×' });
// เปลี่ยนสีภาพ 3D (หมุนเฉดสี): 0 = ชมพูเดิม · -60 ม่วง · -120 ฟ้า · 180 มิ้นต์ · 120 เขียว · 50 พีช/ทอง
const tint = (when: (v: Values) => boolean): FieldDef[] => [
  { key: 'hue', label: 'สีธีม', type: 'swatch', def: 0, when, hint: 'สีจริงขึ้นกับสีเดิมของภาพ (ภาพชมพู → ได้ตามจุดสี)', options: [
    [0, '#ffb3cf', 'ชมพู (เดิม)'], [-25, '#f6a8e6', 'บานเย็น'], [-60, '#cdb4ff', 'ม่วง'], [-95, '#b3c2ff', 'คราม'], [-120, '#a9d1ff', 'ฟ้า'],
    [180, '#a8e6d9', 'มิ้นต์'], [120, '#b6e3a1', 'เขียว'], [70, '#f3e48f', 'เหลือง'], [45, '#ffd59a', 'ทอง'], [25, '#ffc3a8', 'พีช'],
  ] },
  { key: 'sat', label: 'ความสดของสี', type: 'range', min: 0.3, max: 1.6, step: 0.05, def: 1, unit: '×', when },
  { key: 'bright', label: 'ความสว่าง', type: 'range', min: 0.7, max: 1.3, step: 0.05, def: 1, unit: '×', when },
];
const pos = (defY = 0): FieldDef[] => [
  { key: 'x', label: 'เลื่อนแนวนอน (แกน X)', type: 'range', min: -900, max: 900, step: 10, def: 0, unit: 'px', hint: 'ลบ = ไปทางซ้าย' },
  { key: 'y', label: 'เลื่อนแนวตั้ง (แกน Y)', type: 'range', min: -500, max: 500, step: 10, def: defY, unit: 'px', hint: 'ลบ = ยกขึ้น' },
];

export const WIDGET_SETTINGS: Record<string, WidgetSettingsDef> = {
  giftjar: {
    resettable: 'ล้างของขวัญในโหลและอันดับ',
    sections: [
      { title: 'รูปแบบโหล', fields: [
        { key: 'shape', label: 'ทรงโหล', type: 'select', def: 'heart', options: [
          ['heart', 'โหลหัวใจ', '🫙 โหลและตู้ (ภาพ 3D)', 'gj-heart'], ['orb', 'โหลกลมห่วงชมพู', '🫙 โหลและตู้ (ภาพ 3D)', 'gj-orb'], ['tank', 'ตู้ปลา', '🫙 โหลและตู้ (ภาพ 3D)', 'gj-tank'],
          ['sundae', 'ถ้วยไอศกรีม', '🫙 โหลและตู้ (ภาพ 3D)', 'gj-sundae'],
          ['jstar', 'โหลดาว', '🫙 โหลและตู้ (ภาพ 3D)', 'gj-jstar'],
          ['jbasket', 'โหลตะกร้า', '🫙 โหลและตู้ (ภาพ 3D)', 'gj-jbasket'],
          ['cauldron', 'โหลหม้อแม่มด', '🫙 โหลและตู้ (ภาพ 3D)', 'gj-cauldron'],
          ['catbank', 'กระปุกแมวใส', '🫙 โหลและตู้ (ภาพ 3D)', 'gj-catbank'],
          ['jsnowman', 'โหลตุ๊กตาหิมะ', '🫙 โหลและตู้ (ภาพ 3D)', 'gj-jsnowman'],
          ['castle', 'ตู้ปลาปราสาท', '🫙 โหลและตู้ (ภาพ 3D)', 'gj-castle'],
          ['fishbowl', 'โหลปลาทองขอบคลื่น', '🫙 โหลและตู้ (ภาพ 3D)', 'gj-fishbowl'],
          ['hearttank', 'ตู้ปลาหัวใจ', '🫙 โหลและตู้ (ภาพ 3D)', 'gj-hearttank'],
          ['moon', 'ตู้ปลาพระจันทร์', '🫙 โหลและตู้ (ภาพ 3D)', 'gj-moon'],
          ['gacha', 'ตู้ปลากาชาปอง', '🫙 โหลและตู้ (ภาพ 3D)', 'gj-gacha'],
          ['shell', 'ตู้ปลาเปลือกหอย', '🫙 โหลและตู้ (ภาพ 3D)', 'gj-shell'],
         
         
        ] },
        ...tint((v) => ['heart', 'orb', 'tank', 'pig', 'sundae', 'jstar', 'jbasket', 'cauldron', 'catbank', 'jsnowman', 'catbelly', 'jdino', 'jbear', 'jfrog', 'castle', 'fishbowl', 'hearttank', 'moon', 'gacha', 'shell', 'sub', 'snow', 'van'].includes(String(v.shape))),
        { key: 'full', label: 'เมื่อโหลเต็ม', type: 'select', when: (v) => !['car', 'globe', 'heart', 'snow', 'van', 'pig', 'sub', 'jstar', 'catbank', 'jsnowman', 'catbelly', 'jdino', 'jbear', 'jfrog'].includes(String(v.shape)), def: 'spill', options: [['spill', 'ล้นออกมากองข้างโหล'], ['fade', 'ชิ้นเก่าสุดค่อย ๆ หายไป'], ['reset', 'ฉลอง แล้วเทโหลเริ่มใหม่']] },
        { key: 'fullText', label: 'ข้อความตอนโหลเต็ม', type: 'text', def: 'โหลเต็มแล้ว! 🎉', when: (v) => v.full === 'reset' },
      ] },
      { title: 'ขนาดและตำแหน่ง', fields: [
        size(),
        { key: 'giftScale', label: 'ขนาดของขวัญ', type: 'range', min: 0.5, max: 2.5, step: 0.05, def: 1, unit: '×', hint: 'ยิ่งเล็ก ยิ่งกองได้มาก — 1× ≈ 600 ชิ้น · 0.7× ≈ 1,200 · 0.55× = 2,000 (สูงสุด)' },
        ...pos(),
      ] },
      { title: 'ของขวัญ', fields: [
        { key: 'minCoins', label: 'รับเฉพาะของขวัญตั้งแต่ (เหรียญ)', type: 'number', min: 0, def: 0, hint: '0 = รับทุกชิ้น' },
      ] },
      { title: 'แจ้งเตือนผู้ส่ง', fields: [
        { key: 'alert', label: 'แสดงชื่อผู้ส่งเหนือโหล', type: 'toggle', def: true },
        { key: 'alertSec', label: 'แสดงนาน (วินาที)', type: 'number', min: 1, max: 30, def: 5, when: (v) => !!v.alert },
      ] },
      { title: 'ผู้ให้สูงสุด', fields: [
        { key: 'board', label: 'แสดงใต้โหล', type: 'toggle', def: true },
        { key: 'top', label: 'จำนวนคน', type: 'number', min: 1, max: 10, def: 1, when: (v) => !!v.board },
        { key: 'boardFormat', label: 'รูปแบบ', type: 'select', def: 'full', options: [['full', 'รูป + ชื่อ + เหรียญ'], ['name', 'ชื่ออย่างเดียว']], when: (v) => !!v.board },
        { key: 'total', label: 'แสดงยอดเหรียญรวมเหนือโหล', type: 'toggle', def: false },
      ] },
      { title: 'ตัวอักษร', fields: [
        { key: 'font', label: 'ฟอนต์', type: 'select', def: 'Kanit', options: FONTS },
        { key: 'fontSize', label: 'ขนาดตัวอักษร', type: 'range', min: 30, max: 90, step: 2, def: 50 },
      ] },
    ],
  },
  vehicle: {
    resettable: 'ล้างของขวัญและอันดับ',
    sections: [
      { title: 'ยานพาหนะ', fields: [
        { key: 'shape', label: 'ยานพาหนะ', type: 'select', def: 'van', options: [
          ['van', 'รถหัวใจ (ภาพ 3D)', '🚐 ยานพาหนะ', 'gj-van'], ['sub', 'เรือดำน้ำ (ภาพ 3D)', '🚐 ยานพาหนะ', 'gj-sub'],
        ] },
        ...tint(() => true),
        { key: 'fullText', label: 'ข้อความตอนโหลเต็ม', type: 'text', def: 'โหลเต็มแล้ว! 🎉', when: (v) => v.full === 'reset' },
      ] },
      { title: 'ขนาดและตำแหน่ง', fields: [
        size(),
        { key: 'giftScale', label: 'ขนาดของขวัญ', type: 'range', min: 0.5, max: 2.5, step: 0.05, def: 1, unit: '×', hint: 'ยิ่งเล็ก ยิ่งกองได้มาก — 1× ≈ 600 ชิ้น · 0.7× ≈ 1,200 · 0.55× = 2,000 (สูงสุด)' },
        ...pos(),
      ] },
      { title: 'ของขวัญ', fields: [
        { key: 'minCoins', label: 'รับเฉพาะของขวัญตั้งแต่ (เหรียญ)', type: 'number', min: 0, def: 0, hint: '0 = รับทุกชิ้น' },
      ] },
      { title: 'แจ้งเตือนผู้ส่ง', fields: [
        { key: 'alert', label: 'แสดงชื่อผู้ส่งเหนือโหล', type: 'toggle', def: true },
        { key: 'alertSec', label: 'แสดงนาน (วินาที)', type: 'number', min: 1, max: 30, def: 5, when: (v) => !!v.alert },
      ] },
      { title: 'ผู้ให้สูงสุด', fields: [
        { key: 'board', label: 'แสดงใต้โหล', type: 'toggle', def: true },
        { key: 'top', label: 'จำนวนคน', type: 'number', min: 1, max: 10, def: 1, when: (v) => !!v.board },
        { key: 'boardFormat', label: 'รูปแบบ', type: 'select', def: 'full', options: [['full', 'รูป + ชื่อ + เหรียญ'], ['name', 'ชื่ออย่างเดียว']], when: (v) => !!v.board },
        { key: 'total', label: 'แสดงยอดเหรียญรวมเหนือโหล', type: 'toggle', def: false },
      ] },
      { title: 'ตัวอักษร', fields: [
        { key: 'font', label: 'ฟอนต์', type: 'select', def: 'Kanit', options: FONTS },
        { key: 'fontSize', label: 'ขนาดตัวอักษร', type: 'range', min: 30, max: 90, step: 2, def: 50 },
      ] },
    ],
  },
  snowglobe: {
    resettable: 'ล้างของขวัญในลูกแก้วและอันดับ',
    sections: [
      { title: 'ลูกแก้วหิมะ', fields: [
        { key: 'shape', label: 'ลูกแก้ว', type: 'select', def: 'snow', options: [
          ['snow', 'ลูกแก้วหิมะบ้านกระต่าย', '❄️ ลูกแก้วหิมะ (ภาพ 3D)', 'gj-snow'],
        ] },
        ...tint(() => true),
        { key: 'fullText', label: 'ข้อความตอนโหลเต็ม', type: 'text', def: 'โหลเต็มแล้ว! 🎉', when: (v) => v.full === 'reset' },
      ] },
      { title: 'ขนาดและตำแหน่ง', fields: [
        size(),
        { key: 'giftScale', label: 'ขนาดของขวัญ', type: 'range', min: 0.5, max: 2.5, step: 0.05, def: 1, unit: '×', hint: 'ยิ่งเล็ก ยิ่งกองได้มาก — 1× ≈ 600 ชิ้น · 0.7× ≈ 1,200 · 0.55× = 2,000 (สูงสุด)' },
        ...pos(),
      ] },
      { title: 'ของขวัญ', fields: [
        { key: 'minCoins', label: 'รับเฉพาะของขวัญตั้งแต่ (เหรียญ)', type: 'number', min: 0, def: 0, hint: '0 = รับทุกชิ้น' },
      ] },
      { title: 'แจ้งเตือนผู้ส่ง', fields: [
        { key: 'alert', label: 'แสดงชื่อผู้ส่งเหนือโหล', type: 'toggle', def: true },
        { key: 'alertSec', label: 'แสดงนาน (วินาที)', type: 'number', min: 1, max: 30, def: 5, when: (v) => !!v.alert },
      ] },
      { title: 'ผู้ให้สูงสุด', fields: [
        { key: 'board', label: 'แสดงใต้โหล', type: 'toggle', def: true },
        { key: 'top', label: 'จำนวนคน', type: 'number', min: 1, max: 10, def: 1, when: (v) => !!v.board },
        { key: 'boardFormat', label: 'รูปแบบ', type: 'select', def: 'full', options: [['full', 'รูป + ชื่อ + เหรียญ'], ['name', 'ชื่ออย่างเดียว']], when: (v) => !!v.board },
        { key: 'total', label: 'แสดงยอดเหรียญรวมเหนือโหล', type: 'toggle', def: false },
      ] },
      { title: 'ตัวอักษร', fields: [
        { key: 'font', label: 'ฟอนต์', type: 'select', def: 'Kanit', options: FONTS },
        { key: 'fontSize', label: 'ขนาดตัวอักษร', type: 'range', min: 30, max: 90, step: 2, def: 50 },
      ] },
    ],
  },
  belly: {
    resettable: 'ล้างของขวัญในท้องและอันดับ',
    sections: [
      { title: 'ตัวละคร', fields: [
        { key: 'shape', label: 'ตัวละคร', type: 'select', def: 'pig', options: [
          ['pig', 'หมูท้องใส งับของขวัญ', '🐷 ตัวละครท้องใส (ภาพ 3D)', 'gj-pig'], ['catbelly', 'แมวท้องใส', '🐷 ตัวละครท้องใส (ภาพ 3D)', 'gj-catbelly'], ['jdino', 'ไดโนเสาร์ท้องใส', '🐷 ตัวละครท้องใส (ภาพ 3D)', 'gj-jdino'], ['jbear', 'หมีท้องใส', '🐷 ตัวละครท้องใส (ภาพ 3D)', 'gj-jbear'], ['jfrog', 'กบท้องใส', '🐷 ตัวละครท้องใส (ภาพ 3D)', 'gj-jfrog'],
        ] },
        ...tint(() => true),
        { key: 'fullText', label: 'ข้อความตอนโหลเต็ม', type: 'text', def: 'โหลเต็มแล้ว! 🎉', when: (v) => v.full === 'reset' },
      ] },
      { title: 'ขนาดและตำแหน่ง', fields: [
        size(),
        { key: 'giftScale', label: 'ขนาดของขวัญ', type: 'range', min: 0.5, max: 2.5, step: 0.05, def: 1, unit: '×', hint: 'ยิ่งเล็ก ยิ่งกองได้มาก — 1× ≈ 600 ชิ้น · 0.7× ≈ 1,200 · 0.55× = 2,000 (สูงสุด)' },
        ...pos(),
      ] },
      { title: 'ของขวัญ', fields: [
        { key: 'minCoins', label: 'รับเฉพาะของขวัญตั้งแต่ (เหรียญ)', type: 'number', min: 0, def: 0, hint: '0 = รับทุกชิ้น' },
      ] },
      { title: 'แจ้งเตือนผู้ส่ง', fields: [
        { key: 'alert', label: 'แสดงชื่อผู้ส่งเหนือโหล', type: 'toggle', def: true },
        { key: 'alertSec', label: 'แสดงนาน (วินาที)', type: 'number', min: 1, max: 30, def: 5, when: (v) => !!v.alert },
      ] },
      { title: 'ผู้ให้สูงสุด', fields: [
        { key: 'board', label: 'แสดงใต้โหล', type: 'toggle', def: true },
        { key: 'top', label: 'จำนวนคน', type: 'number', min: 1, max: 10, def: 1, when: (v) => !!v.board },
        { key: 'boardFormat', label: 'รูปแบบ', type: 'select', def: 'full', options: [['full', 'รูป + ชื่อ + เหรียญ'], ['name', 'ชื่ออย่างเดียว']], when: (v) => !!v.board },
        { key: 'total', label: 'แสดงยอดเหรียญรวมเหนือโหล', type: 'toggle', def: false },
      ] },
      { title: 'ตัวอักษร', fields: [
        { key: 'font', label: 'ฟอนต์', type: 'select', def: 'Kanit', options: FONTS },
        { key: 'fontSize', label: 'ขนาดตัวอักษร', type: 'range', min: 30, max: 90, step: 2, def: 50 },
      ] },
    ],
  },
  league: {
    resettable: 'ล้างคะแนนลีก (เริ่มจากค่าตั้งต้น)',
    sections: [
      { title: 'ลีกและเป้าหมาย', fields: [
        { key: 'tier', label: 'ลีกปัจจุบัน', type: 'select', def: 'B', options: [['D', 'D'], ['C', 'C'], ['B', 'B'], ['A', 'A'], ['S', 'S']] },
        { key: 'level', label: 'ระดับย่อยปัจจุบัน', type: 'number', min: 1, max: 9, def: 1, hint: 'เช่น B1 = 1' },
        { key: 'levels', label: 'จำนวนระดับย่อยต่อลีก', type: 'number', min: 1, max: 9, def: 3, hint: 'ครบแล้วขึ้นลีกถัดไป เช่น B3 → A1' },
        { key: 'target', label: 'เป้าหมายคะแนน (เพชร) ต่อระดับ', type: 'number', min: 1, def: 44999 },
        { key: 'start', label: 'คะแนนที่มีอยู่แล้ว', type: 'number', min: 0, def: 0, hint: 'ใส่ตามที่ TikTok แสดง แล้วกดบันทึก — วิดเจ็ตนับต่อจากนี้' },
        { key: 'grow', label: 'ตัวคูณเป้าหมายเมื่อขึ้นระดับ', type: 'range', min: 1, max: 3, step: 0.1, def: 1, unit: '×' },
        { key: 'minCoins', label: 'นับเฉพาะของขวัญตั้งแต่ (เหรียญ)', type: 'number', min: 0, def: 0 },
      ] },
      { title: 'ข้อความ', fields: [
        { key: 'label', label: 'ข้อความใต้แถบ', type: 'text', def: 'ปลดล็อกเป้าหมายถัดไป' },
        { key: 'names', label: 'แสดงชื่อคนส่งที่หางดาวหาง', type: 'toggle', def: true },
      ] },
      { title: 'ขนาดและตำแหน่ง', fields: [size(), ...pos()] },
    ],
  },
  garden: {
    resettable: 'ล้างดอกไม้ทั้งหมด',
    sections: [
      { title: 'กระถาง', fields: [
        { key: 'sway', label: 'ความแรงลม (กิ่งแกว่ง)', type: 'range', min: 0, max: 3, step: 0.1, def: 1, hint: '0 = นิ่ง' },
        { key: 'big', label: 'ของขวัญที่เป็นดอกใหญ่บนยอด ตั้งแต่ (เหรียญ)', type: 'number', min: 1, def: 1000 },
        { key: 'skin', label: 'แบบกระถาง', type: 'select', def: 'image', options: [
          ['image', 'กระถางหัวใจมีปีก', '🪴 กระถาง (ภาพ 3D)', 'gd-image'],
        ] },
        ...tint(() => true),
        { key: 'minCoins', label: 'รับเฉพาะของขวัญตั้งแต่ (เหรียญ)', type: 'number', min: 0, def: 0 },
      ] },
      { title: 'ขนาดและตำแหน่ง', fields: [
        size(),
        { key: 'pileMax', label: 'ความสูงกองบนพื้นสูงสุด', type: 'range', min: 15, max: 90, step: 5, def: 40, unit: '%', hint: 'ดอกเต็มต้นแล้วของขวัญร่วงกองพื้น — เกินความสูงนี้ชิ้นเก่าสุดค่อย ๆ จางไป' },
        { key: 'flowerScale', label: 'ขนาดดอกไม้', type: 'range', min: 0.5, max: 2.5, step: 0.05, def: 1, unit: '×', hint: 'ยิ่งเล็ก ยิ่งกองบนพื้นได้มาก — 1× ≈ 300 ชิ้น · 0.5× = 1,200 (สูงสุด)' },
        ...pos(),
      ] },
      { title: 'การแสดงผล', fields: [
        { key: 'alert', label: 'แสดงชื่อผู้ส่ง', type: 'toggle', def: true },
        { key: 'board', label: 'แสดงผู้ให้สูงสุดใต้กระถาง', type: 'toggle', def: true },
      ] },
    ],
  },
  tree: {
    resettable: 'ล้างดอกไม้ทั้งหมด',
    sections: [
      { title: 'ต้นไม้', fields: [
        { key: 'sway', label: 'ความแรงลม (กิ่งแกว่ง)', type: 'range', min: 0, max: 3, step: 0.1, def: 1, hint: '0 = นิ่ง' },
        { key: 'big', label: 'ของขวัญที่เป็นดอกใหญ่บนยอด ตั้งแต่ (เหรียญ)', type: 'number', min: 1, def: 1000 },
        { key: 'skin', label: 'แบบต้นไม้', type: 'select', def: 'tree', options: [
          ['tree', 'ต้นไม้ใหญ่', '🌳 ต้นไม้ (ภาพ 3D)', 'gd-tree'], ['sakura', 'ต้นซากุระ', '🌳 ต้นไม้ (ภาพ 3D)', 'gd-sakura'], ['night', 'ต้นไม้ดวงดาว', '🌳 ต้นไม้ (ภาพ 3D)', 'gd-night'], ['heart', 'ต้นหัวใจ', '🌳 ต้นไม้ (ภาพ 3D)', 'gd-heart'], ['bonsai', 'บอนไซกระถางหัวใจ', '🌳 ต้นไม้ (ภาพ 3D)', 'gd-bonsai'], ['palm', 'ต้นปาล์มเกาะ', '🌳 ต้นไม้ (ภาพ 3D)', 'gd-palm'], ['autumn', 'ต้นไม้ใบไม้ร่วง', '🌳 ต้นไม้ (ภาพ 3D)', 'gd-autumn'],
        ] },
        ...tint(() => true),
        { key: 'minCoins', label: 'รับเฉพาะของขวัญตั้งแต่ (เหรียญ)', type: 'number', min: 0, def: 0 },
      ] },
      { title: 'ขนาดและตำแหน่ง', fields: [
        size(),
        { key: 'pileMax', label: 'ความสูงกองบนพื้นสูงสุด', type: 'range', min: 15, max: 90, step: 5, def: 40, unit: '%', hint: 'ดอกเต็มต้นแล้วของขวัญร่วงกองพื้น — เกินความสูงนี้ชิ้นเก่าสุดค่อย ๆ จางไป' },
        { key: 'flowerScale', label: 'ขนาดดอกไม้', type: 'range', min: 0.5, max: 2.5, step: 0.05, def: 1, unit: '×', hint: 'ยิ่งเล็ก ยิ่งกองบนพื้นได้มาก — 1× ≈ 300 ชิ้น · 0.5× = 1,200 (สูงสุด)' },
        ...pos(),
      ] },
      { title: 'การแสดงผล', fields: [
        { key: 'alert', label: 'แสดงชื่อผู้ส่ง', type: 'toggle', def: true },
        { key: 'board', label: 'แสดงผู้ให้สูงสุดใต้กระถาง', type: 'toggle', def: true },
      ] },
    ],
  },
  coinjar: {
    resettable: 'ล้างกองของขวัญ',
    sections: [
      { title: 'เครื่องและเป้าหมาย', fields: [
        { key: 'skin', label: 'หน้าตาเครื่อง', type: 'select', def: 'image', options: [
          ['image', 'ตู้ชมพู', '🎰 ตู้เครื่องจักร (ภาพ 3D)', 'cj-image'], ['cupcake', 'ตู้คัพเค้ก', '🎰 ตู้เครื่องจักร (ภาพ 3D)', 'cj-cupcake'], ['cat', 'ตู้หัวแมว', '🎰 ตู้เครื่องจักร (ภาพ 3D)', 'cj-cat'], ['house', 'บ้านขนมปังขิง', '🎰 ตู้เครื่องจักร (ภาพ 3D)', 'cj-house'], ['rocket', 'ตู้จรวด', '🎰 ตู้เครื่องจักร (ภาพ 3D)', 'cj-rocket'], ['gacha', 'ตู้กาชาปอง', '🎰 ตู้เครื่องจักร (ภาพ 3D)', 'cj-gacha'], ['gift', 'ตู้กล่องของขวัญ', '🎰 ตู้เครื่องจักร (ภาพ 3D)', 'cj-gift'], ['icecream', 'ร้านไอศกรีม', '🎰 ตู้เครื่องจักร (ภาพ 3D)', 'cj-icecream'], ['bear', 'หมีน้อยถือกล่อง', '🎰 ตู้เครื่องจักร (ภาพ 3D)', 'cj-bear'],
        ] },
        ...tint(() => true),
        { key: 'goal', label: 'เป้าหมาย (เหรียญ)', type: 'number', min: 1, def: 10000, hint: 'แถบบนจอเครื่องจะเต็มเมื่อถึงเป้า' },
        { key: 'counter', label: 'แสดงจำนวนเหรียญบนเครื่อง', type: 'toggle', def: true },
      ] },
      { title: 'ขนาดและตำแหน่ง', fields: [
        size(),
        { key: 'giftScale', label: 'ขนาดของขวัญ', type: 'range', min: 0.5, max: 2.5, step: 0.05, def: 1, unit: '×', hint: 'ยิ่งเล็ก ยิ่งกองได้มาก — 1× ≈ 1,000 ชิ้น · 0.7× ≈ 2,000 · 0.6× = 2,500 (สูงสุด)' },
        { key: 'pileMax', label: 'ความสูงกองของขวัญสูงสุด', type: 'range', min: 20, max: 90, step: 5, def: 55, unit: '%', hint: 'เทียบความสูงจอ — เกินแล้วชิ้นเก่าสุดค่อย ๆ จางไป' },
        ...pos(-80),
      ] },
    ],
  },
  alerts: {
    sections: [
      { title: 'แจ้งเตือนเมื่อ', fields: [
        { key: 'gift', label: 'มีคนส่งของขวัญ', type: 'toggle', def: true },
        { key: 'minCoins', label: 'ของขวัญตั้งแต่ (เหรียญ)', type: 'number', min: 1, def: 1, when: (v) => !!v.gift },
        { key: 'big', label: 'ของขวัญใหญ่ (มีพลุ) ตั้งแต่', type: 'number', min: 1, def: 1000, when: (v) => !!v.gift },
        { key: 'follow', label: 'มีคนกดติดตาม', type: 'toggle', def: true },
        { key: 'share', label: 'มีคนแชร์ไลฟ์', type: 'toggle', def: true },
      ] },
      { title: 'การแสดงผล', fields: [
        { key: 'duration', label: 'แสดงนาน (วินาที)', type: 'number', min: 2, max: 30, def: 5 },
        { key: 'pos', label: 'ตำแหน่ง', type: 'select', def: 'top', options: [['top', 'ด้านบน'], ['center', 'กลางจอ'], ['bottom', 'ด้านล่าง']] },
        bg(),
      ] },
    ],
  },
  chat: {
    sections: [
      { title: 'แชท', fields: [
        { key: 'max', label: 'จำนวนข้อความบนจอ', type: 'number', min: 1, max: 30, def: 8 },
        { key: 'fade', label: 'ข้อความหายไปหลัง (วินาที)', type: 'number', min: 0, max: 120, def: 0, hint: '0 = ไม่หาย' },
        { key: 'pos', label: 'ชิดมุม', type: 'select', def: 'bl', options: [['bl', 'ล่างซ้าย'], ['br', 'ล่างขวา']] },
        { key: 'fontSize', label: 'ขนาดตัวอักษร', type: 'range', min: 12, max: 32, step: 1, def: 17, unit: 'px' },
        bg(),
      ] },
    ],
  },
  goal: {
    sections: [
      { title: 'เป้าหมาย', fields: [
        { key: 'type', label: 'นับจาก', type: 'select', def: 'like', options: [['like', '❤️ ไลค์'], ['follow', '➕ ผู้ติดตาม'], ['share', '🔁 แชร์'], ['diamond', '💎 เพชร'], ['gift', '🎁 จำนวนของขวัญ']] },
        { key: 'target', label: 'เป้าหมาย', type: 'number', min: 1, def: 10000 },
        { key: 'next', label: 'ถึงเป้าแล้วเพิ่มเป้าถัดไปอีก', type: 'number', min: 0, def: 0, hint: '0 = ไม่เพิ่ม' },
        { key: 'label', label: 'หัวข้อ', type: 'text', def: '', placeholder: 'เว้นว่าง = ตามชนิด' },
        bg(),
      ] },
    ],
  },
  follower: {
    sections: [
      { title: 'ผู้ติดตามล่าสุด', fields: [
        { key: 'label', label: 'หัวข้อ', type: 'text', def: 'ผู้ติดตามล่าสุด' },
        { key: 'showCount', label: 'แสดงจำนวนผู้ติดตามในไลฟ์', type: 'toggle', def: true },
      ] },
    ],
  },
  topgifters: {
    resettable: 'ล้างอันดับ',
    sections: [
      { title: 'อันดับผู้ให้ของขวัญ', fields: [
        { key: 'max', label: 'จำนวนอันดับ', type: 'number', min: 1, max: 20, def: 5 },
        { key: 'label', label: 'หัวข้อ', type: 'text', def: '🏆 Top Gifters' },
        { key: 'pos', label: 'มุมจอ', type: 'select', def: 'tr', options: [['tr', 'บนขวา'], ['tl', 'บนซ้าย'], ['br', 'ล่างขวา'], ['bl', 'ล่างซ้าย']] },
        bg(),
      ] },
    ],
  },
  toplikers: {
    resettable: 'ล้างอันดับ',
    sections: [
      { title: 'อันดับยอดไลค์', fields: [
        { key: 'max', label: 'จำนวนอันดับ', type: 'number', min: 1, max: 20, def: 5 },
        { key: 'label', label: 'หัวข้อ', type: 'text', def: '❤️ อันดับยอดไลค์' },
        { key: 'pos', label: 'มุมจอ', type: 'select', def: 'tr', options: [['tr', 'บนขวา'], ['tl', 'บนซ้าย'], ['br', 'ล่างขวา'], ['bl', 'ล่างซ้าย']] },
        bg(),
      ] },
    ],
  },
  timer: {
    resettable: 'เริ่มนับเวลาใหม่',
    sections: [
      { title: 'เวลา', fields: [
        { key: 'start', label: 'เวลาเริ่มต้น (นาที)', type: 'number', min: 1, def: 60 },
        { key: 'max', label: 'เวลาสูงสุด (นาที)', type: 'number', min: 0, def: 0, hint: '0 = ไม่จำกัด' },
        { key: 'blink', label: 'กะพริบเมื่อเหลือ (วินาที)', type: 'number', min: 0, def: 60 },
      ] },
      { title: 'เพิ่มเวลาเมื่อ (วินาที)', fields: [
        { key: 'coin', label: 'ต่อ 1 เหรียญของขวัญ', type: 'number', min: 0, def: 5 },
        { key: 'like', label: 'ต่อ 1 ไลค์', type: 'number', min: 0, def: 0 },
        { key: 'follow', label: 'ต่อการติดตาม', type: 'number', min: 0, def: 30 },
        { key: 'share', label: 'ต่อการแชร์', type: 'number', min: 0, def: 10 },
      ] },
      { title: 'การแสดงผล', fields: [
        { key: 'label', label: 'ข้อความด้านบน', type: 'text', def: '⏳ ส่งของขวัญเพื่อเพิ่มเวลา' },
        { key: 'done', label: 'ข้อความเมื่อหมดเวลา', type: 'text', def: 'หมดเวลา! 🎉' },
        { key: 'fontSize', label: 'ขนาดตัวเลข', type: 'range', min: 40, max: 160, step: 2, def: 90 },
        bg(),
      ] },
    ],
  },
  tts: {
    sections: [
      { title: 'อ่านออกเสียง', fields: [
        { key: 'readChat', label: 'อ่านแชท', type: 'toggle', def: true },
        { key: 'readGift', label: 'อ่านของขวัญ', type: 'toggle', def: true },
        { key: 'minGift', label: 'อ่านของขวัญตั้งแต่ (เหรียญ)', type: 'number', min: 1, def: 1, when: (v) => !!v.readGift },
        { key: 'tmplChat', label: 'รูปแบบประโยคแชท', type: 'text', def: '{name} พูดว่า {text}' },
        { key: 'tmplGift', label: 'รูปแบบประโยคของขวัญ', type: 'text', def: '{name} ส่ง {gift}' },
      ] },
      { title: 'เสียง', fields: [
        { key: 'voice', label: 'เสียง (Google)', type: 'select', def: 'th-TH-Neural2-C', options: [['th-TH-Neural2-C', 'หญิง (Neural2)'], ['th-TH-Standard-A', 'หญิง (มาตรฐาน)']] },
        { key: 'rate', label: 'ความเร็ว', type: 'range', min: 0.5, max: 2, step: 0.05, def: 1, unit: '×' },
        { key: 'pitch', label: 'ระดับเสียง', type: 'range', min: 0.5, max: 1.5, step: 0.05, def: 1 },
      ] },
    ],
  },
};

/** ค่าเริ่มต้นของทุกช่อง */
export function defaultsOf(def: WidgetSettingsDef): Values {
  const v: Values = {};
  for (const s of def.sections) for (const f of s.fields) v[f.key] = f.def;
  return v;
}

/** แปลงเป็นค่าที่ overlay อ่าน (toggle → '1'/'0') */
export function toOverlayParams(values: Values): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) out[k] = typeof v === 'boolean' ? (v ? '1' : '0') : String(v);
  return out;
}
