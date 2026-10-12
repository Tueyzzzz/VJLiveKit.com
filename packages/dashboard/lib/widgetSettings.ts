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
  | { key: string; label: string; type: 'menuItems'; def: string; hint?: string; when?: (v: Values) => boolean }
  /** รายการของขวัญที่เลือกเอง + วินาที: ค่า = JSON [{ name, sec }] · tone = สีแถว (เพิ่ม/ลด) */
  | { key: string; label: string; type: 'giftlist'; def: string; tone?: 'add' | 'sub'; hint?: string; when?: (v: Values) => boolean };

export type Values = Record<string, string | number | boolean>;
export interface Section { title: string; fields: FieldDef[] }
export interface WidgetSettingsDef { sections: Section[]; /** มีข้อมูลที่จำไว้ (กองของขวัญ/อันดับ/เวลา) ให้ล้างได้ */ resettable?: string }

const FONTS: [string, string][] = [['Kanit', 'Kanit'], ['Prompt', 'Prompt'], ['Mitr', 'Mitr'], ['Sriracha', 'Sriracha (ลายมือ)'], ['Chakra Petch', 'Chakra Petch']];
const bg = (def = 35): FieldDef => ({ key: 'bg', label: 'ความทึบพื้นหลัง', type: 'range', min: 0, max: 100, step: 5, def, unit: '%', hint: '0 = ใสทั้งหมด' });
const size = (def = 1): FieldDef => ({ key: 'scale', label: 'ขนาด', type: 'range', min: 0.4, max: 2, step: 0.05, def, unit: '×' });
// เปลี่ยนสีภาพ 3D (หมุนเฉดสี): 0 = ชมพูเดิม · -60 ม่วง · -120 ฟ้า · 180 มิ้นต์ · 120 เขียว · 50 พีช/ทอง
// แบบสายเท่/เกมมิ่ง (นีออนฟ้า-ชมพูบนตัวดำ) — ใช้จุดสีชุดคู่นีออนของตัวเอง
const COOL_THEMES = new Set(['gcontroller', 'gheadset', 'gpctower', 'gkeycap', 'gpotionhp', 'gpotionmp', 'glootbox', 'gcrystal', 'gpixheart', 'gtoken', 'gtrophy', 'gmushroom', 'gvr', 'gmecha', 'gsoda', 'gbattery', 'gportal', 'gghost', 'grank', 'gdice', 'capsule', 'xtech', 'xcan', 'xcan2', 'xchest', 'xrobot', 'xwolf', 'xdragon', 'arcade', 'atm', 'reactor', 'sports', 'offroad', 'jdm', 'bike', 'cyber', 'tech', 'smilitary', 'sshield', 'sneon', 'slava', 'sstarship', 'sarcade', 'sblackhole']);
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
// กรอบรูปภาพแท่น MVP 10 ธีม (overlay/public/mvp/frame-XX.webp · ตำแหน่งช่องใน mvp/frames.json) — ใช้ทั้ง MVP ของ PK และอันดับผู้ชม
const MVP_FRAMES: [string, string][] = [['01', '💗 ชมพูพาสเทล'], ['02', '👑 ทองทับทิม'], ['03', '🎮 นีออนเกมมิ่ง'], ['04', '🌌 กาแล็กซี'], ['05', '🌸 ซากุระ'],
  ['06', '🍦 ไอศกรีมแคนดี้'], ['07', '🪷 ไทยประเพณี'], ['08', '🧜 นางเงือกใต้ทะเล'], ['09', '🧸 หมีกับกระต่าย'], ['10', '🥊 แชมป์มวย ดำทอง']];
const mvpThumb = (id: string) => `/overlay/mvp/thumb-${id}.webp`;
const MVP_RANK_OPTS: [string, string, string?, string?][] = MVP_FRAMES.map(([id, l]) => ['mvp' + id, l, '🏆 แท่นกรอบรูปเต็มชุด', mvpThumb(id)]);
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
          ['jstar', 'โหลดาว', '🌸 พาสเทลน่ารัก', 'gj-jstar'], ['vaseglass', 'แจกันแก้วชมพู', '🌸 พาสเทลน่ารัก', 'gj-vaseglass'], ['boba', 'แก้วชานมไข่มุก', '🧁 ขนม & เครื่องดื่ม', 'gj-boba'], ['claw', 'ตู้คีบตุ๊กตา', '🧸 ตุ๊กตา & ของเล่น', 'gj-claw'], ['cakejar', 'เค้กชั้นใส', '🧁 ขนม & เครื่องดื่ม', 'gj-cakejar'], ['glassbear', 'ตุ๊กตาหมีใส', '🧸 ตุ๊กตา & ของเล่น', 'gj-glassbear'], ['planetjar', 'ขวดดาวเคราะห์', '🎡 สวนสนุก & เทศกาล', 'gj-planetjar'], ['latte', 'แก้วลาเต้', '🧁 ขนม & เครื่องดื่ม', 'gj-latte'], ['milkbox', 'กล่องนมสตรอว์เบอร์รี่', '🧁 ขนม & เครื่องดื่ม', 'gj-milkbox'], ['cupcake1', 'คัพเค้กใส', '🧁 ขนม & เครื่องดื่ม', 'gj-cupcake1'], ['strawberry', 'โหลสตรอว์เบอร์รี่', '🧁 ขนม & เครื่องดื่ม', 'gj-strawberry'], ['glasspig', 'กระปุกหมูแก้ว', '🧸 ตุ๊กตา & ของเล่น', 'gj-glasspig'], ['cupcake2', 'คัพเค้กเชอร์รี่', '🧁 ขนม & เครื่องดื่ม', 'gj-cupcake2'], ['perfume', 'ขวดน้ำหอมหัวใจ', '💎 หรูหรา & โรแมนติก', 'gj-perfume'], ['cloud', 'ก้อนเมฆสายรุ้ง', '🎡 สวนสนุก & เทศกาล', 'gj-cloud'], ['diamond', 'เพชรเจ้าหญิง', '💎 หรูหรา & โรแมนติก', 'gj-diamond'], ['crownjar', 'มงกุฎแก้ว', '💎 หรูหรา & โรแมนติก', 'gj-crownjar'], ['capsule', 'แคปซูลนีออน', '🎮 สายเท่ เกมมิ่ง', 'gj-capsule'], ['hourglass', 'นาฬิกาทราย', '💎 หรูหรา & โรแมนติก', 'gj-hourglass'], ['glasssnowman', 'มนุษย์หิมะแก้ว', '🧸 ตุ๊กตา & ของเล่น', 'gj-glasssnowman'], ['idolmic', 'ไมค์ไอดอล', '🎤 สายนักร้อง', 'gj-idolmic'], ['lantern', 'โคมจีนแก้ว', '🎡 สวนสนุก & เทศกาล', 'gj-lantern'], ['pumpkinjar', 'ฟักทองแก้ว', '🎡 สวนสนุก & เทศกาล', 'gj-pumpkinjar'], ['sakurabottle', 'ขวดซากุระ', '💎 หรูหรา & โรแมนติก', 'gj-sakurabottle'], ['tuktuk', 'ตุ๊กตุ๊กใส', '🧸 ตุ๊กตา & ของเล่น', 'gj-tuktuk'], ['mailbox', 'กล่องจดหมายหัวใจ', '💎 หรูหรา & โรแมนติก', 'gj-mailbox'], ['ferris', 'ชิงช้าสวรรค์ (กระเช้าหมุน)', '🎡 สวนสนุก & เทศกาล', 'gj-ferris'], ['fcarousel', 'ม้าหมุนใส', '🎡 สวนสนุก & เทศกาล', 'gj-fcarousel'], ['fballoon', 'บอลลูนใส', '🎡 สวนสนุก & เทศกาล', 'gj-fballoon'], ['fcotton', 'สายไหมใส', '🎡 สวนสนุก & เทศกาล', 'gj-fcotton'], ['fpopcorn', 'รถป๊อปคอร์น', '🎡 สวนสนุก & เทศกาล', 'gj-fpopcorn'], ['fgumball', 'ตู้กัมบอล', '🎡 สวนสนุก & เทศกาล', 'gj-fgumball'], ['fcircus', 'เต็นท์ละครสัตว์', '🎡 สวนสนุก & เทศกาล', 'gj-fcircus'], ['fbumper', 'รถบั๊มใส', '🎡 สวนสนุก & เทศกาล', 'gj-fbumper'], ['frocket', 'จรวดสวนสนุก', '🎡 สวนสนุก & เทศกาล', 'gj-frocket'], ['fteacup', 'ถ้วยกาแฟหมุน', '🎡 สวนสนุก & เทศกาล', 'gj-fteacup'], ['fbauble', 'ลูกบอลคริสต์มาส', '🎡 สวนสนุก & เทศกาล', 'gj-fbauble'], ['fsongkran', 'ขันสงกรานต์', '🎡 สวนสนุก & เทศกาล', 'gj-fsongkran'], ['fkrathong', 'กระทงแก้ว', '🎡 สวนสนุก & เทศกาล', 'gj-fkrathong'], ['fgoldpot', 'ไหทองตรุษจีน', '🎡 สวนสนุก & เทศกาล', 'gj-fgoldpot'], ['fcauldron', 'หม้อแม่มด', '🎡 สวนสนุก & เทศกาล', 'gj-fcauldron'], ['feaster', 'ไข่อีสเตอร์', '🎡 สวนสนุก & เทศกาล', 'gj-feaster'], ['fheartbal', 'ลูกโป่งหัวใจ', '🎡 สวนสนุก & เทศกาล', 'gj-fheartbal'], ['fgiftbox', 'กล่องของขวัญใส', '🎡 สวนสนุก & เทศกาล', 'gj-fgiftbox'], ['ffirework', 'ลูกพลุแก้ว', '🎡 สวนสนุก & เทศกาล', 'gj-ffirework'], ['ficecream', 'รถไอศกรีม', '🎡 สวนสนุก & เทศกาล', 'gj-ficecream'], ['fprize', 'โหลรางวัลงานวัด', '🎡 สวนสนุก & เทศกาล', 'gj-fprize'], ['moak', 'โหลแก้วฝาไม้โอ๊ค', '🤍 มินิมอล', 'gj-moak'], ['mvase', 'แจกันแก้วทรงสูง', '🤍 มินิมอล', 'gj-mvase'], ['mcloche', 'ครอบแก้วฐานไม้', '🤍 มินิมอล', 'gj-mcloche'], ['msage', 'กล่องแก้วฝาเขียวเสจ', '🤍 มินิมอล', 'gj-msage'], ['mfishbowl', 'โหลกลมผูกโบว์ลินิน', '🤍 มินิมอล', 'gj-mfishbowl'], ['mmason', 'โหลเมสันป้ายกระดาษ', '🤍 มินิมอล', 'gj-mmason'], ['mapoth', 'โหลแก้วทรงเภสัช', '🤍 มินิมอล', 'gj-mapoth'], ['mcork', 'โหลก้อนกรวดฝาจุก', '🤍 มินิมอล', 'gj-mcork'], ['mhex', 'กล่องแก้วหกเหลี่ยมขอบทอง', '🤍 มินิมอล', 'gj-mhex'], ['mmilk', 'ขวดนมแก้ว', '🤍 มินิมอล', 'gj-mmilk'],
          ['jbasket', 'โหลตะกร้า', '🌸 พาสเทลน่ารัก', 'gj-jbasket'],
          ['cauldron', 'โหลหม้อแม่มด', '🌸 พาสเทลน่ารัก', 'gj-cauldron'],
          ['catbank', 'กระปุกแมวใส', '🌸 พาสเทลน่ารัก', 'gj-catbank'],
          ['jsnowman', 'โหลตุ๊กตาหิมะ', '🌸 พาสเทลน่ารัก', 'gj-jsnowman'],
          ['xtech', 'โหลแก้วเทค', '🎮 สายเท่ เกมมิ่ง', 'gj-xtech'], ['xcan', 'ถังพลังงานฟ้า', '🎮 สายเท่ เกมมิ่ง', 'gj-xcan'], ['xcan2', 'ถังพลังงานชมพู', '🎮 สายเท่ เกมมิ่ง', 'gj-xcan2'], ['xchest', 'หีบสมบัติเกม', '🎮 สายเท่ เกมมิ่ง', 'gj-xchest'], ['gcontroller', 'จอยเกมใส', '🎮 สายเท่ เกมมิ่ง', 'gj-gcontroller'], ['gheadset', 'หูฟังเกมมิ่ง', '🎮 สายเท่ เกมมิ่ง', 'gj-gheadset'], ['gpctower', 'เคสคอม RGB', '🎮 สายเท่ เกมมิ่ง', 'gj-gpctower'], ['gkeycap', 'ปุ่มคีย์บอร์ดยักษ์', '🎮 สายเท่ เกมมิ่ง', 'gj-gkeycap'], ['gpotionhp', 'ขวดยาเลือด HP', '🎮 สายเท่ เกมมิ่ง', 'gj-gpotionhp'], ['gpotionmp', 'ขวดยามานา MP', '🎮 สายเท่ เกมมิ่ง', 'gj-gpotionmp'], ['glootbox', 'กล่องสุ่มตำนาน', '🎮 สายเท่ เกมมิ่ง', 'gj-glootbox'], ['gcrystal', 'แคปซูลคริสตัลพลังงาน', '🎮 สายเท่ เกมมิ่ง', 'gj-gcrystal'], ['gpixheart', 'หัวใจพิกเซล', '🎮 สายเท่ เกมมิ่ง', 'gj-gpixheart'], ['gtoken', 'เหรียญตู้เกม', '🎮 สายเท่ เกมมิ่ง', 'gj-gtoken'], ['gtrophy', 'ถ้วยแชมป์อีสปอร์ต', '🎮 สายเท่ เกมมิ่ง', 'gj-gtrophy'], ['gmushroom', 'เห็ดพลังเพิ่ม', '🎮 สายเท่ เกมมิ่ง', 'gj-gmushroom'], ['gvr', 'แว่น VR', '🎮 สายเท่ เกมมิ่ง', 'gj-gvr'], ['gmecha', 'หัวหุ่นยนต์', '🎮 สายเท่ เกมมิ่ง', 'gj-gmecha'], ['gsoda', 'กระป๋องเครื่องดื่มนีออน', '🎮 สายเท่ เกมมิ่ง', 'gj-gsoda'], ['gbattery', 'แบตเตอรี่พลังงาน', '🎮 สายเท่ เกมมิ่ง', 'gj-gbattery'], ['gportal', 'ประตูมิติ', '🎮 สายเท่ เกมมิ่ง', 'gj-gportal'], ['gghost', 'ผีน้อยนีออน', '🎮 สายเท่ เกมมิ่ง', 'gj-gghost'], ['grank', 'เหรียญแรงก์เพชร', '🎮 สายเท่ เกมมิ่ง', 'gj-grank'], ['gdice', 'ลูกเต๋า D20', '🎮 สายเท่ เกมมิ่ง', 'gj-gdice'],
          ['mmic', 'โหลไมโครโฟน', '🎤 สายนักร้อง', 'gj-mmic'], ['mcoupe', 'แก้วแชมเปญยักษ์', '🎤 สายนักร้อง', 'gj-mcoupe'], ['mbox', 'กล่องดนตรี', '🎤 สายนักร้อง', 'gj-mbox'], ['mdrum', 'กลองใส', '🎤 สายนักร้อง', 'gj-mdrum'], ['mjuke', 'โดมตู้เพลง', '🎤 สายนักร้อง', 'gj-mjuke'],
        ] },
        ...tint((v) => ['gcontroller', 'gheadset', 'gpctower', 'gkeycap', 'gpotionhp', 'gpotionmp', 'glootbox', 'gcrystal', 'gpixheart', 'gtoken', 'gtrophy', 'gmushroom', 'gvr', 'gmecha', 'gsoda', 'gbattery', 'gportal', 'gghost', 'grank', 'gdice', 'fcarousel', 'fballoon', 'fcotton', 'fpopcorn', 'fgumball', 'fcircus', 'fbumper', 'frocket', 'fteacup', 'fbauble', 'fsongkran', 'fkrathong', 'fgoldpot', 'fcauldron', 'feaster', 'fheartbal', 'fgiftbox', 'ffirework', 'ficecream', 'fprize', 'moak', 'mvase', 'mcloche', 'msage', 'mfishbowl', 'mmason', 'mapoth', 'mcork', 'mhex', 'mmilk', 'boba', 'cakejar', 'latte', 'milkbox', 'cupcake1', 'cupcake2', 'strawberry', 'glassbear', 'glasspig', 'glasssnowman', 'claw', 'tuktuk', 'perfume', 'diamond', 'crownjar', 'mailbox', 'hourglass', 'sakurabottle', 'ferris', 'lantern', 'pumpkinjar', 'cloud', 'planetjar', 'idolmic', 'vaseglass', 'capsule', 'heart', 'orb', 'tank', 'pig', 'sundae', 'jstar', 'jbasket', 'cauldron', 'catbank', 'jsnowman', 'catbelly', 'jdino', 'jbear', 'jfrog', 'castle', 'fishbowl', 'hearttank', 'moon', 'gacha', 'shell', 'sub', 'snow', 'van'].includes(String(v.shape))),
        { key: 'physics', label: 'ระบบฟิสิกส์ (ทดลอง)', type: 'select', def: '', when: (v) => !['ferris', 'car', 'van', 'pig', 'smoon', 'sring', 'sufo', 'shelmet', 'sstation', 'sgalaxy', 'srocket', 'sshield', 'sobservatory', 'smilitary', 'saurora', 'scrystal', 'sneon', 'ssakura', 'scandy', 'socean', 'sice', 'slava', 'smars', 'ssun', 'sjelly', 'sbunny', 'scat', 'sstarship', 'sarcade', 'sheart', 'scloud', 'szodiac', 'sblackhole', 'sdiamond'].includes(String(v.shape)), options: [['', '⚡ มาตรฐาน (ลื่นสุด รับของได้หลักพัน)'], ['matter', '🧪 สมจริง — ของหมุนเอียงตามแรงกระแทก (ทดลอง)']], hint: 'แบบสมจริงใช้ Matter.js · ถ้าจอกระตุกให้กลับไปแบบมาตรฐาน' },
        { key: 'bounce', label: 'การเด้งของขวัญในโหล', type: 'select', def: 'normal', when: (v) => v.physics === 'matter', options: [['normal', '🪨 ปกติ (กองนิ่ง)'], ['high', '🏀 เด้งสูง'], ['orbit', '🌀 วงโคจร หมุนรอบโหล'], ['float', '🎈 ลอยเอื่อย ๆ']] },
        { key: 'bounceK', label: 'ความแรงการเด้ง', type: 'range', min: 0.2, max: 3, step: 0.1, def: 1, unit: '×', when: (v) => v.physics === 'matter' && v.bounce !== 'normal' },
        { key: 'cabs', label: 'สีกระเช้า', type: 'select', def: 'mix', when: (v) => v.shape === 'ferris', options: [['mix', 'คละสีพาสเทล'], ['pink', 'ชมพู'], ['lilac', 'ม่วงลาเวนเดอร์'], ['mint', 'มิ้นต์'], ['sky', 'ฟ้า'], ['peach', 'พีช']] },
        { key: 'spin', label: 'ความเร็ววงล้อ (วินาทีต่อรอบ)', type: 'range', min: 0, max: 120, step: 5, def: 40, unit: ' วิ', when: (v) => v.shape === 'ferris', hint: '0 = หยุดนิ่ง · ของขวัญขึ้นกระเช้าล่างสุดก่อน เต็มทุกกระเช้าแล้วกองพื้นข้างฐาน' },
        { key: 'full', label: 'เมื่อโหลเต็ม', type: 'select', when: (v) => !['car', 'van', 'ferris'].includes(String(v.shape)), def: 'spill', options: [['spill', 'ล้นออกมากองพื้นข้างโหล (ค่าเริ่มต้น)'], ['fade', 'ชิ้นเก่าสุดค่อย ๆ หายไป'], ['reset', 'ฉลอง แล้วเทโหลเริ่มใหม่']] },
        { key: 'pileMax', label: 'กองพื้นนอกโหลสูงได้ไม่เกิน (% ของจอ)', type: 'range', min: 15, max: 90, step: 5, def: 45, unit: '%', hint: 'เกินแล้วของขวัญราคาถูกสุดค่อย ๆ จางออกก่อน (ของแพงอยู่นานสุด)' },
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
        { key: 'full', label: 'เมื่อโหลเต็ม', type: 'select', when: (v) => !['car', 'van'].includes(String(v.shape)), def: 'spill', options: [['spill', 'ล้นออกมากองพื้นข้างโหล (ค่าเริ่มต้น)'], ['fade', 'ชิ้นเก่าสุดค่อย ๆ หายไป'], ['reset', 'ฉลอง แล้วเทโหลเริ่มใหม่']] },
        { key: 'pileMax', label: 'กองพื้นนอกโหลสูงได้ไม่เกิน (% ของจอ)', type: 'range', min: 15, max: 90, step: 5, def: 45, unit: '%', hint: 'เกินแล้วของขวัญราคาถูกสุดค่อย ๆ จางออกก่อน (ของแพงอยู่นานสุด)' },
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
        { key: 'mode', label: 'วิธีผูกของขวัญ', type: 'select', def: 'mix', options: [
          ['mix', 'ผสม: ของแพงลอยเป็นลูกโป่ง · ของถูกลากท้ายรถ'],
          ['balloon', 'ลอยเป็นช่อลูกโป่งเหนือรถทั้งหมด'],
          ['drag', 'ลากท้ายรถบนถนนทั้งหมด (แบบกระป๋องรถงานแต่ง)'],
        ] },
        { key: 'balloonMin', label: 'ลอยเป็นลูกโป่งตั้งแต่ (เหรียญ)', type: 'number', min: 1, def: 100, when: (v) => (v.mode ?? 'mix') === 'mix', hint: 'ถูกกว่านี้ผูกเชือกลากท้ายรถ กระเด้งตามถนน' },
        ...tint(() => true),
        { key: 'alert', label: 'แสดงชื่อคนส่ง', type: 'toggle', def: true },
        { key: 'minCoins', label: 'รับเฉพาะของขวัญตั้งแต่ (เหรียญ)', type: 'number', min: 0, def: 0 },
      ] },
      { title: 'ขนาดและตำแหน่ง', fields: [
        size(),
        { key: 'giftScale', label: 'ขนาดของขวัญ', type: 'range', min: 0.5, max: 2.5, step: 0.05, def: 1, unit: '×' },
        { key: 'rope', label: 'ความยาวเชือก', type: 'range', min: 40, max: 200, step: 10, def: 90, unit: '', hint: 'เชือกลูกโป่ง: ยิ่งยาว ช่อยิ่งลอยสูงเหนือรถ', when: (v) => (v.mode ?? 'mix') !== 'drag' },
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
          ['saurora', 'ดาวแสงเหนือ', '🌸 พาสเทลน่ารัก', 'sp-aurora'],
          ['scrystal', 'ถ้ำคริสตัล', '🌸 พาสเทลน่ารัก', 'sp-crystal'],
          ['sneon', 'เมืองนีออน', '🎮 สายเท่ เกมมิ่ง', 'sp-neon'],
          ['ssakura', 'สวนซากุระลอยฟ้า', '🌸 พาสเทลน่ารัก', 'sp-sakura'],
          ['scandy', 'ดาวขนมหวาน', '🌸 พาสเทลน่ารัก', 'sp-candy'],
          ['socean', 'ใต้ทะเลปะการัง', '🌸 พาสเทลน่ารัก', 'sp-ocean'],
          ['sice', 'ดาวน้ำแข็งเพนกวิน', '🌸 พาสเทลน่ารัก', 'sp-ice'],
          ['slava', 'ดาวลาวา', '🎮 สายเท่ เกมมิ่ง', 'sp-lava'],
          ['smars', 'ฐานบนดาวอังคาร', '🌸 พาสเทลน่ารัก', 'sp-mars'],
          ['ssun', 'วิหารพระอาทิตย์', '🌸 พาสเทลน่ารัก', 'sp-sun'],
          ['sjelly', 'เนบิวลาแมงกะพรุน', '🌸 พาสเทลน่ารัก', 'sp-jelly'],
          ['sbunny', 'ฐานกระต่ายบนดวงจันทร์', '🌸 พาสเทลน่ารัก', 'sp-bunny'],
          ['scat', 'สถานีแมวนักบินอวกาศ', '🌸 พาสเทลน่ารัก', 'sp-cat'],
          ['sstarship', 'ห้องบังคับยานอวกาศ', '🎮 สายเท่ เกมมิ่ง', 'sp-starship'],
          ['sarcade', 'สถานีอาร์เคดอวกาศ', '🎮 สายเท่ เกมมิ่ง', 'sp-arcade'],
          ['sheart', 'ดาวหัวใจ', '🌸 พาสเทลน่ารัก', 'sp-heart'],
          ['scloud', 'อาณาจักรเมฆ', '🌸 พาสเทลน่ารัก', 'sp-cloud'],
          ['szodiac', 'หอดูดาวจักรราศี', '🌸 พาสเทลน่ารัก', 'sp-zodiac'],
          ['sblackhole', 'แล็บหลุมดำ', '🎮 สายเท่ เกมมิ่ง', 'sp-blackhole'],
          ['sdiamond', 'พระราชวังเพชร', '🌸 พาสเทลน่ารัก', 'sp-diamond'],
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
        { key: 'stemLen', label: 'ความยาวกิ่ง', type: 'range', min: 0.8, max: 2, step: 0.05, def: 1.35, unit: '×', when: (v) => v.skin !== 'tree' },
        { key: 'big', label: 'ของขวัญที่เป็นดอกใหญ่บนยอด ตั้งแต่ (เหรียญ)', type: 'number', min: 1, def: 1000 },
        { key: 'leafTone', label: 'สีใบไม้', type: 'select', def: 'pastel', options: [['pastel', '🌿 พาสเทลอ่อน (ไม่เขียวเข้ม)'], ['mint', '💚 มิ้นต์'], ['pink', '🩷 ชมพู'], ['lavender', '💜 ลาเวนเดอร์'], ['sakura', '🌸 ซากุระ'], ['gold', '💛 ทอง'], ['original', 'สีเดิมของแบบ']] },
        { key: 'skin', label: 'แบบกระถาง', type: 'select', def: 'image', options: [
          ['image', 'กระถางหัวใจมีปีก', '🌸 พาสเทลน่ารัก', 'gd-image'], ['cat', 'กระถางหน้าแมว', '🌸 พาสเทลน่ารัก', 'pot-cat'], ['bunny', 'กระถางกระต่าย', '🌸 พาสเทลน่ารัก', 'pot-bunny'], ['bear', 'กระถางหมี', '🌸 พาสเทลน่ารัก', 'pot-bear'], ['teacup', 'กระถางถ้วยชา', '🌸 พาสเทลน่ารัก', 'pot-teacup'], ['boot', 'กระถางรองเท้าบูท', '🌸 พาสเทลน่ารัก', 'pot-boot'], ['pumpkin', 'กระถางฟักทอง', '🌸 พาสเทลน่ารัก', 'pot-pumpkin'], ['star', 'กระถางดาว', '🌸 พาสเทลน่ารัก', 'pot-star'], ['cart', 'รถเข็นดอกไม้', '🌸 พาสเทลน่ารัก', 'pot-cart'], ['basket', 'ตะกร้าสาน', '🌸 พาสเทลน่ารัก', 'pot-basket'], ['bqpaper', 'ช่อกระดาษชมพู', '💐 ช่อดอกไม้ & แจกัน', 'pot-bqpaper'], ['bqtulle', 'ช่อผ้าโปร่งลาเวนเดอร์', '💐 ช่อดอกไม้ & แจกัน', 'pot-bqtulle'], ['bqkorean', 'ช่อสไตล์เกาหลี', '💐 ช่อดอกไม้ & แจกัน', 'pot-bqkorean'], ['bqheart', 'ช่อทรงหัวใจ', '💐 ช่อดอกไม้ & แจกัน', 'pot-bqheart'], ['bqbasket', 'ตะกร้าหูหิ้ว', '💐 ช่อดอกไม้ & แจกัน', 'pot-bqbasket'], ['vasegold', 'แจกันพอร์ซเลนทอง', '💐 ช่อดอกไม้ & แจกัน', 'pot-vasegold'], ['vasecat', 'แจกันแมวขยิบตา', '💐 ช่อดอกไม้ & แจกัน', 'pot-vasecat'], ['bqcrown', 'ช่อมงกุฎเจ้าหญิง', '💐 ช่อดอกไม้ & แจกัน', 'pot-bqcrown'],
          ['tech', 'กระถางเทคนีออน', '🎮 สายเท่ เกมมิ่ง', 'pot-tech'],
          ['trumpet', 'กระถางแตรทอง', '🎤 สายนักร้อง', 'pot-trumpet'], ['drum', 'กระถางกลอง', '🎤 สายนักร้อง', 'pot-drum'],
          ['vwood', 'แปลงไม้ยกพื้น', '🥕 แปลงผัก', 'pot-vwood'], ['vpink', 'กล่องไม้ชมพูหัวใจ', '🥕 แปลงผัก', 'pot-vpink'], ['vcrate', 'ลังผลไม้สตรอว์เบอร์รี่', '🥕 แปลงผัก', 'pot-vcrate'], ['vbarrow', 'รถเข็นดิน', '🥕 แปลงผัก', 'pot-vbarrow'], ['vbathtub', 'อ่างอาบน้ำวินเทจ', '🥕 แปลงผัก', 'pot-vbathtub'], ['vstone', 'แปลงหินกลม', '🥕 แปลงผัก', 'pot-vstone'], ['vbrick', 'แปลงอิฐแดง', '🥕 แปลงผัก', 'pot-vbrick'], ['vbamboo', 'แปลงไม้ไผ่สาน', '🥕 แปลงผัก', 'pot-vbamboo'], ['vboat', 'เรือพายไม้', '🥕 แปลงผัก', 'pot-vboat'], ['vcart', 'รถเข็นตลาดนัด', '🥕 แปลงผัก', 'pot-vcart'], ['vbasket', 'ตะกร้าปิกนิก', '🥕 แปลงผัก', 'pot-vbasket'], ['vtrough', 'รางสังกะสีผูกโบว์', '🥕 แปลงผัก', 'pot-vtrough'], ['vcarrot', 'กล่องแครอท', '🥕 แปลงผัก', 'pot-vcarrot'], ['vpumpkin', 'กระถางฟักทองยาว', '🥕 แปลงผัก', 'pot-vpumpkin'], ['vwatering', 'บัวรดน้ำยักษ์', '🥕 แปลงผัก', 'pot-vwatering'], ['vcloud', 'กระถางก้อนเมฆ', '🥕 แปลงผัก', 'pot-vcloud'], ['vrainbow', 'กล่องสายรุ้ง', '🥕 แปลงผัก', 'pot-vrainbow'], ['vtractor', 'รถแทรกเตอร์ของเล่น', '🥕 แปลงผัก', 'pot-vtractor'], ['vbarrel', 'ถังไม้ครึ่งซีก', '🥕 แปลงผัก', 'pot-vbarrel'], ['vtire', 'ยางรถทาสีพาสเทล', '🥕 แปลงผัก', 'pot-vtire'],
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
        { key: 'pk', label: 'PK: การ์ด (นวม ⚡สายฟ้า หมอก ฯลฯ) + ผลแพ้ชนะ', type: 'toggle', def: true },
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
        { key: 'style', label: 'รูปแบบ', type: 'select', def: 'bar', options: [['bar', '▬ แถบเปอร์เซ็นต์'], ['heart', '💖 หัวใจแก้วเรียบ ๆ', 'หัวใจแก้ว', '/overlay/hearts/thumb-heart.webp'], ['h-angel', '👼 หัวใจปีกนางฟ้า', 'หัวใจแก้ว', '/overlay/hearts/thumb-angel.webp'], ['h-potion', '🧪 ขวดยาเวทมนตร์', 'หัวใจแก้ว', '/overlay/hearts/thumb-potion.webp'], ['h-bowjar', '🎀 โหลโบว์ชมพู', 'หัวใจแก้ว', '/overlay/hearts/thumb-bowjar.webp'], ['h-piggy', '🐷 กระปุกของเล่น', 'หัวใจแก้ว', '/overlay/hearts/thumb-piggy.webp'], ['h-cyber', '🎮 หัวใจไซเบอร์', 'หัวใจแก้ว', '/overlay/hearts/thumb-cyber.webp'], ['h-melody', '🎤 หัวใจโน้ตดนตรี', 'หัวใจแก้ว', '/overlay/hearts/thumb-melody.webp']] },
        { key: 'type', label: 'นับจาก', type: 'select', def: 'like', options: [['like', '❤️ ไลค์'], ['follow', '➕ ผู้ติดตาม'], ['share', '🔁 แชร์'], ['diamond', '💎 เพชร'], ['gift', '🎁 จำนวนของขวัญ']] },
        { key: 'target', label: 'เป้าหมาย', type: 'number', min: 1, def: 10000 },
        { key: 'next', label: 'ถึงเป้าแล้วเพิ่มเป้าถัดไปอีก', type: 'number', min: 0, def: 0, hint: '0 = ไม่เพิ่ม' },
        { key: 'label', label: 'หัวข้อ', type: 'text', def: '', placeholder: 'เว้นว่าง = ตามชนิด' },
        { key: 'liq', label: 'สีน้ำในหัวใจ', type: 'select', def: 'auto', options: [['auto', '✨ ตามสิ่งที่นับ'], ['pink', '💗 ชมพู'], ['red', '❤️ แดง'], ['purple', '💜 ม่วง'], ['blue', '💙 ฟ้า'], ['mint', '💚 มิ้นต์'], ['gold', '💛 ทอง'], ['peach', '🧡 พีช'], ['rainbow', '🌈 สีรุ้งเปลี่ยนไปเรื่อย ๆ']] },
        { key: 'size', label: 'ขนาดหัวใจ', type: 'range', min: 0.5, max: 2.5, step: 0.1, def: 1, unit: '×', hint: 'ใช้กับแบบหัวใจแก้ว' },
        { key: 'beat', label: 'หัวใจขยับ', type: 'toggle', def: true, when: (v) => v.style !== 'bar', hint: 'ปิด = หัวใจนิ่งสนิท' },
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
        { key: 'width', label: 'ความกว้างของกอง', type: 'range', min: 20, max: 100, step: 5, def: 100, unit: '%', hint: '100 = กองเต็มกรอบ · น้อยลง = กองแคบอยู่กลางจอ' },
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
        { key: 'char', label: 'เลือกตัวแทนวีเจ', type: 'select', def: 'G1', options: [['G1', '🐰 กระต่ายหวาน', '👧 ผู้หญิง', '/overlay/mascot/G1/thumb.webp'], ['G2', '⭐ ไอดอลดาว', '👧 ผู้หญิง', '/overlay/mascot/G2/thumb.webp'], ['G4', '🔮 แม่มดไพ่ทาโร่', '👧 ผู้หญิง', '/overlay/mascot/G4/thumb.webp'], ['G6', '🎮 เกมเมอร์สาว', '👧 ผู้หญิง', '/overlay/mascot/G6/thumb.webp'], ['G8', '🌸 ชุดไทยประยุกต์', '👧 ผู้หญิง', '/overlay/mascot/G8/thumb.webp'], ['G11', '🎀 สาวสตรีท', '👧 ผู้หญิง', '/overlay/mascot/G11/thumb.webp'], ['B4', '👑 เจ้าชาย', '👦 ผู้ชาย', '/overlay/mascot/B4/thumb.webp'], ['B7', '🧙 นักเวทย์', '👦 ผู้ชาย', '/overlay/mascot/B7/thumb.webp'], ['B8', '🎸 ร็อกเกอร์น่ารัก', '👦 ผู้ชาย', '/overlay/mascot/B8/thumb.webp'], ['B10', '🍜 เชฟหนุ่ม', '👦 ผู้ชาย', '/overlay/mascot/B10/thumb.webp'], ['R1', '💗 ไอดอลสาว (คนจริง 3D)', '✨ คนจริง 3D', '/overlay/mascot/R1/thumb.webp'], ['R2', '🎮 สาวเกมเมอร์ (คนจริง 3D)', '✨ คนจริง 3D', '/overlay/mascot/R2/thumb.webp'], ['R3', '🖤 สาวสตรีท (คนจริง 3D)', '✨ คนจริง 3D', '/overlay/mascot/R3/thumb.webp'], ['R4', '💼 สาวออฟฟิศ (คนจริง 3D)', '✨ คนจริง 3D', '/overlay/mascot/R4/thumb.webp'], ['R6', '🏖️ สาวซัมเมอร์ (คนจริง 3D)', '✨ คนจริง 3D', '/overlay/mascot/R6/thumb.webp'], ['R8', '🏃‍♀️ สาวสปอร์ต (คนจริง 3D)', '✨ คนจริง 3D', '/overlay/mascot/R8/thumb.webp'], ['R10', '👘 สาวยูกาตะ (คนจริง 3D)', '✨ คนจริง 3D', '/overlay/mascot/R10/thumb.webp'], ['R12', '🎤 นักร้องสาว (คนจริง 3D)', '✨ คนจริง 3D', '/overlay/mascot/R12/thumb.webp'], ['R14', '📚 สาวมหาลัย (คนจริง 3D)', '✨ คนจริง 3D', '/overlay/mascot/R14/thumb.webp'], ['R5', '🖤 สาวโกธิคหวาน (คนจริง 3D)', '✨ คนจริง 3D', '/overlay/mascot/R5/thumb.webp'], ['R7', '🍬 สาวพาสเทล (คนจริง 3D)', '✨ คนจริง 3D', '/overlay/mascot/R7/thumb.webp'], ['R16', '🎧 หนุ่มเกมเมอร์ (คนจริง 3D)', '✨ คนจริง 3D', '/overlay/mascot/R16/thumb.webp'], ['R18', '👔 หนุ่มสุภาพ (คนจริง 3D)', '✨ คนจริง 3D', '/overlay/mascot/R18/thumb.webp'], ['R9', '🧸 สาวหมีน้อย (คนจริง 3D)', '✨ คนจริง 3D', '/overlay/mascot/R9/thumb.webp'], ['R20', '👑 เจ้าหญิง (คนจริง 3D)', '✨ คนจริง 3D', '/overlay/mascot/R20/thumb.webp'], ['R11', '🌺 สาวชุดไทย (คนจริง 3D)', '✨ คนจริง 3D', '/overlay/mascot/R11/thumb.webp'], ['R13', '🐱 สาวหูแมว (คนจริง 3D)', '✨ คนจริง 3D', '/overlay/mascot/R13/thumb.webp'], ['A2', '🐱 แมวสามสี', '🐾 สัตว์น่ารัก 3D', '/overlay/mascot/A2/thumb.webp'], ['R15', '🌟 หนุ่มไอดอล (คนจริง 3D)', '✨ คนจริง 3D', '/overlay/mascot/R15/thumb.webp'], ['A3', '🐕 ชิบะ', '🐾 สัตว์น่ารัก 3D', '/overlay/mascot/A3/thumb.webp'], ['R17', '🧢 หนุ่มสตรีท (คนจริง 3D)', '✨ คนจริง 3D', '/overlay/mascot/R17/thumb.webp']] },
        { key: 'tint', label: 'สีชุดและผม', type: 'select', def: '0', options: [['0', '🎨 สีเดิม'], ['300', '💜 ม่วง'], ['220', '💙 ฟ้า'], ['160', '💚 มิ้นต์'], ['40', '🧡 พีช/ส้ม'], ['70', '💛 ทอง'], ['120', '🍀 เขียว'], ['330', '🩷 ชมพูบานเย็น']], hint: 'เปลี่ยนเฉพาะชุด ผม ของประดับ — สีผิวคงเดิม' },
        { key: 'sparkle', label: 'ประกายระยิบระยับรอบตัว', type: 'select', def: 'soft', options: [['soft', '✨ เบา ๆ (ค่าเริ่มต้น)'], ['lots', '🌟 จัดเต็ม'], ['off', 'ปิด']] },
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
        { key: 'showTitle', label: 'แสดงหัวข้อ', type: 'toggle', def: false },
        { key: 'title', label: 'หัวข้อ', type: 'text', def: '🎁 ส่งของขวัญเพื่อ…', when: (v) => v.showTitle !== false },
        { key: 'items', label: 'รายการที่แสดง', type: 'menuItems', def: '', hint: 'ดึงจากกฎ Actions อัตโนมัติ · ติ๊กออก = ไม่แสดง · กดรูปเพื่อเลือกรูปของขวัญ · แก้คำในเมนูได้' },
        { key: 'textStyle', label: 'สีตัวหนังสือ', type: 'select', def: 'template', options: [['template', '🎨 ตามเทมเพลตหน้าตา'], ['wb', '⬜ ขาวขอบดำ (อ่านง่ายทุกพื้น)'], ['bw', '⬛ ดำขอบขาว'], ['custom', '🖌️ เลือกสีเอง']] },
        { key: 'textColor', label: 'สีตัวหนังสือ', type: 'color', def: '#ffffff', when: (v) => v.textStyle === 'custom' },
        { key: 'strokeColor', label: 'สีขอบตัวหนังสือ', type: 'color', def: '#000000', when: (v) => v.textStyle === 'custom' },
        { key: 'item', label: 'หน้าตาแต่ละข้อ', type: 'select', def: 'tile', options: [['tile', '🎁 รูปของขวัญ + คำอธิบายใต้รูป (ไม่มีพื้นหลัง)'], ['row', '▭ แถบ: รูปซ้าย + "ส่ง … เหรียญ"']] },
        { key: 'layout', label: 'รูปแบบ', type: 'select', def: 'list', options: [['list', 'รายการ (โชว์หลายข้อ)'], ['rotate', 'หมุนเปลี่ยนรายการ (ประหยัดที่)']] },
        { key: 'per', label: 'หมุนทีละกี่รายการ', type: 'number', min: 1, max: 10, def: 1, when: (v) => v.layout === 'rotate' },
        { key: 'dir', label: 'แนวการเรียง', type: 'select', def: 'vertical', options: [['vertical', '↕️ แนวตั้ง (เรียงลงมา)'], ['horizontal', '↔️ แนวนอน (เรียงเป็นแถว)']], when: (v) => v.layout !== 'rotate' },
        { key: 'move', label: 'ของขวัญขยับ', type: 'select', def: 'bounce', options: [['bounce', '🦘 เด้งดึ๋ง'], ['bob', '🎈 ลอยเบา ๆ'], ['wiggle', '👋 ส่ายไปมา'], ['pulse', '💓 เต้นตุบ ๆ'], ['spin', '🔄 หมุน'], ['none', '⏸ นิ่ง']] },
        { key: 'ring', label: 'วงแหวนวิ่งรอบของขวัญ', type: 'select', def: '01', options: [['off', '⭕ ปิด — ไม่มีวงแหวน'], ['mix', '🎲 คละแบบ (แต่ละของขวัญไม่ซ้ำกัน)'], ['21', '💛 เส้นทองประกายดาว', '〰️ เส้นบาง มินิมอล', '/overlay/rings/ring-21.webp'], ['22', '💗 เส้นชมพูหัวใจ', '〰️ เส้นบาง มินิมอล', '/overlay/rings/ring-22.webp'], ['23', '❄️ เส้นฟ้าเกล็ดหิมะ', '〰️ เส้นบาง มินิมอล', '/overlay/rings/ring-23.webp'], ['24', '💜 เส้นม่วงนีออน', '〰️ เส้นบาง มินิมอล', '/overlay/rings/ring-24.webp'], ['25', '🌈 เส้นสีรุ้งพาสเทล', '〰️ เส้นบาง มินิมอล', '/overlay/rings/ring-25.webp'], ['26', '🤍 สร้อยไข่มุก', '〰️ เส้นบาง มินิมอล', '/overlay/rings/ring-26.webp'], ['27', '✨ ลูกปัดทอง', '〰️ เส้นบาง มินิมอล', '/overlay/rings/ring-27.webp'], ['28', '🌸 เส้นคู่โรสโกลด์', '〰️ เส้นบาง มินิมอล', '/overlay/rings/ring-28.webp'], ['29', '💎 เส้นเงินเพชร', '〰️ เส้นบาง มินิมอล', '/overlay/rings/ring-29.webp'], ['30', '⚪ เส้นเงินมินิมอล', '〰️ เส้นบาง มินิมอล', '/overlay/rings/ring-30.webp'], ['31', '💖 กรอบหัวใจคริสตัล', '🖼️ กรอบรูปทรงต่าง ๆ', '/overlay/rings/ring-31.webp'], ['32', '⭐ กรอบดาวทอง', '🖼️ กรอบรูปทรงต่าง ๆ', '/overlay/rings/ring-32.webp'], ['33', '🎮 หกเหลี่ยมนีออน', '🖼️ กรอบรูปทรงต่าง ๆ', '/overlay/rings/ring-33.webp'], ['34', '🌹 พวงกุหลาบพาสเทล', '🖼️ กรอบรูปทรงต่าง ๆ', '/overlay/rings/ring-34.webp'], ['35', '🐱 หูแมวกับอุ้งเท้า', '🖼️ กรอบรูปทรงต่าง ๆ', '/overlay/rings/ring-35.webp'], ['36', '👑 มงกุฎทองทับทิม', '🖼️ กรอบรูปทรงต่าง ๆ', '/overlay/rings/ring-36.webp'], ['37', '🎀 ริบบิ้นผูกโบว์', '🖼️ กรอบรูปทรงต่าง ๆ', '/overlay/rings/ring-37.webp'], ['38', '🪐 วงโคจรดาวเคราะห์', '🖼️ กรอบรูปทรงต่าง ๆ', '/overlay/rings/ring-38.webp'], ['39', '🤍 ลูกไม้ขาว', '🖼️ กรอบรูปทรงต่าง ๆ', '/overlay/rings/ring-39.webp'], ['40', '🎵 โน้ตเพลงทอง', '🖼️ กรอบรูปทรงต่าง ๆ', '/overlay/rings/ring-40.webp'], ['01', '💛 หัวใจทองคำ', '', '/overlay/rings/ring-01.webp'], ['02', '🍬 ลูกอมพาสเทลสีรุ้ง', '', '/overlay/rings/ring-02.webp'], ['03', '💠 คริสตัลเงินฟ้า', '', '/overlay/rings/ring-03.webp'], ['04', '🌸 พวงมาลัยซากุระ', '', '/overlay/rings/ring-04.webp'], ['05', '🌃 ไซเบอร์นีออน ชมพู-ฟ้า', '', '/overlay/rings/ring-05.webp'], ['06', '🔥 เปลวไฟ', '', '/overlay/rings/ring-06.webp'], ['07', '❄️ เกล็ดหิมะน้ำแข็ง', '', '/overlay/rings/ring-07.webp'], ['08', '🌌 กาแล็กซีม่วง', '', '/overlay/rings/ring-08.webp'], ['09', '👑 มงกุฎทอง & ทับทิม', '', '/overlay/rings/ring-09.webp'], ['10', '🐚 ไข่มุก & เปลือกหอย', '', '/overlay/rings/ring-10.webp'], ['11', '🍩 โดนัทโรยสี', '', '/overlay/rings/ring-11.webp'], ['12', '⚡ สายฟ้าไฟฟ้า', '', '/overlay/rings/ring-12.webp'], ['13', '🌹 กุหลาบแดง & ริบบิ้น', '', '/overlay/rings/ring-13.webp'], ['14', '🎵 โน้ตเพลงทองคำ', '', '/overlay/rings/ring-14.webp'], ['15', '🦋 ผีเสื้อพาสเทล', '', '/overlay/rings/ring-15.webp'], ['16', '💎 เพชรแพลทินัม', '', '/overlay/rings/ring-16.webp'], ['17', '🪷 ลายกนกทองไทย', '', '/overlay/rings/ring-17.webp'], ['18', '🍓 สตรอว์เบอร์รี & เชอร์รี', '', '/overlay/rings/ring-18.webp'], ['19', '🌈 นีออนสีรุ้ง', '', '/overlay/rings/ring-19.webp'], ['20', '🫧 ฟองสบู่', '', '/overlay/rings/ring-20.webp']] },
        { key: 'ringSpeed', label: 'ความเร็ววงแหวน (วินาทีต่อรอบ)', type: 'range', min: 2, max: 20, step: 1, def: 6, unit: ' วิ', hint: 'น้อย = หมุนเร็ว', when: (v) => v.ring !== 'off' },
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
        { key: 'frames', label: 'แท่น Top 3 (กรอบขยับได้)', type: 'select', def: 'a', options: [['a', '👑 พระราชวัง', '', '/overlay/frames/r1.webp'], ['b', '👑 พระราชวัง แบบ 2', '', '/overlay/frames/r1b.webp'], ['gaming', '🎮 เกมมิ่ง นีออน', '', '/overlay/frames/g1.webp'], ['singer', '🎤 นักร้อง เวที', '', '/overlay/frames/s1.webp'], ['toy', '🧸 Toy Cute', '', '/overlay/frames/t1.webp'], ['sakura', '🌸 ซากุระ', '', '/overlay/frames/sakura1.webp'], ['cyber', '🌃 ไซเบอร์พังก์ นีออน', '', '/overlay/frames/cyber1.webp'], ['ocean', '🐚 นางเงือก ทะเล', '', '/overlay/frames/ocean1.webp'], ['dragon', '🐉 มังกรทอง', '', '/overlay/frames/dragon1.webp'], ['candy', '🍭 ขนมหวาน', '', '/overlay/frames/candy1.webp'], ['phoenix', '🔥 ฟีนิกซ์ ไฟ', '', '/overlay/frames/phoenix1.webp'], ['angel', '👼 นางฟ้า', '', '/overlay/frames/angel1.webp'], ['ice', '❄️ ราชาน้ำแข็ง', '', '/overlay/frames/ice1.webp'], ['thunder', '⚡ สายฟ้า (โล่)', '', '/overlay/frames/thunder1.webp'], ['luxury', '💎 ดำทอง หรูหรา', '', '/overlay/frames/luxury1.webp'], ['samurai', '⚔️ ซามูไร', '', '/overlay/frames/samurai1.webp'], ['gamer', '🎮 เกมเมอร์ RGB', '', '/overlay/frames/gamer1.webp'], ['bunny', '🐰 กระต่ายสตรอว์เบอร์รี', '', '/overlay/frames/bunny1.webp'], ['bunnyb', '🐰 กระต่าย แบบ 2', '', '/overlay/frames/bunnyb1.webp'], ['racing', '🏁 รถแข่ง', '', '/overlay/frames/racing1.webp'], ['demon', '😈 ปีศาจน่ารัก', '', '/overlay/frames/demon1.webp'], ['galaxy', '🌙 กาแล็กซี', '', '/overlay/frames/galaxy1.webp'], ['mecha', '🤖 หุ่นยนต์ เมคา', '', '/overlay/frames/mecha1.webp'], ['dj', '🎧 ดีเจ', '', '/overlay/frames/dj1.webp'], ['thai', '🪷 ไทยประเพณี', '', '/overlay/frames/thai1.webp'], ['tropic', '🌺 ทรอปิคอล', '', '/overlay/frames/tropic1.webp'], ['minimal', '◯ มินิมอล', '', '/overlay/frames/minimal.webp'], ['off', 'ปิด — รายการธรรมดา', '', '/overlay/frames/list.webp'], ...MVP_RANK_OPTS] },
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
        { key: 'frames', label: 'แท่น Top 3 (กรอบขยับได้)', type: 'select', def: 'a', options: [['a', '👑 พระราชวัง', '', '/overlay/frames/r1.webp'], ['b', '👑 พระราชวัง แบบ 2', '', '/overlay/frames/r1b.webp'], ['gaming', '🎮 เกมมิ่ง นีออน', '', '/overlay/frames/g1.webp'], ['singer', '🎤 นักร้อง เวที', '', '/overlay/frames/s1.webp'], ['toy', '🧸 Toy Cute', '', '/overlay/frames/t1.webp'], ['sakura', '🌸 ซากุระ', '', '/overlay/frames/sakura1.webp'], ['cyber', '🌃 ไซเบอร์พังก์ นีออน', '', '/overlay/frames/cyber1.webp'], ['ocean', '🐚 นางเงือก ทะเล', '', '/overlay/frames/ocean1.webp'], ['dragon', '🐉 มังกรทอง', '', '/overlay/frames/dragon1.webp'], ['candy', '🍭 ขนมหวาน', '', '/overlay/frames/candy1.webp'], ['phoenix', '🔥 ฟีนิกซ์ ไฟ', '', '/overlay/frames/phoenix1.webp'], ['angel', '👼 นางฟ้า', '', '/overlay/frames/angel1.webp'], ['ice', '❄️ ราชาน้ำแข็ง', '', '/overlay/frames/ice1.webp'], ['thunder', '⚡ สายฟ้า (โล่)', '', '/overlay/frames/thunder1.webp'], ['luxury', '💎 ดำทอง หรูหรา', '', '/overlay/frames/luxury1.webp'], ['samurai', '⚔️ ซามูไร', '', '/overlay/frames/samurai1.webp'], ['gamer', '🎮 เกมเมอร์ RGB', '', '/overlay/frames/gamer1.webp'], ['bunny', '🐰 กระต่ายสตรอว์เบอร์รี', '', '/overlay/frames/bunny1.webp'], ['bunnyb', '🐰 กระต่าย แบบ 2', '', '/overlay/frames/bunnyb1.webp'], ['racing', '🏁 รถแข่ง', '', '/overlay/frames/racing1.webp'], ['demon', '😈 ปีศาจน่ารัก', '', '/overlay/frames/demon1.webp'], ['galaxy', '🌙 กาแล็กซี', '', '/overlay/frames/galaxy1.webp'], ['mecha', '🤖 หุ่นยนต์ เมคา', '', '/overlay/frames/mecha1.webp'], ['dj', '🎧 ดีเจ', '', '/overlay/frames/dj1.webp'], ['thai', '🪷 ไทยประเพณี', '', '/overlay/frames/thai1.webp'], ['tropic', '🌺 ทรอปิคอล', '', '/overlay/frames/tropic1.webp'], ['minimal', '◯ มินิมอล', '', '/overlay/frames/minimal.webp'], ['off', 'ปิด — รายการธรรมดา', '', '/overlay/frames/list.webp'], ...MVP_RANK_OPTS] },
        { key: 'list', label: 'แสดงรายการอันดับถัดไปใต้แท่น', type: 'toggle', def: true, hint: 'ปิด = โชว์แค่ 3 อันดับแรกบนแท่น', when: (v) => v.frames !== 'off' },
        bg(),
      ] },
    ],
  },
  pkmvp: {
    sections: [
      { title: 'MVP ของ PK', fields: [
        { key: 'title', label: 'หัวข้อ', type: 'text', def: '👑 MVP ของ PK' },
        { key: 'frame', label: 'กรอบ MVP', type: 'select', def: '01', options: [...MVP_FRAMES.map(([id, l]): [string, string, string, string] => [id, l, '🖼️ กรอบรูปภาพ', mvpThumb(id)]), ['css', '🎨 แบบวาดด้วยโค้ด (เดิม)', '🎨 แบบเดิม', '/overlay/thumbs/pkmvp.webp']] },
        { key: 'theme', label: 'หน้าตา', type: 'select', def: 'candy', when: (v) => v.frame === 'css', options: [['candy', '🍬 พาสเทลหวาน'], ['glass', '🔮 กระจกโปร่ง'], ['white', '🤍 ขาวมินิมอล'], ['gold', '👑 ดำทอง']] },
        { key: 'pos', label: 'มุมจอ', type: 'select', def: 'tr', options: [['tr', 'บนขวา'], ['tl', 'บนซ้าย'], ['tc', 'บนกลาง'], ['br', 'ล่างขวา'], ['bl', 'ล่างซ้าย']] },
        { key: 'bar', label: 'แถบคะแนนเรา vs คู่แข่ง', type: 'toggle', def: true },
        { key: 'them', label: 'โชว์ MVP ฝั่งคู่แข่ง', type: 'toggle', def: true },
        { key: 'idle', label: 'ตอนไม่มี PK', type: 'select', def: 'wait', options: [['wait', 'โชว์ “รอ PK…”'], ['hide', 'ซ่อนวิดเจ็ต']] },
        { key: 'hold', label: 'จบ PK แล้วโชว์ MVP ค้างไว้', type: 'range', min: 5, max: 120, step: 5, def: 20, unit: ' วิ' },
        size(), { ...bg(45), when: (v) => v.frame === 'css' },
      ] },
    ],
  },
  timer: {
    resettable: 'เริ่มนับเวลาใหม่',
    sections: [
      // กรอบรูปนาฬิกา 10 ธีม (overlay/public/timer/frame-XX.webp · ตำแหน่งป้าย/จอใน timer/frames.json) — ว่าง = แบบเดิม
      { title: 'เทมเพลต', fields: [
        { key: 'frame', label: 'เทมเพลต', type: 'select', def: '', options: [
          ['', '🎨 แบบเดิม', '', '/overlay/timer/thumb-classic.webp'],
          ...MVP_FRAMES.map(([id, l]): [string, string, string, string] => [id, l, '', `/overlay/timer/thumb-${id}.webp`]),
        ] },
      ] },
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
      { title: 'ของขวัญที่เลือกเอง', fields: [
        { key: 'giftAdd', label: '🎁 ของขวัญเพิ่มเวลา', type: 'giftlist', tone: 'add', def: '', hint: 'วินาทีต่อ 1 ชิ้น (คอมโบคูณตามจำนวน) · ใช้แทนค่าต่อเหรียญ ไม่นับซ้ำ' },
        { key: 'giftSub', label: '⏬ ของขวัญลดเวลา', type: 'giftlist', tone: 'sub', def: '', hint: 'วินาทีต่อ 1 ชิ้น (คอมโบคูณตามจำนวน) · ลดได้ไม่ต่ำกว่า 0' },
      ] },
      { title: 'การแสดงผล', fields: [
        { key: 'label', label: 'ข้อความด้านบน', type: 'text', def: '⏳ ส่งของขวัญเพื่อเพิ่มเวลา' },
        { key: 'done', label: 'ข้อความเมื่อหมดเวลา', type: 'text', def: 'หมดเวลา! 🎉' },
        { key: 'fontSize', label: 'ขนาดตัวเลข', type: 'range', min: 40, max: 160, step: 2, def: 90, hint: 'เทมเพลตกรอบรูป: ปรับขนาดทั้งกรอบ' },
        { ...bg(), when: (v) => !v.frame },
        ...pos(),
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
