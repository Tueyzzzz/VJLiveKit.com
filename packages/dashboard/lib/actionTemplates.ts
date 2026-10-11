import type { Rule } from './api';

/** เทมเพลตยอดนิยม — กดครั้งเดียวสร้างกฎได้เลย (ไม่ต้องหาไฟล์เสียง/รูปเอง)
 *  id = ชื่อรูปตัวอย่างจริง /tpl/<id>.webp (อัดจากวิดเจ็ต FX ด้วย scripts/capture-templates.mjs) · group = หมวดในแถบเลือก */
export type TemplateGroup = 'tarot' | 'fx' | 'thanks' | 'mascot' | 'fun';
export interface Template { id?: string; group?: TemplateGroup; icon: string; title: string; desc: string; rule: { name: string; trigger: Rule['trigger']; action: Rule['action'] } }

/** หมวดเทมเพลต (เรียงตามแถบ) — แบบเดียวกับแถบสลับแบบสะสมของขวัญ */
export const TEMPLATE_GROUPS: [TemplateGroup, string][] = [
  ['fx', '🦋 เอฟเฟกต์เต็มจอ'], ['tarot', '🔮 ดูดวง & ไพ่'], ['thanks', '💖 ขอบคุณ & ป้ายไฟ'], ['mascot', '🧸 มาสคอต'], ['fun', '🥊 สนุก ๆ'],
];

/** เอฟเฟกต์เต็มจอ (action.type = effect) — ต้องตรงกับ PFX ใน overlay/public/fx.html + zod ฝั่งเซิร์ฟเวอร์ · [ค่า, ชื่อ, สีเริ่มต้น] */
export type EffectName = NonNullable<Rule['action']['effect']>;
export const EFFECTS: [EffectName, string, NonNullable<Rule['action']['tint']>][] = [
  ['butterflies', '🦋 ผีเสื้อเทพนิยาย', 'pink'], ['sakura', '🌸 ซากุระร่วง', 'pink'], ['hearts', '💗 หัวใจลอยฟุ้ง', 'pink'], ['coins', '🪙 ฝนเหรียญทอง', 'gold'],
  ['stars', '⭐ ฝนดาววิบวับ', 'gold'], ['snow', '❄️ หิมะโปรย', 'blue'], ['bubbles', '🫧 ฟองสบู่ลอย', 'blue'], ['balloons', '🎈 ลูกโป่งลอย', 'rainbow'],
  ['roses', '🌹 กลีบกุหลาบหมุนวน', 'pink'], ['fireflies', '✨ หิ่งห้อยเรืองแสง', 'gold'], ['confetti', '🎊 คอนเฟตติฉลอง', 'rainbow'],
  ['vcake', '🎬 เค้กปาหน้า (วิดีโอ)', 'pink'], ['vcat', '🎬 แมวร่มชูชีพ (วิดีโอ)', 'pink'], ['vchicks', '🎬 ลูกเจี๊ยบวิ่งป่วน (วิดีโอ)', 'pink'],
];
export const effectLabel = (e?: string) => EFFECTS.find(([k]) => k === (e ?? 'butterflies'))?.[1] ?? EFFECTS[0][1];

/** เทมเพลต PK — โชว์ในเมนู ⚔️ PK Battle */
export const PK_TEMPLATES: Template[] = [
  { icon: '🥈', title: 'เก้าอี้ที่ 2 X2 → เรียกอันดับ 2', desc: 'อันดับ 2 ส่งของขวัญได้คะแนน x2 — ป้ายไฟเรียกให้รีบส่ง',
    rule: { name: 'เก้าอี้ที่ 2 X2', trigger: { event: 'pk', pk: 'top2', pkSide: 'us' }, action: { type: 'sign', signStyle: 'neon', signMode: 'pulse', signPos: 'top', color: '#c9d4e8', text: '🥈 เก้าอี้ที่ 2 X2! อันดับ 2 ส่งตอนนี้คะแนนคูณ 2 รีบเลย 💨', durationMs: 6000 } } },
  { icon: '🥉', title: 'เก้าอี้ที่ 3 X2 → เรียกอันดับ 3', desc: 'อันดับ 3 ส่งของขวัญได้คะแนน x2 — ป้ายไฟเรียกให้รีบส่ง',
    rule: { name: 'เก้าอี้ที่ 3 X2', trigger: { event: 'pk', pk: 'top3', pkSide: 'us' }, action: { type: 'sign', signStyle: 'neon', signMode: 'pulse', signPos: 'top', color: '#e8b98a', text: '🥉 เก้าอี้ที่ 3 X2! อันดับ 3 ส่งตอนนี้คะแนนคูณ 2 รีบเลย 💨', durationMs: 6000 } } },
  { icon: '🔔', title: 'ประกาศเริ่ม PK', desc: 'ป้ายไฟกลางจอ ชวนผู้ชมช่วยกันส่งของขวัญ',
    rule: { name: 'PK เริ่มแล้ว', trigger: { event: 'pk', pk: 'start' }, action: { type: 'sign', signStyle: 'neon', signMode: 'pulse', signPos: 'center', color: '#ff4fa3', text: '⚔️ PK เริ่มแล้ว! ช่วยกันส่งของขวัญนะ 💖', durationMs: 5000 } } },
  { icon: '🏆', title: 'ชนะ PK → ฉลอง', desc: 'ผีเสื้อสีทองเต็มจอ + ข้อความขอบคุณทุกคน',
    rule: { name: 'ชนะ PK ฉลอง', trigger: { event: 'pk', pk: 'win' }, action: { type: 'effect', effect: 'butterflies', tint: 'gold', count: 20, text: '🏆 ชนะแล้ว! ขอบคุณทุกคนที่ช่วยกันนะ 💖', durationMs: 8000 } } },
  { icon: '💪', title: 'แพ้ PK → ขอบคุณ', desc: 'ข้อความให้กำลังใจ ขอบคุณที่ช่วยกันสู้',
    rule: { name: 'แพ้ PK ขอบคุณ', trigger: { event: 'pk', pk: 'lose' }, action: { type: 'text', text: '💪 สู้เต็มที่แล้ว ขอบคุณทุกคนมาก ๆ นะ 💖', durationMs: 6000 } } },
  { icon: '🥊', title: 'มีคนใช้นวมให้เรา', desc: 'นวมพุ่งเต็มจอ + ขอบคุณคนกด',
    rule: { name: 'นวมช่วยเรา', trigger: { event: 'pk', pk: 'glove', pkSide: 'us' }, action: { type: 'glove', count: 2, text: '🥊 {user} ใช้นวมช่วยเรา! ขอบคุณน้า', durationMs: 4000 } } },
  { icon: '⚡', title: 'สายฟ้าให้เรา', desc: 'เสียงเลเวลอัป + ป้ายไฟสีทอง',
    rule: { name: 'สายฟ้าช่วยเรา', trigger: { event: 'pk', pk: 'critical', pkSide: 'us' }, action: { type: 'sign', signStyle: 'led', signMode: 'blink', signPos: 'top', color: '#ffcf5c', text: '⚡ {user} ปล่อยสายฟ้า x2! ขอบคุณ ⚡', durationMs: 5000 } } },
  { icon: '🌫️', title: 'โดนหมอก (คู่แข่งใช้)', desc: 'เตือนผู้ชมให้ช่วยกันส่งต่อ',
    rule: { name: 'โดนหมอก', trigger: { event: 'pk', pk: 'smoke', pkSide: 'them' }, action: { type: 'text', text: '🌫️ โดนหมอกแล้ว! ส่งต่อเลยทุกคน อย่าหยุดนะ', durationMs: 5000 } } },
  { icon: '⏱️', title: 'ต่อเวลา', desc: 'แจ้งว่าได้เวลาเพิ่ม',
    rule: { name: 'ต่อเวลา PK', trigger: { event: 'pk', pk: 'extra' }, action: { type: 'text', text: '⏱️ ต่อเวลาแล้ว! ยังมีลุ้น ช่วยกันอีกนิด', durationMs: 4000 } } },
  { icon: '🃏', title: 'ขอบคุณทุกการ์ด', desc: 'ใครใช้การ์ดอะไรช่วยเรา ขึ้นข้อความขอบคุณ',
    rule: { name: 'ขอบคุณการ์ด PK', trigger: { event: 'pk', pk: 'anycard', pkSide: 'us' }, action: { type: 'text', text: '🃏 ขอบคุณ {user} ที่ใช้การ์ดช่วยเรา 💖', durationMs: 4000 } } },
];

export const TEMPLATES: Template[] = [
  // 🦋 เอฟเฟกต์เต็มจอ
  { id: 'fx-butterflies', group: 'fx', icon: '🦋', title: 'ได้ Rose → ผีเสื้อเทพนิยาย', desc: 'ผีเสื้อปีกวาวบินข้ามจอ โปรยผงประกาย',
    rule: { name: 'ผีเสื้อเทพนิยาย', trigger: { event: 'gift', giftName: 'Rose' }, action: { type: 'effect', effect: 'butterflies', count: 12, durationMs: 8000 } } },
  { id: 'fx-sakura', group: 'fx', icon: '🌸', title: 'ได้ Perfume → ซากุระร่วง', desc: 'กลีบซากุระชมพูปลิวตามลมทั่วจอ',
    rule: { name: 'ซากุระร่วง', trigger: { event: 'gift', giftName: 'Perfume' }, action: { type: 'effect', effect: 'sakura', tint: 'pink', count: 14, durationMs: 9000 } } },
  { id: 'fx-hearts', group: 'fx', icon: '💗', title: 'ได้ Heart Me → หัวใจลอยฟุ้ง', desc: 'หัวใจพาสเทลลอยขึ้นทั้งจอ เต้นตุบ ๆ มีประกาย',
    rule: { name: 'หัวใจลอยฟุ้ง', trigger: { event: 'gift', giftName: 'Heart Me' }, action: { type: 'effect', effect: 'hearts', tint: 'pink', count: 12, durationMs: 7000 } } },
  { id: 'fx-coins', group: 'fx', icon: '🪙', title: 'ได้ Money Gun → ฝนเหรียญทอง', desc: 'เหรียญทองหมุนวิบวับร่วงทั้งจอ รวยรวยรวย',
    rule: { name: 'ฝนเหรียญทอง', trigger: { event: 'gift', giftName: 'Money Gun' }, action: { type: 'effect', effect: 'coins', tint: 'gold', count: 16, durationMs: 7000 } } },
  { id: 'fx-stars', group: 'fx', icon: '⭐', title: 'ได้ Twinkling Star → ฝนดาว', desc: 'ดาวตกมีหางประกาย + ดาวกะพริบทั่วจอ',
    rule: { name: 'ฝนดาววิบวับ', trigger: { event: 'gift', giftName: 'Twinkling Star' }, action: { type: 'effect', effect: 'stars', tint: 'gold', count: 14, durationMs: 8000 } } },
  { id: 'fx-snow', group: 'fx', icon: '❄️', title: 'ได้ Ice Cream Cone → หิมะโปรย', desc: 'เกล็ดหิมะ 6 แฉกโปรยเบา ๆ ฟินแบบเมืองหนาว',
    rule: { name: 'หิมะโปรย', trigger: { event: 'gift', giftName: 'Ice Cream Cone' }, action: { type: 'effect', effect: 'snow', tint: 'blue', count: 14, durationMs: 9000 } } },
  { id: 'fx-bubbles', group: 'fx', icon: '🫧', title: 'มีคนแชร์ → ฟองสบู่ลอย', desc: 'ฟองสบู่สีรุ้งลอยขึ้นแล้วแตกป๊อบ',
    rule: { name: 'ฟองสบู่ขอบคุณที่แชร์', trigger: { event: 'share' }, action: { type: 'effect', effect: 'bubbles', tint: 'blue', count: 12, durationMs: 7000 } } },
  { id: 'fx-balloons', group: 'fx', icon: '🎈', title: 'มีคนติดตาม → ลูกโป่งลอย', desc: 'ลูกโป่งหลากสีลอยขึ้นต้อนรับคนใหม่',
    rule: { name: 'ลูกโป่งต้อนรับผู้ติดตาม', trigger: { event: 'follow' }, action: { type: 'effect', effect: 'balloons', tint: 'rainbow', count: 12, durationMs: 7000 } } },
  { id: 'fx-roses', group: 'fx', icon: '🌹', title: 'ได้ Rose Hand → กลีบกุหลาบหมุนวน', desc: 'กลีบกุหลาบบานออกจากกลางจอเป็นเกลียว โรแมนติก',
    rule: { name: 'กลีบกุหลาบหมุนวน', trigger: { event: 'gift', giftName: 'Rose Hand' }, action: { type: 'effect', effect: 'roses', tint: 'pink', count: 14, durationMs: 8000 } } },
  { id: 'fx-fireflies', group: 'fx', icon: '✨', title: 'พิมพ์ “ฝันดี” → หิ่งห้อย', desc: 'หิ่งห้อยเรืองแสงล่องลอยกะพริบนุ่ม ๆ',
    rule: { name: 'หิ่งห้อยฝันดี', trigger: { event: 'chat', keyword: 'ฝันดี' }, action: { type: 'effect', effect: 'fireflies', tint: 'gold', count: 16, durationMs: 9000 } } },
  { id: 'fx-confetti', group: 'fx', icon: '🎊', title: 'ได้ Confetti → คอนเฟตติฉลอง', desc: 'ยิงกระดาษสีจากมุมจอแล้วโปรยพลิ้วลงมา',
    rule: { name: 'คอนเฟตติฉลอง', trigger: { event: 'gift', giftName: 'Confetti' }, action: { type: 'effect', effect: 'confetti', tint: 'rainbow', count: 14, durationMs: 7000 } } },
  // 🔮 ดูดวง & ไพ่ (แอดมินเท่านั้น)
  { id: 'tarot-rose', group: 'tarot', icon: '🔮', title: 'ได้ Rose → เปิดไพ่ 1 ใบ', desc: 'ทุกกุหลาบ = คำทำนาย 1 ใบให้คนส่ง',
    rule: { name: 'Rose เปิดไพ่ทาโร่', trigger: { event: 'gift', giftName: 'Rose' }, action: { type: 'tarot', cards: 1, text: '🌹 คำทำนายของ {user}', durationMs: 8000 } } },
  { id: 'tarot-3', group: 'tarot', icon: '🃏', title: 'กิฟต์ 99 เพชรขึ้นไป → ไพ่ 3 ใบ', desc: 'อดีต · ปัจจุบัน · อนาคต',
    rule: { name: 'ไพ่ 3 ใบ (99 เพชร+)', trigger: { event: 'gift', minDiamonds: 99 }, action: { type: 'tarot', cards: 3, text: '✨ {user} เปิดดวง 3 ใบ', durationMs: 13000 } } },
  { id: 'tarot-7', group: 'tarot', icon: '🌌', title: 'กิฟต์ 1,000 เพชรขึ้นไป → ไพ่ 7 ใบ', desc: 'ดูดวงเต็มชุดให้สายเปย์',
    rule: { name: 'ไพ่ 7 ใบ (1,000 เพชร+)', trigger: { event: 'gift', minDiamonds: 1000 }, action: { type: 'tarot', cards: 7, text: '👑 ดูดวงเต็มชุดให้ {user}', durationMs: 20000 } } },
  { id: 'tarot-chat', group: 'tarot', icon: '💬', title: 'พิมพ์ “ดูดวง” ในแชท → ไพ่ 1 ใบ', desc: 'ให้คนดูเล่นได้ทุกคน',
    rule: { name: 'แชทดูดวง', trigger: { event: 'chat', keyword: 'ดูดวง' }, action: { type: 'tarot', cards: 1, text: '🔮 ไพ่ของ {user}', durationMs: 8000 } } },
  { id: 'tarot-love3', group: 'tarot', icon: '💘', title: 'ทำนายความรัก 3 ใบ', desc: 'กิฟต์ 30 เพชรขึ้นไป → ใจคุณ · ใจเขา · อนาคตความรัก',
    rule: { name: 'ทำนายความรัก', trigger: { event: 'gift', minDiamonds: 30 }, action: { type: 'tarot', cards: 3, topic: 'love', text: '💘 ดวงความรักของ {user}', durationMs: 13000 } } },
  { id: 'tarot-lovechat', group: 'tarot', icon: '💌', title: 'พิมพ์ “ดูดวงความรัก” → ไพ่ 1 ใบ', desc: 'คนดูขอดูดวงความรักในแชท',
    rule: { name: 'แชทดูดวงความรัก', trigger: { event: 'chat', keyword: 'ดูดวงความรัก' }, action: { type: 'tarot', cards: 1, topic: 'love', text: '💌 ความรักของ {user}', durationMs: 8000 } } },
  { id: 'tarot-lakshmi', group: 'tarot', icon: '🪷', title: 'ไพ่พระแม่ลักษมี ดูดวงความรัก', desc: 'กิฟต์ 30 เพชรขึ้นไป → ไพ่ลักษมี 3 ใบ · ใจคุณ · ใจเขา · อนาคตความรัก',
    rule: { name: 'ไพ่พระแม่ลักษมี', trigger: { event: 'gift', minDiamonds: 30 }, action: { type: 'tarot', cards: 3, deck: 'lakshmi', topic: 'love', text: '🪷 ไพ่พระแม่ลักษมี ทำนายความรักของ {user}', durationMs: 13000 } } },
  { id: 'tarot-money', group: 'tarot', icon: '💰', title: 'ทำนายการเงิน 3 ใบ', desc: 'กิฟต์ 99 เพชรขึ้นไป → การเงินตอนนี้ · สิ่งที่ต้องระวัง · โชคลาภ',
    rule: { name: 'ทำนายการเงิน', trigger: { event: 'gift', minDiamonds: 99 }, action: { type: 'tarot', cards: 3, topic: 'money', text: '💰 ดวงการเงินของ {user}', durationMs: 13000 } } },
  { id: 'tarot-self', group: 'tarot', icon: '🪞', title: 'ทำนายตัวตน 3 ใบ', desc: 'กิฟต์ 30 เพชรขึ้นไป → ตัวตนจริง · ที่คนอื่นมอง · จุดเด่น',
    rule: { name: 'ทำนายตัวตน', trigger: { event: 'gift', minDiamonds: 30 }, action: { type: 'tarot', cards: 3, topic: 'self', text: '🪞 ตัวตนของ {user}', durationMs: 13000 } } },
  { id: 'tarot-daily', group: 'tarot', icon: '📅', title: 'เปิดไพ่ประจำวัน', desc: 'พิมพ์ "ไพ่ประจำวัน" ในแชท → ไพ่ของวันนี้ (คนเดิมได้ใบเดิมทั้งวัน)',
    rule: { name: 'เปิดไพ่ประจำวัน', trigger: { event: 'chat', keyword: 'ไพ่ประจำวัน' }, action: { type: 'tarot', cards: 1, topic: 'daily', text: '📅 ไพ่ประจำวันของ {user}', durationMs: 9000 } } },
  { id: 'tarot-swords', group: 'tarot', icon: '⚔️', title: 'ร่างกายต้องการดาบ', desc: 'ได้กิฟต์ → สุ่มไพ่ชุดดาบ 1 ใบ ตามเทรนด์',
    rule: { name: 'ร่างกายต้องการดาบ', trigger: { event: 'gift', minDiamonds: 1 }, action: { type: 'tarot', cards: 1, deck: 'swords', text: '⚔️ ร่างกายของ {user} ต้องการดาบ!', durationMs: 8000 } } },
  // 💖 ขอบคุณ & ป้ายไฟ
  { id: 'thanks-follow', group: 'thanks', icon: '💖', title: 'มีคนติดตาม → ข้อความขอบคุณ', desc: '“ขอบคุณ {user} ที่กดติดตามนะ”',
    rule: { name: 'ขอบคุณผู้ติดตามใหม่', trigger: { event: 'follow' }, action: { type: 'text', text: '💖 ขอบคุณ {user} ที่กดติดตามนะ!', durationMs: 4000 } } },
  { id: 'thanks-share', group: 'thanks', icon: '🔁', title: 'มีคนแชร์ → ข้อความขอบคุณ', desc: 'กระตุ้นให้คนช่วยแชร์ไลฟ์',
    rule: { name: 'ขอบคุณที่แชร์', trigger: { event: 'share' }, action: { type: 'text', text: '🔁 ขอบคุณ {user} ที่ช่วยแชร์ไลฟ์ 🙏', durationMs: 4000 } } },
  { id: 'thanks-500', group: 'thanks', icon: '🎉', title: 'กิฟต์ 500 เพชรขึ้นไป → ข้อความว้าว', desc: 'ฉลองให้คนส่งกิฟต์ใหญ่',
    rule: { name: 'ว้าว! กิฟต์ใหญ่ (500+)', trigger: { event: 'gift', minDiamonds: 500 }, action: { type: 'text', text: '🎉 ว้าว! {user} ใจดีสุด ๆ ขอบคุณมาก!', durationMs: 5000 } } },
  { id: 'thanks-led', group: 'thanks', icon: '💡', title: 'กิฟต์ 100 เพชรขึ้นไป → ป้ายไฟขอบคุณ', desc: 'ป้าย LED วิ่ง “ขอบคุณ {user}” กลางจอ',
    rule: { name: 'ป้ายไฟขอบคุณ (100💎+)', trigger: { event: 'gift', minDiamonds: 100 }, action: { type: 'sign', signStyle: 'led', signMode: 'scroll', signPos: 'center', color: '#ffcf5c', text: '🎉 ขอบคุณ {user} ใจดีสุด ๆ 💖', durationMs: 7000 } } },
  { id: 'thanks-neon', group: 'thanks', icon: '🌈', title: 'มีคนติดตาม → ป้ายนีออน', desc: 'ป้ายนีออนเต้นตุบ ๆ “{user} ติดตามแล้ว”',
    rule: { name: 'ป้ายนีออนผู้ติดตาม', trigger: { event: 'follow' }, action: { type: 'sign', signStyle: 'neon', signMode: 'pulse', signPos: 'top', color: '#ff4fa3', text: '💗 {user} ติดตามแล้ว ขอบคุณน้า', durationMs: 4000 } } },
  { id: 'thanks-galaxy', group: 'thanks', icon: '🌟', title: 'ได้ Galaxy → ข้อความพิเศษ', desc: 'ขอบคุณแบบเฉพาะกิฟต์',
    rule: { name: 'ขอบคุณ Galaxy', trigger: { event: 'gift', giftName: 'Galaxy' }, action: { type: 'text', text: '🌌 {user} ส่ง Galaxy! รักเลย 💜', durationMs: 5000 } } },
  // 🧸 มาสคอต
  { id: 'mascot-dance', group: 'mascot', icon: '💃', title: 'มาสคอตเต้น', desc: 'ได้ Finger Heart → ตัวแทนวีเจเต้นบนจอ',
    rule: { name: 'มาสคอตเต้น', trigger: { event: 'gift', giftName: 'Finger Heart' }, action: { type: 'mascot', move: 'dance', text: '💃 เต้นให้ {user} ดู!' } } },
  { id: 'mascot-kiss', group: 'mascot', icon: '💋', title: 'มาสคอตเดินมาส่งจุ๊บ', desc: 'ได้ Rosa → เดินเข้ามาส่งจุ๊บ แล้วเดินกลับ',
    rule: { name: 'มาสคอตส่งจุ๊บ', trigger: { event: 'gift', giftName: 'Rosa' }, action: { type: 'mascot', move: 'kiss' } } },
  // 🥊 สนุก ๆ
  { id: 'fun-glove', group: 'fun', icon: '🥊', title: 'ได้ Rose → ส่งนวม', desc: 'นวมน่ารักพุ่งมาต่อยกลางจอ ปั้ก! พร้อมเสียงตื่นเต้น',
    rule: { name: 'ส่งนวม', trigger: { event: 'gift', giftName: 'Rose' }, action: { type: 'glove', count: 1, text: '🥊 {user} ส่งนวม!', durationMs: 4000 } } },
  { id: 'fun-glove-chat', group: 'fun', icon: '👊', title: 'พิมพ์ “ปั้ก” ในแชท → นวม 2 หมัด', desc: 'ให้คนดูแกล้งวีเจได้ นวมพุ่งซ้าย-ขวา',
    rule: { name: 'แชทปั้กนวม', trigger: { event: 'chat', keyword: 'ปั้ก' }, action: { type: 'glove', count: 2, text: '👊 {user} ปั้กวีเจ!', durationMs: 4000 } } },
];
