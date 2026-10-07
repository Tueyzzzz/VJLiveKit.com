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
  | { key: string; label: string; type: 'text'; def: string; placeholder?: string; hint?: string; when?: (v: Values) => boolean }
  /** เลือกรายการในเมนูของขวัญ: ค่า = JSON { hide: [ruleId], icons: { ruleId: รูป } } */
  | { key: string; label: string; type: 'menuItems'; def: string; hint?: string; when?: (v: Values) => boolean };

export type Values = Record<string, string | number | boolean>;
export interface Section { title: string; fields: FieldDef[] }
export interface WidgetSettingsDef { sections: Section[]; /** มีข้อมูลที่จำไว้ (กองของขวัญ/อันดับ/เวลา) ให้ล้างได้ */ resettable?: string }

const FONTS: [string, string][] = [['Kanit', 'Kanit'], ['Prompt', 'Prompt'], ['Mitr', 'Mitr'], ['Sriracha', 'Sriracha (ลายมือ)'], ['Chakra Petch', 'Chakra Petch']];
const bg = (def = 35): FieldDef => ({ key: 'bg', label: 'ความทึบพื้นหลัง', type: 'range', min: 0, max: 100, step: 5, def, unit: '%', hint: '0 = ใสทั้งหมด' });
const size = (def = 1): FieldDef => ({ key: 'scale', label: 'ขนาด', type: 'range', min: 0.4, max: 2, step: 0.05, def, unit: '×' });
// เปลี่ยนสีภาพ 3D (หมุนเฉดสี): 0 = ชมพูเดิม · -60 ม่วง · -120 ฟ้า · 180 มิ้นต์ · 120 เขียว · 50 พีช/ทอง
// แบบสายเท่/เกมมิ่ง (นีออนฟ้า-ชมพูบนตัวดำ) — ใช้จุดสีชุดคู่นีออนของตัวเอง
const COOL_THEMES = new Set(['xtech', 'xcan', 'xcan2', 'xchest', 'xrobot', 'xwolf', 'xdragon', 'arcade', 'atm', 'reactor', 'sports', 'offroad', 'jdm', 'bike', 'cyber', 'tech', 'smilitary', 'sshield']);
const isCool = (v: Values) => COOL_THEMES.has(String(v.shape ?? v.skin ?? v.car ?? ''));
// แบบสายนักร้อง (ไวน์แดง + ทอง/โรสโกลด์) — จุดสีชุดคู่สีหรูของตัวเอง
const SING_THEMES = new Set(['mmic', 'mcoupe', 'mbox', 'mdrum', 'mjuke', 'gstage', 'gpiano', 'mbird', 'mcat', 'mbear', 'karaoke', 'tourbus', 'limo', 'vintage', 'notes', 'trumpet', 'drum']);
const isSing = (v: Values) => SING_THEMES.has(String(v.shape ?? v.skin ?? v.car ?? ''));
const neon = (a: string, b: string) => `linear-gradient(135deg, ${a} 50%, ${b} 50%)`;
// เปลี่ยนสีภาพ 3D (หมุนเฉดสี) — พาสเทล: 0 = ชมพูเดิม · สายเท่: 0 = นีออนฟ้า-ชมพูเดิม (ตัวดำ/เงินคงเดิม)
const tint = (when: (v: Values) => boolean): FieldDef[] => [
  { key: 'hue', label: 'สีธีม', type: 'swatch', def: 0, when: (v) => when(v) && !isCool(v) && !isSing(v), hint: 'สีจริงขึ้นกับสีเดิมของภาพ (ภาพชมพู → ได้ตามจุดสี)', options: [
    [0, '#ffb3cf', 'ชมพู (เดิม)'], [-25, '#f6a8e6', 'บานเย็น'], [-60, '#cdb4ff', 'ม่วง'], [-95, '#b3c2ff', 'คราม'], [-120, '#a9d1ff', 'ฟ้า'],
    [180, '#a8e6d9', 'มิ้นต์'], [120, '#b6e3a1', 'เขียว'], [70, '#f3e48f', 'เหลือง'], [45, '#ffd59a', 'ทอง'], [25, '#ffc3a8', 'พีช'],
  ] },
  { key: 'hue', label: 'สีนีออน', type: 'swatch', def: 0, when: (v) => when(v) && isCool(v), hint: 'เปลี่ยนเฉพาะไฟนีออน ตัวเครื่อง/ตัวรถสีดำ-เงินคงเดิม', options: [
    [0, neon('#00E5FF', '#FF2E88'), 'ฟ้า-ชมพู (เดิม)'], [-150, neon('#FF9A1F', '#00E5FF'), 'ส้ม-ฟ้า'], [-120, neon('#FFE41F', '#2E7BFF'), 'เหลือง-น้ำเงิน'],
    [-60, neon('#1FFF6A', '#9B2EFF'), 'เขียว-ม่วง'], [60, neon('#3D4BFF', '#FF8A1F'), 'น้ำเงิน-ส้ม'], [120, neon('#E02EFF', '#8AFF1F'), 'ม่วง-เขียวมะนาว'],
    [150, neon('#FF2E9A', '#1FFF7E'), 'ชมพู-เขียว'], [180, neon('#FF2E2E', '#1FFFC4'), 'แดง-เขียวมรกต'],
  ] },
  { key: 'hue', label: 'สีธีม', type: 'swatch', def: 0, when: (v) => when(v) && isSing(v), hint: 'คู่สีหลัก + สีทอง/โรสโกลด์ — ส่วนที่เป็นสีขาว/ครีมคงเดิม', options: [
    [0, neon('#8E1B3A', '#E8C27A'), 'ไวน์แดง-ทอง (เดิม)'], [-25, neon('#8E1B6B', '#E8A07A'), 'ชมพูเข้ม-โรสโกลด์'], [-60, neon('#5E2A8E', '#E87AA8'), 'ม่วงพลัม-ชมพู'],
    [-120, neon('#1E3A8E', '#B48AE8'), 'น้ำเงินกรมท่า-ลาเวนเดอร์'], [-160, neon('#1B6E8E', '#8AB0E8'), 'ฟ้าเข้ม-ฟ้าเงิน'], [150, neon('#1B7A4A', '#8AE0D8'), 'เขียวมรกต-มิ้นต์'],
    [40, neon('#8E4A1B', '#E0E87A'), 'ทองแดง-ทองอ่อน'],
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
          ['heart', 'โหลหัวใจ', '🌸 พาสเทลน่ารัก', 'gj-heart'], ['orb', 'โหลกลมห่วงชมพู', '🌸 พาสเทลน่ารัก', 'gj-orb'],
          ['sundae', 'ถ้วยไอศกรีม', '🌸 พาสเทลน่ารัก', 'gj-sundae'],
          ['jstar', 'โหลดาว', '🌸 พาสเทลน่ารัก', 'gj-jstar'],
          ['jbasket', 'โหลตะกร้า', '🌸 พาสเทลน่ารัก', 'gj-jbasket'],
          ['cauldron', 'โหลหม้อแม่มด', '🌸 พาสเทลน่ารัก', 'gj-cauldron'],
          ['catbank', 'กระปุกแมวใส', '🌸 พาสเทลน่ารัก', 'gj-catbank'],
          ['jsnowman', 'โหลตุ๊กตาหิมะ', '🌸 พาสเทลน่ารัก', 'gj-jsnowman'],
          ['xtech', 'โหลแก้วเทค', '🎮 สายเท่ เกมมิ่ง', 'gj-xtech'], ['xcan', 'ถังพลังงานฟ้า', '🎮 สายเท่ เกมมิ่ง', 'gj-xcan'], ['xcan2', 'ถังพลังงานชมพู', '🎮 สายเท่ เกมมิ่ง', 'gj-xcan2'], ['xchest', 'หีบสมบัติเกม', '🎮 สายเท่ เกมมิ่ง', 'gj-xchest'],
          ['mmic', 'โหลไมโครโฟน', '🎤 สายนักร้อง', 'gj-mmic'], ['mcoupe', 'แก้วแชมเปญยักษ์', '🎤 สายนักร้อง', 'gj-mcoupe'], ['mbox', 'กล่องดนตรี', '🎤 สายนักร้อง', 'gj-mbox'], ['mdrum', 'กลองใส', '🎤 สายนักร้อง', 'gj-mdrum'], ['mjuke', 'โดมตู้เพลง', '🎤 สายนักร้อง', 'gj-mjuke'],
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
  aquarium: {
    resettable: 'ล้างของขวัญในตู้และอันดับ',
    sections: [
      { title: 'ตู้ปลา', fields: [
        { key: 'shape', label: 'ตู้ปลา', type: 'select', def: 'tank', options: [
          ['tank', 'ตู้ปลา', '🌸 พาสเทลน่ารัก', 'gj-tank'],
          ['castle', 'ตู้ปลาปราสาท', '🌸 พาสเทลน่ารัก', 'gj-castle'],
          ['fishbowl', 'โหลปลาทองขอบคลื่น', '🌸 พาสเทลน่ารัก', 'gj-fishbowl'],
          ['hearttank', 'ตู้ปลาหัวใจ', '🌸 พาสเทลน่ารัก', 'gj-hearttank'],
          ['moon', 'ตู้ปลาพระจันทร์', '🌸 พาสเทลน่ารัก', 'gj-moon'],
          ['gacha', 'ตู้ปลากาชาปอง', '🌸 พาสเทลน่ารัก', 'gj-gacha'],
          ['shell', 'ตู้ปลาเปลือกหอย', '🌸 พาสเทลน่ารัก', 'gj-shell'],
          ['sub', 'เรือดำน้ำ (ภาพ 3D)', '🌸 พาสเทลน่ารัก', 'gj-sub'],
        ] },
        { key: 'waves', label: 'ของขวัญโยกตามคลื่นใต้น้ำ', type: 'toggle', def: true },
        ...tint(() => true),
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
    resettable: 'ล้างของขวัญที่ลากอยู่',
    sections: [
      { title: 'รถ', fields: [
        { key: 'car', label: 'แบบรถ', type: 'select', def: 'van', options: [
          ['van', 'รถหัวใจ', '🌸 พาสเทลน่ารัก', 'gj-van'],
          ['pickup2', 'รถกระบะฟ้า', '🌸 พาสเทลน่ารัก', 'car-pickup2'],
          ['camper', 'รถคาราวาน', '🌸 พาสเทลน่ารัก', 'car-camper'],
          ['beetle', 'รถเต่างานแต่ง', '🌸 พาสเทลน่ารัก', 'car-beetle'],
          ['minivan', 'รถตู้วินเทจ', '🌸 พาสเทลน่ารัก', 'car-minivan'],
          ['convertible', 'รถเปิดประทุน', '🌸 พาสเทลน่ารัก', 'car-convertible'],
          ['pickup', 'รถกระบะ', '🌸 พาสเทลน่ารัก', 'car-pickup'],
          ['sports', 'รถสปอร์ต', '🎮 สายเท่ เกมมิ่ง', 'car-sports'], ['offroad', 'รถออฟโรด 4x4', '🎮 สายเท่ เกมมิ่ง', 'car-offroad'], ['jdm', 'รถดริฟต์ JDM', '🎮 สายเท่ เกมมิ่ง', 'car-jdm'], ['bike', 'บิ๊กไบค์', '🎮 สายเท่ เกมมิ่ง', 'car-bike'],
          ['tourbus', 'รถทัวร์คอนเสิร์ต', '🎤 สายนักร้อง', 'car-tourbus'], ['limo', 'รถลีมูซีนดารา', '🎤 สายนักร้อง', 'car-limo'], ['vintage', 'รถเปิดประทุนวินเทจ', '🎤 สายนักร้อง', 'car-vintage'],
        ] },
        ...tint(() => true),
        { key: 'alert', label: 'แสดงชื่อคนส่ง', type: 'toggle', def: true },
        { key: 'minCoins', label: 'รับเฉพาะของขวัญตั้งแต่ (เหรียญ)', type: 'number', min: 0, def: 0 },
      ] },
      { title: 'ขนาดและตำแหน่ง', fields: [
        size(),
        { key: 'giftScale', label: 'ขนาดของขวัญ', type: 'range', min: 0.5, max: 2.5, step: 0.05, def: 1, unit: '×' },
        { key: 'rope', label: 'ความยาวเชือก', type: 'range', min: 40, max: 200, step: 10, def: 90, unit: '', hint: 'ระยะจากท้ายรถถึงของขวัญแถวแรก' },
        { key: 'max', label: 'ลากได้สูงสุด (ชิ้น)', type: 'number', min: 30, max: 400, def: 140, hint: 'เกินแล้วชิ้นเก่าสุดค่อย ๆ จางไป — ของขวัญเล็กลงจะลากได้มากขึ้น' },
        ...pos(),
      ] },
    ],
  },


  snowglobe: {
    resettable: 'ล้างของขวัญในลูกแก้วและอันดับ',
    sections: [
      { title: 'ลูกแก้วหิมะ', fields: [
        { key: 'shape', label: 'ลูกแก้ว', type: 'select', def: 'snow', options: [
          ['snow', 'ลูกแก้วหิมะบ้านกระต่าย', '🌸 พาสเทลน่ารัก', 'gj-snow'],
          ['gcastle', 'ลูกแก้วปราสาทเจ้าหญิง', '🌸 พาสเทลน่ารัก', 'gl-castle'],
          ['gxmas', 'ลูกแก้วคริสต์มาส', '🌸 พาสเทลน่ารัก', 'gl-xmas'],
          ['gcarousel', 'ลูกแก้วม้าหมุน', '🌸 พาสเทลน่ารัก', 'gl-carousel'],
          ['gbunnies', 'ลูกแก้วกระต่ายหัวใจ', '🌸 พาสเทลน่ารัก', 'gl-bunnies'],
          ['gsakura', 'ลูกแก้วซากุระ', '🌸 พาสเทลน่ารัก', 'gl-sakura'],
          ['gstage', 'ลูกแก้วเวทีคอนเสิร์ต', '🎤 สายนักร้อง', 'gl-gstage'], ['gpiano', 'ลูกแก้วกล่องดนตรีเปียโน', '🎤 สายนักร้อง', 'gl-gpiano'],
        ] },
        { key: 'swirl', label: 'ของขวัญหมุนวนเมื่อมีของใหม่', type: 'toggle', def: true, hint: 'เหมือนเขย่าลูกแก้วหิมะเบา ๆ แล้วค่อย ๆ ตกกลับมากอง' },
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
  spacedome: {
    resettable: 'ล้างของขวัญในโดมและอันดับ',
    sections: [
      { title: 'โดมอวกาศ', fields: [
        { key: 'shape', label: 'แบบโดม', type: 'select', def: 'smoon', options: [
          ['smoon', 'ฐานบนดวงจันทร์', '🌸 พาสเทลน่ารัก', 'sp-moon'],
          ['sring', 'ดาวเคราะห์วงแหวน', '🌸 พาสเทลน่ารัก', 'sp-ring'],
          ['sufo', 'ยาน UFO', '🌸 พาสเทลน่ารัก', 'sp-ufo'],
          ['shelmet', 'หมวกนักบินอวกาศ', '🌸 พาสเทลน่ารัก', 'sp-helmet'],
          ['sstation', 'สถานีอวกาศ', '🌸 พาสเทลน่ารัก', 'sp-station'],
          ['sgalaxy', 'กาแล็กซี่', '🌸 พาสเทลน่ารัก', 'sp-galaxy'],
          ['srocket', 'แคปซูลจรวด', '🌸 พาสเทลน่ารัก', 'sp-rocket'],
          ['sshield', 'โดมโล่พลังงาน', '🎮 สายเท่ เกมมิ่ง', 'sp-shield'],
          ['sobservatory', 'หอดูดาว', '🌸 พาสเทลน่ารัก', 'sp-observatory'],
          ['smilitary', 'ฐานทัพอวกาศ', '🎮 สายเท่ เกมมิ่ง', 'sp-military'],
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
          ['pig', 'หมูท้องใส งับของขวัญ', '🌸 พาสเทลน่ารัก', 'gj-pig'], ['catbelly', 'แมวท้องใส', '🌸 พาสเทลน่ารัก', 'gj-catbelly'], ['jdino', 'ไดโนเสาร์ท้องใส', '🌸 พาสเทลน่ารัก', 'gj-jdino'], ['jbear', 'หมีท้องใส', '🌸 พาสเทลน่ารัก', 'gj-jbear'], ['jfrog', 'กบท้องใส', '🌸 พาสเทลน่ารัก', 'gj-jfrog'],
          ['xrobot', 'หุ่นยนต์', '🎮 สายเท่ เกมมิ่ง', 'gj-xrobot'], ['xwolf', 'หมาป่าไซเบอร์', '🎮 สายเท่ เกมมิ่ง', 'gj-xwolf'], ['xdragon', 'มังกรนีออน', '🎮 สายเท่ เกมมิ่ง', 'gj-xdragon'],
          ['mbird', 'นกร้องเพลง', '🎤 สายนักร้อง', 'gj-mbird'], ['mcat', 'แมวนักร้อง', '🎤 สายนักร้อง', 'gj-mcat'], ['mbear', 'หมีนักร้อง', '🎤 สายนักร้อง', 'gj-mbear'],
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
        { key: 'leafTone', label: 'สีใบไม้', type: 'select', def: 'pastel', options: [['pastel', '🌿 พาสเทลอ่อน (ไม่เขียวเข้ม)'], ['mint', '💚 มิ้นต์'], ['pink', '🩷 ชมพู'], ['lavender', '💜 ลาเวนเดอร์'], ['sakura', '🌸 ซากุระ'], ['gold', '💛 ทอง'], ['original', 'สีเดิมของแบบ']] },
        { key: 'skin', label: 'แบบกระถาง', type: 'select', def: 'image', options: [
          ['image', 'กระถางหัวใจมีปีก', '🌸 พาสเทลน่ารัก', 'gd-image'], ['cat', 'กระถางหน้าแมว', '🌸 พาสเทลน่ารัก', 'pot-cat'], ['bunny', 'กระถางกระต่าย', '🌸 พาสเทลน่ารัก', 'pot-bunny'], ['bear', 'กระถางหมี', '🌸 พาสเทลน่ารัก', 'pot-bear'], ['teacup', 'กระถางถ้วยชา', '🌸 พาสเทลน่ารัก', 'pot-teacup'], ['boot', 'กระถางรองเท้าบูท', '🌸 พาสเทลน่ารัก', 'pot-boot'], ['pumpkin', 'กระถางฟักทอง', '🌸 พาสเทลน่ารัก', 'pot-pumpkin'], ['star', 'กระถางดาว', '🌸 พาสเทลน่ารัก', 'pot-star'], ['cart', 'รถเข็นดอกไม้', '🌸 พาสเทลน่ารัก', 'pot-cart'], ['basket', 'ตะกร้าสาน', '🌸 พาสเทลน่ารัก', 'pot-basket'],
          ['tech', 'กระถางเทคนีออน', '🎮 สายเท่ เกมมิ่ง', 'pot-tech'],
          ['trumpet', 'กระถางแตรทอง', '🎤 สายนักร้อง', 'pot-trumpet'], ['drum', 'กระถางกลอง', '🎤 สายนักร้อง', 'pot-drum'],
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
          ['tree', 'ต้นไม้ใหญ่', '🌸 พาสเทลน่ารัก', 'gd-tree'], ['sakura', 'ต้นซากุระ', '🌸 พาสเทลน่ารัก', 'gd-sakura'], ['night', 'ต้นไม้ดวงดาว', '🌸 พาสเทลน่ารัก', 'gd-night'], ['heart', 'ต้นหัวใจ', '🌸 พาสเทลน่ารัก', 'gd-heart'], ['bonsai', 'บอนไซกระถางหัวใจ', '🌸 พาสเทลน่ารัก', 'gd-bonsai'], ['palm', 'ต้นปาล์มเกาะ', '🌸 พาสเทลน่ารัก', 'gd-palm'], ['autumn', 'ต้นไม้ใบไม้ร่วง', '🌸 พาสเทลน่ารัก', 'gd-autumn'],
          ['cyber', 'ต้นไม้ไซเบอร์', '🎮 สายเท่ เกมมิ่ง', 'gd-cyber'],
          ['notes', 'ต้นไม้โน้ตดนตรี', '🎤 สายนักร้อง', 'gd-notes'],
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
          ['image', 'ตู้ชมพู', '🌸 พาสเทลน่ารัก', 'cj-image'], ['cupcake', 'ตู้คัพเค้ก', '🌸 พาสเทลน่ารัก', 'cj-cupcake'], ['cat', 'ตู้หัวแมว', '🌸 พาสเทลน่ารัก', 'cj-cat'], ['house', 'บ้านขนมปังขิง', '🌸 พาสเทลน่ารัก', 'cj-house'], ['rocket', 'ตู้จรวด', '🌸 พาสเทลน่ารัก', 'cj-rocket'], ['gacha', 'ตู้กาชาปอง', '🌸 พาสเทลน่ารัก', 'cj-gacha'], ['gift', 'ตู้กล่องของขวัญ', '🌸 พาสเทลน่ารัก', 'cj-gift'], ['icecream', 'ร้านไอศกรีม', '🌸 พาสเทลน่ารัก', 'cj-icecream'], ['bear', 'หมีน้อยถือกล่อง', '🌸 พาสเทลน่ารัก', 'cj-bear'],
          ['arcade', 'ตู้เกมอาร์เคด', '🎮 สายเท่ เกมมิ่ง', 'cj-arcade'], ['atm', 'ตู้ ATM ทองคำ', '🎮 สายเท่ เกมมิ่ง', 'cj-atm'], ['reactor', 'เตาปฏิกรณ์ไซไฟ', '🎮 สายเท่ เกมมิ่ง', 'cj-reactor'],
          ['karaoke', 'ตู้คาราโอเกะ', '🎤 สายนักร้อง', 'cj-karaoke'],
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
        { key: 'style', label: 'รูปแบบ', type: 'select', def: 'bar', options: [['bar', '▬ แถบเปอร์เซ็นต์'], ['heart', '💖 หัวใจแก้วเรียบ ๆ', 'หัวใจแก้ว'], ['h-angel', '👼 หัวใจปีกนางฟ้า', 'หัวใจแก้ว', '/overlay/hearts/thumb-angel.webp'], ['h-potion', '🧪 ขวดยาเวทมนตร์', 'หัวใจแก้ว', '/overlay/hearts/thumb-potion.webp'], ['h-bowjar', '🎀 โหลโบว์ชมพู', 'หัวใจแก้ว', '/overlay/hearts/thumb-bowjar.webp'], ['h-piggy', '🐷 กระปุกของเล่น', 'หัวใจแก้ว', '/overlay/hearts/thumb-piggy.webp'], ['h-cyber', '🎮 หัวใจไซเบอร์', 'หัวใจแก้ว', '/overlay/hearts/thumb-cyber.webp'], ['h-melody', '🎤 หัวใจโน้ตดนตรี', 'หัวใจแก้ว', '/overlay/hearts/thumb-melody.webp']] },
        { key: 'type', label: 'นับจาก', type: 'select', def: 'like', options: [['like', '❤️ ไลค์'], ['follow', '➕ ผู้ติดตาม'], ['share', '🔁 แชร์'], ['diamond', '💎 เพชร'], ['gift', '🎁 จำนวนของขวัญ']] },
        { key: 'target', label: 'เป้าหมาย', type: 'number', min: 1, def: 10000 },
        { key: 'next', label: 'ถึงเป้าแล้วเพิ่มเป้าถัดไปอีก', type: 'number', min: 0, def: 0, hint: '0 = ไม่เพิ่ม' },
        { key: 'label', label: 'หัวข้อ', type: 'text', def: '', placeholder: 'เว้นว่าง = ตามชนิด' },
        { key: 'liq', label: 'สีน้ำในหัวใจ', type: 'select', def: 'auto', options: [['auto', '✨ ตามสิ่งที่นับ'], ['pink', '💗 ชมพู'], ['red', '❤️ แดง'], ['purple', '💜 ม่วง'], ['blue', '💙 ฟ้า'], ['mint', '💚 มิ้นต์'], ['gold', '💛 ทอง'], ['peach', '🧡 พีช'], ['rainbow', '🌈 สีรุ้งเปลี่ยนไปเรื่อย ๆ']] },
        { key: 'size', label: 'ขนาดหัวใจ', type: 'range', min: 0.5, max: 2.5, step: 0.1, def: 1, unit: '×', hint: 'ใช้กับแบบหัวใจแก้ว' },
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
  pile: {
    resettable: 'ล้างกองของขวัญ',
    sections: [
      { title: 'กองทับกัน', fields: [
        { key: 'width', label: 'ความกว้างของกอง', type: 'range', min: 20, max: 100, step: 5, def: 60, unit: '%', hint: 'กองอยู่กลางจอ — 100 = เต็มความกว้าง' },
        { key: 'max', label: 'จำนวนสูงสุด (ชิ้น)', type: 'number', min: 60, max: 1500, def: 600, hint: 'เกินแล้วชิ้นเก่าสุดค่อย ๆ จางไป' },
        { key: 'giftScale', label: 'ขนาดของขวัญ', type: 'range', min: 0.4, max: 3, step: 0.1, def: 1, unit: '×' },
        { key: 'minCoins', label: 'รับเฉพาะของขวัญตั้งแต่ (เหรียญ)', type: 'number', min: 0, def: 0 },
        { key: 'glow', label: 'ของแพงเรืองแสง', type: 'toggle', def: true },
        { key: 'alert', label: 'แสดงชื่อคนส่ง', type: 'toggle', def: true },
      ] },
    ],
  },
  mascot: {
    sections: [
      { title: 'ตัวละคร', fields: [
        { key: 'char', label: 'เลือกตัวแทนวีเจ', type: 'select', def: 'G1', options: [['G1', '🐰 กระต่ายหวาน', '👧 ผู้หญิง', '/overlay/mascot/G1/thumb.webp'], ['G2', '⭐ ไอดอลดาว', '👧 ผู้หญิง', '/overlay/mascot/G2/thumb.webp'], ['G4', '🔮 แม่มดไพ่ทาโร่', '👧 ผู้หญิง', '/overlay/mascot/G4/thumb.webp'], ['G6', '🎮 เกมเมอร์สาว', '👧 ผู้หญิง', '/overlay/mascot/G6/thumb.webp'], ['G8', '🌸 ชุดไทยประยุกต์', '👧 ผู้หญิง', '/overlay/mascot/G8/thumb.webp'], ['B4', '👑 เจ้าชาย', '👦 ผู้ชาย', '/overlay/mascot/B4/thumb.webp'], ['B7', '🧙 นักเวทย์', '👦 ผู้ชาย', '/overlay/mascot/B7/thumb.webp'], ['B8', '🎸 ร็อกเกอร์น่ารัก', '👦 ผู้ชาย', '/overlay/mascot/B8/thumb.webp'], ['B10', '🍜 เชฟหนุ่ม', '👦 ผู้ชาย', '/overlay/mascot/B10/thumb.webp']] },
        { key: 'name', label: 'ป้ายชื่อใต้ตัวละคร (เว้นว่าง = ไม่มี)', type: 'text', def: '' },
      ] },
      { title: 'ท่าทางอัตโนมัติ', fields: [
        { key: 'thanks', label: 'ได้ของขวัญ → ยื่นมือรับ (รูปกิฟต์จริง) + กล่องคำขอบคุณ', type: 'toggle', def: true },
        { key: 'thankText', label: 'คำขอบคุณ', type: 'text', def: 'ขอบคุณ {user} ที่ส่ง {gift} นะคะ 💖', when: (v) => !!v.thanks },
        { key: 'big', label: 'กิฟต์ใหญ่ (ดีใจ + เต้น) ตั้งแต่ (เหรียญ)', type: 'number', min: 1, def: 100 },
        { key: 'follow', label: 'มีคนติดตาม → ส่งหัวใจ', type: 'toggle', def: true },
        { key: 'followText', label: 'คำขอบคุณผู้ติดตาม', type: 'text', def: 'ขอบคุณ {user} ที่ติดตามน้า 😘', when: (v) => !!v.follow },
      ] },
      { title: 'ตำแหน่งและขนาด', fields: [
        { key: 'pos', label: 'ตำแหน่ง', type: 'select', def: 'br', options: [['br', '↘️ มุมขวาล่าง'], ['bl', '↙️ มุมซ้ายล่าง'], ['bc', '⬇️ กลางล่าง']] },
        size(),
      ] },
    ],
  },
  sign: {
    sections: [
      { title: 'ข้อความ', fields: [
        { key: 'text', label: 'ข้อความบนป้าย', type: 'text', def: '✨ ยินดีต้อนรับสู่ไลฟ์ ✨ | กดหัวใจให้หน่อยน้า 💖 | ฝากกดติดตามด้วยนะ', placeholder: 'ข้อความ 1 | ข้อความ 2', hint: 'หลายข้อความคั่นด้วย | · ใส่ยอดสดได้: {likes} ไลก์ · {diamonds} เพชร · {viewers} คนดู · {follows} ผู้ติดตามใหม่ · {gifts} กิฟต์' },
        { key: 'mode', label: 'การเคลื่อนไหว', type: 'select', def: 'scroll', options: [['scroll', '⬅️ วิ่ง (ข้อความเลื่อน)'], ['static', '⏸ อยู่กับที่ (สลับข้อความ)'], ['blink', '💡 กะพริบ'], ['pulse', '💓 เต้นตุบ ๆ']] },
        { key: 'speed', label: 'ความเร็ววิ่ง', type: 'range', min: 1, max: 10, step: 1, def: 5, when: (v) => v.mode === 'scroll' },
        { key: 'every', label: 'สลับข้อความทุก (วินาที)', type: 'number', min: 2, max: 60, def: 6, when: (v) => v.mode !== 'scroll' },
      ] },
      { title: 'หน้าตาป้าย', fields: [
        { key: 'style', label: 'แบบป้าย', type: 'select', def: 'led', options: [['led', '🟥 LED จุด'], ['neon', '🌈 นีออน'], ['bulb', '💡 ไฟหลอดรอบป้าย'], ['cute', '🍬 พาสเทลน่ารัก'], ['pixel', '👾 Pixel (เกม 8-bit)'], ['y2k', '💿 Y2K'], ['glass', '🫧 Glassmorphism (กระจกฝ้า)'], ['surreal', '🌀 Surrealism (ฝันเหนือจริง)'], ['boho', '🌻 Bohemian (โบฮีเมียน)'], ['victorian', '👑 Victorian (วิกตอเรียน)'], ['graffiti', '🎨 Graffiti (กราฟฟิตี้)'], ['future', '🚀 Futuristic (ไซเบอร์)'], ['mwhite', '◻️ มินิมอล ขาว'], ['mblack', '◼️ มินิมอล ดำ'], ['mline', '▁ มินิมอล เส้นใต้'], ['mpill', '◯ มินิมอล แคปซูล']] },
        { key: 'color', label: 'สีตัวอักษร', type: 'color', def: '#ff4fa3', when: (v) => v.style !== 'bulb' && v.style !== 'cute' },
        { key: 'rainbow', label: 'สีรุ้งไล่สี', type: 'toggle', def: false },
        { key: 'font', label: 'ฟอนต์', type: 'select', def: 'Kanit', options: [['Kanit', 'Kanit (หนา ชัด)'], ['Mitr', 'Mitr (มน)'], ['Mali', 'Mali (น่ารัก)'], ['Itim', 'Itim (ลายมือ)']] },
        { key: 'size', label: 'ขนาดตัวอักษร', type: 'range', min: 24, max: 160, step: 2, def: 64, unit: 'px' },
        { key: 'width', label: 'ความกว้างป้าย', type: 'range', min: 20, max: 100, step: 5, def: 80, unit: '%' },
        { key: 'pos', label: 'ตำแหน่ง', type: 'select', def: 'top', options: [['top', 'บน'], ['center', 'กลางจอ'], ['bottom', 'ล่าง']] },
        bg(85),
      ] },
    ],
  },
  fxmenu: {
    sections: [
      { title: 'เมนูของขวัญ', fields: [
        { key: 'theme', label: 'เทมเพลตหน้าตา', type: 'select', def: 'glass', options: [['glass', '🔮 กระจกม่วง (เดิม)'], ['candy', '🍬 พาสเทลแคนดี้'], ['white', '◻️ มินิมอล ขาว'], ['neon', '🌈 นีออน'], ['gold', '👑 หรูทองคำ'], ['bubble', '🫧 ฟองลอย (ไม่มีกรอบ)']] },
        { key: 'showTitle', label: 'แสดงหัวข้อ', type: 'toggle', def: true },
        { key: 'title', label: 'หัวข้อ', type: 'text', def: '🎁 ส่งของขวัญเพื่อ…', when: (v) => v.showTitle !== false },
        { key: 'items', label: 'รายการที่แสดง', type: 'menuItems', def: '', hint: 'ดึงจากกฎ Actions อัตโนมัติ · ติ๊กออก = ไม่แสดง · กดรูปเพื่อเลือกรูปของขวัญ · แก้คำในเมนูได้' },
        { key: 'item', label: 'หน้าตาแต่ละข้อ', type: 'select', def: 'tile', options: [['tile', '🎁 รูปของขวัญ + คำอธิบายใต้รูป (ไม่มีพื้นหลัง)'], ['row', '▭ แถบ: รูปซ้าย + "ส่ง … เหรียญ"']] },
        { key: 'layout', label: 'รูปแบบ', type: 'select', def: 'list', options: [['list', 'รายการ (โชว์หลายข้อ)'], ['rotate', 'หมุนเปลี่ยนรายการ (ประหยัดที่)']] },
        { key: 'per', label: 'หมุนทีละกี่รายการ', type: 'number', min: 1, max: 10, def: 1, when: (v) => v.layout === 'rotate' },
        { key: 'dir', label: 'แนวการเรียง', type: 'select', def: 'vertical', options: [['vertical', '↕️ แนวตั้ง (เรียงลงมา)'], ['horizontal', '↔️ แนวนอน (เรียงเป็นแถว)']], when: (v) => v.layout !== 'rotate' },
        { key: 'move', label: 'ของขวัญขยับ', type: 'select', def: 'bounce', options: [['bounce', '🦘 เด้งดึ๋ง'], ['bob', '🎈 ลอยเบา ๆ'], ['wiggle', '👋 ส่ายไปมา'], ['pulse', '💓 เต้นตุบ ๆ'], ['spin', '🔄 หมุน'], ['none', '⏸ นิ่ง']] },
        { key: 'max', label: 'จำนวนที่แสดง', type: 'number', min: 1, max: 12, def: 6, when: (v) => v.layout !== 'rotate' },
        { key: 'every', label: 'เปลี่ยนทุก (วินาที)', type: 'number', min: 2, max: 30, def: 5, when: (v) => v.layout === 'rotate' },
        { key: 'other', label: 'รวมกฎแชท / ติดตาม / แชร์', type: 'toggle', def: true },
        { key: 'pos', label: 'มุมจอ', type: 'select', def: 'tl', options: [['tl', 'บนซ้าย'], ['tr', 'บนขวา'], ['bl', 'ล่างซ้าย'], ['br', 'ล่างขวา']] },
        bg(45),
        { key: 'scale', label: 'ขนาด', type: 'range', min: 0.4, max: 4, step: 0.05, def: 1, unit: '×', hint: 'จอ 4K: ตั้ง Browser Source ใน OBS เป็น 3840×2160 แล้วตั้งขนาด 2× — ตัวหนังสือและรูปคมชัด' },
      ] },
    ],
  },
  donate: {
    sections: [
      { title: 'บัญชีรับโดเนท', fields: [
        { key: 'promptpay', label: 'พร้อมเพย์', type: 'text', def: '', placeholder: '08xxxxxxxx', hint: 'ตั้งได้ที่เมนู “โดเนทขึ้นจอ” ด้วย' },
        { key: 'min', label: 'โดเนทขั้นต่ำ (บาท)', type: 'number', min: 1, def: 10 },
        { key: 'title', label: 'ข้อความบนหน้าโดเนท', type: 'text', def: '' },
      ] },
      { title: 'แจ้งเตือนบนจอ', fields: [
        { key: 'label', label: 'คำหลังชื่อ', type: 'text', def: 'โดเนท' },
        { key: 'pos', label: 'ตำแหน่ง', type: 'select', def: 'top', options: [['top', 'บน'], ['center', 'กลางจอ'], ['bottom', 'ล่าง']] },
        { key: 'dur', label: 'แสดงนาน (วินาที)', type: 'number', min: 3, max: 30, def: 8 },
        { key: 'sound', label: 'เสียงกริ๊ง', type: 'toggle', def: true },
        { key: 'coins', label: 'เหรียญ/หัวใจโปรย', type: 'toggle', def: true },
        size(),
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
        { key: 'frames', label: 'แท่น Top 3 (กรอบขยับได้)', type: 'select', def: 'a', options: [['a', '👑 พระราชวัง', '', '/overlay/frames/r1.webp'], ['b', '👑 พระราชวัง แบบ 2', '', '/overlay/frames/r1b.webp'], ['gaming', '🎮 เกมมิ่ง นีออน', '', '/overlay/frames/g1.webp'], ['singer', '🎤 นักร้อง เวที', '', '/overlay/frames/s1.webp'], ['toy', '🧸 Toy Cute', '', '/overlay/frames/t1.webp'], ['minimal', '◯ มินิมอล', '', '/overlay/frames/minimal.webp'], ['off', 'ปิด — รายการธรรมดา', '', '/overlay/frames/list.webp']] },
        { key: 'list', label: 'แสดงรายการอันดับถัดไปใต้แท่น', type: 'toggle', def: true, hint: 'ปิด = โชว์แค่ 3 อันดับแรกบนแท่น', when: (v) => v.frames !== 'off' },
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
        { key: 'frames', label: 'แท่น Top 3 (กรอบขยับได้)', type: 'select', def: 'a', options: [['a', '👑 พระราชวัง', '', '/overlay/frames/r1.webp'], ['b', '👑 พระราชวัง แบบ 2', '', '/overlay/frames/r1b.webp'], ['gaming', '🎮 เกมมิ่ง นีออน', '', '/overlay/frames/g1.webp'], ['singer', '🎤 นักร้อง เวที', '', '/overlay/frames/s1.webp'], ['toy', '🧸 Toy Cute', '', '/overlay/frames/t1.webp'], ['minimal', '◯ มินิมอล', '', '/overlay/frames/minimal.webp'], ['off', 'ปิด — รายการธรรมดา', '', '/overlay/frames/list.webp']] },
        { key: 'list', label: 'แสดงรายการอันดับถัดไปใต้แท่น', type: 'toggle', def: true, hint: 'ปิด = โชว์แค่ 3 อันดับแรกบนแท่น', when: (v) => v.frames !== 'off' },
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
