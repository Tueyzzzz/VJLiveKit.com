'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Check, Copy, Pencil, Play, Plus, Sparkles, Trash2, Upload as UploadIcon } from 'lucide-react';
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select, Spinner } from '@/components/ui';
import { GiftCell, GiftPicker } from '@/components/GiftPicker';
import { SoundUpload } from '@/components/SoundUpload';
import { toDigits } from '@/components/NumberInput';
import { toAudioDataUrl } from '@/lib/sounds';
import { api, ApiError, type OverlayTokenRow, type ActionType, type Rule, type TarotDeck, type TarotTopic, type TriggerEvent } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { translate, useT } from '@/lib/i18n';

const EVENT_LABELS: Record<TriggerEvent, string> = { gift: '🎁 ได้รับกิฟต์', follow: '➕ มีคนติดตาม', share: '🔁 มีคนแชร์', like: '❤️ มีคนกดไลค์', chat: '💬 แชทมีคำว่า', pk: '⚔️ PK (แข่ง)' };
/** สถานการณ์ PK ที่ตั้งกฎได้ */
const PK_LABELS: Record<string, string> = { start: '🔔 เริ่ม PK', win: '🏆 ชนะ PK', lose: '💪 แพ้ PK', draw: '🤝 เสมอ', anycard: '🃏 มีคนใช้การ์ดอะไรก็ได้', glove: '🥊 การ์ดนวม', critical: '⚡ การ์ดสายฟ้า', smoke: '🌫️ การ์ดหมอก', extra: '⏱️ การ์ดต่อเวลา', potion: '🧪 การ์ดยาพลัง', wave: '🌊 การ์ดคลื่น', effect: '✨ การ์ดเอฟเฟกต์พิเศษ', top2: '🥈 เก้าอี้ที่ 2 X2 (อันดับ 2 ส่งได้คะแนนคูณ 2)', top3: '🥉 เก้าอี้ที่ 3 X2 (อันดับ 3 ส่งได้คะแนนคูณ 2)' };
const ACTION_LABELS: Record<ActionType, string> = { sound: '🔊 เล่นเสียง', image: '🖼️ แสดงรูป/GIF', video: '🎬 เล่นวิดีโอ', text: '✏️ แสดงข้อความ', tarot: '🔮 สุ่มไพ่ทาโร่', effect: '🦋 ผีเสื้อเทพนิยาย', sign: '💡 ป้ายไฟ', glove: '🥊 ส่งนวม', mascot: '🧸 มาสคอตทำท่า' };

interface Draft {
  id?: string;
  name: string;
  enabled: boolean;
  event: TriggerEvent;
  giftName: string;
  minDiamonds: string;
  keyword: string;
  pk: string;
  pkSide: '' | 'us' | 'them';
  type: ActionType;
  url: string;
  /** เสียงสำเร็จรูป ('' = ใช้ลิงก์ไฟล์เอง) */
  sound: string;
  text: string;
  durationSec: string;
  cards: string;
  deck: TarotDeck;
  topic: TarotTopic;
  count: string;
  /** มาสคอต: ท่า */
  move: 'dance' | 'kiss' | 'joy' | 'heart' | 'walk' | 'spin' | 'jump';
  /** คอมโบเล่นซ้ำสูงสุดกี่ครั้ง */
  repeat: string;
  /** สีผีเสื้อ */
  tint: 'pink' | 'blue' | 'purple' | 'mint' | 'gold' | 'rainbow';
  /** ป้ายไฟ */
  signStyle: 'led' | 'neon' | 'bulb' | 'cute' | 'pixel' | 'y2k' | 'glass' | 'surreal' | 'boho' | 'victorian' | 'graffiti' | 'future' | 'mwhite' | 'mblack' | 'mline' | 'mpill';
  signMode: 'scroll' | 'static' | 'blink' | 'pulse';
  signPos: 'top' | 'center' | 'bottom';
  color: string;
}

const EMPTY: Draft = { name: '', enabled: true, event: 'gift', giftName: '', minDiamonds: '', keyword: '', pk: 'win', pkSide: '', type: 'sound', url: '', sound: 'chime', text: '', durationSec: '5', cards: '1', deck: 'full', topic: 'general', count: '12', move: 'dance', repeat: '1', tint: 'pink', signStyle: 'led', signMode: 'scroll', signPos: 'top', color: '#ff4fa3' };

/** เทมเพลตยอดนิยม — กดครั้งเดียวสร้างกฎได้เลย (ไม่ต้องหาไฟล์เสียง/รูปเอง) */
interface Template { icon: string; title: string; desc: string; rule: { name: string; trigger: Rule['trigger']; action: Rule['action'] } }
/** เทมเพลต PK — โชว์ในเมนู ⚔️ PK Battle */
const PK_TEMPLATES: Template[] = [
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
const TEMPLATES: Template[] = [
  { icon: '🔮', title: 'ได้ Rose → เปิดไพ่ 1 ใบ', desc: 'ทุกกุหลาบ = คำทำนาย 1 ใบให้คนส่ง',
    rule: { name: 'Rose เปิดไพ่ทาโร่', trigger: { event: 'gift', giftName: 'Rose' }, action: { type: 'tarot', cards: 1, text: '🌹 คำทำนายของ {user}', durationMs: 8000 } } },
  { icon: '🃏', title: 'กิฟต์ 99 เพชรขึ้นไป → ไพ่ 3 ใบ', desc: 'อดีต · ปัจจุบัน · อนาคต',
    rule: { name: 'ไพ่ 3 ใบ (99 เพชร+)', trigger: { event: 'gift', minDiamonds: 99 }, action: { type: 'tarot', cards: 3, text: '✨ {user} เปิดดวง 3 ใบ', durationMs: 13000 } } },
  { icon: '🌌', title: 'กิฟต์ 1,000 เพชรขึ้นไป → ไพ่ 7 ใบ', desc: 'ดูดวงเต็มชุดให้สายเปย์',
    rule: { name: 'ไพ่ 7 ใบ (1,000 เพชร+)', trigger: { event: 'gift', minDiamonds: 1000 }, action: { type: 'tarot', cards: 7, text: '👑 ดูดวงเต็มชุดให้ {user}', durationMs: 20000 } } },
  { icon: '💬', title: 'พิมพ์ “ดูดวง” ในแชท → ไพ่ 1 ใบ', desc: 'ให้คนดูเล่นได้ทุกคน',
    rule: { name: 'แชทดูดวง', trigger: { event: 'chat', keyword: 'ดูดวง' }, action: { type: 'tarot', cards: 1, text: '🔮 ไพ่ของ {user}', durationMs: 8000 } } },
  { icon: '💘', title: 'ทำนายความรัก 3 ใบ', desc: 'กิฟต์ 30 เพชรขึ้นไป → ใจคุณ · ใจเขา · อนาคตความรัก',
    rule: { name: 'ทำนายความรัก', trigger: { event: 'gift', minDiamonds: 30 }, action: { type: 'tarot', cards: 3, topic: 'love', text: '💘 ดวงความรักของ {user}', durationMs: 13000 } } },
  { icon: '💌', title: 'พิมพ์ “ดูดวงความรัก” → ไพ่ 1 ใบ', desc: 'คนดูขอดูดวงความรักในแชท',
    rule: { name: 'แชทดูดวงความรัก', trigger: { event: 'chat', keyword: 'ดูดวงความรัก' }, action: { type: 'tarot', cards: 1, topic: 'love', text: '💌 ความรักของ {user}', durationMs: 8000 } } },
  { icon: '💰', title: 'ทำนายการเงิน 3 ใบ', desc: 'กิฟต์ 99 เพชรขึ้นไป → การเงินตอนนี้ · สิ่งที่ต้องระวัง · โชคลาภ',
    rule: { name: 'ทำนายการเงิน', trigger: { event: 'gift', minDiamonds: 99 }, action: { type: 'tarot', cards: 3, topic: 'money', text: '💰 ดวงการเงินของ {user}', durationMs: 13000 } } },
  { icon: '🪞', title: 'ทำนายตัวตน 3 ใบ', desc: 'กิฟต์ 30 เพชรขึ้นไป → ตัวตนจริง · ที่คนอื่นมอง · จุดเด่น',
    rule: { name: 'ทำนายตัวตน', trigger: { event: 'gift', minDiamonds: 30 }, action: { type: 'tarot', cards: 3, topic: 'self', text: '🪞 ตัวตนของ {user}', durationMs: 13000 } } },
  { icon: '💃', title: 'มาสคอตเต้น', desc: 'ได้ Finger Heart → ตัวแทนวีเจเต้นบนจอ',
    rule: { name: 'มาสคอตเต้น', trigger: { event: 'gift', giftName: 'Finger Heart' }, action: { type: 'mascot', move: 'dance', text: '💃 เต้นให้ {user} ดู!' } } },
  { icon: '💋', title: 'มาสคอตเดินมาส่งจุ๊บ', desc: 'ได้ Rosa → เดินเข้ามาส่งจุ๊บ แล้วเดินกลับ',
    rule: { name: 'มาสคอตส่งจุ๊บ', trigger: { event: 'gift', giftName: 'Rosa' }, action: { type: 'mascot', move: 'kiss' } } },
  { icon: '📅', title: 'เปิดไพ่ประจำวัน', desc: 'พิมพ์ "ไพ่ประจำวัน" ในแชท → ไพ่ของวันนี้ (คนเดิมได้ใบเดิมทั้งวัน)',
    rule: { name: 'เปิดไพ่ประจำวัน', trigger: { event: 'chat', keyword: 'ไพ่ประจำวัน' }, action: { type: 'tarot', cards: 1, topic: 'daily', text: '📅 ไพ่ประจำวันของ {user}', durationMs: 9000 } } },
  { icon: '🦋', title: 'ได้ Rose → ผีเสื้อเทพนิยาย', desc: 'ผีเสื้อปีกวาวบินข้ามจอ โปรยผงประกาย',
    rule: { name: 'ผีเสื้อเทพนิยาย', trigger: { event: 'gift', giftName: 'Rose' }, action: { type: 'effect', effect: 'butterflies', count: 12, text: '🦋 {user} เสกผีเสื้อให้ ✨', durationMs: 8000 } } },
  { icon: '⚔️', title: 'ร่างกายต้องการดาบ', desc: 'ได้กิฟต์ → สุ่มไพ่ชุดดาบ 1 ใบ ตามเทรนด์',
    rule: { name: 'ร่างกายต้องการดาบ', trigger: { event: 'gift', minDiamonds: 1 }, action: { type: 'tarot', cards: 1, deck: 'swords', text: '⚔️ ร่างกายของ {user} ต้องการดาบ!', durationMs: 8000 } } },
  { icon: '💖', title: 'มีคนติดตาม → ข้อความขอบคุณ', desc: '“ขอบคุณ {user} ที่กดติดตามนะ”',
    rule: { name: 'ขอบคุณผู้ติดตามใหม่', trigger: { event: 'follow' }, action: { type: 'text', text: '💖 ขอบคุณ {user} ที่กดติดตามนะ!', durationMs: 4000 } } },
  { icon: '🔁', title: 'มีคนแชร์ → ข้อความขอบคุณ', desc: 'กระตุ้นให้คนช่วยแชร์ไลฟ์',
    rule: { name: 'ขอบคุณที่แชร์', trigger: { event: 'share' }, action: { type: 'text', text: '🔁 ขอบคุณ {user} ที่ช่วยแชร์ไลฟ์ 🙏', durationMs: 4000 } } },
  { icon: '🎉', title: 'กิฟต์ 500 เพชรขึ้นไป → ข้อความว้าว', desc: 'ฉลองให้คนส่งกิฟต์ใหญ่',
    rule: { name: 'ว้าว! กิฟต์ใหญ่ (500+)', trigger: { event: 'gift', minDiamonds: 500 }, action: { type: 'text', text: '🎉 ว้าว! {user} ใจดีสุด ๆ ขอบคุณมาก!', durationMs: 5000 } } },
  { icon: '💡', title: 'กิฟต์ 100 เพชรขึ้นไป → ป้ายไฟขอบคุณ', desc: 'ป้าย LED วิ่ง “ขอบคุณ {user}” กลางจอ',
    rule: { name: 'ป้ายไฟขอบคุณ (100💎+)', trigger: { event: 'gift', minDiamonds: 100 }, action: { type: 'sign', signStyle: 'led', signMode: 'scroll', signPos: 'center', color: '#ffcf5c', text: '🎉 ขอบคุณ {user} ใจดีสุด ๆ 💖', durationMs: 7000 } } },
  { icon: '🌈', title: 'มีคนติดตาม → ป้ายนีออน', desc: 'ป้ายนีออนเต้นตุบ ๆ “{user} ติดตามแล้ว”',
    rule: { name: 'ป้ายนีออนผู้ติดตาม', trigger: { event: 'follow' }, action: { type: 'sign', signStyle: 'neon', signMode: 'pulse', signPos: 'top', color: '#ff4fa3', text: '💗 {user} ติดตามแล้ว ขอบคุณน้า', durationMs: 4000 } } },
  { icon: '🥊', title: 'ได้ Rose → ส่งนวม', desc: 'นวมน่ารักพุ่งมาต่อยกลางจอ ปั้ก! พร้อมเสียงตื่นเต้น',
    rule: { name: 'ส่งนวม', trigger: { event: 'gift', giftName: 'Rose' }, action: { type: 'glove', count: 1, text: '🥊 {user} ส่งนวม!', durationMs: 4000 } } },
  { icon: '🌟', title: 'ได้ Galaxy → ข้อความพิเศษ', desc: 'ขอบคุณแบบเฉพาะกิฟต์',
    rule: { name: 'ขอบคุณ Galaxy', trigger: { event: 'gift', giftName: 'Galaxy' }, action: { type: 'text', text: '🌌 {user} ส่ง Galaxy! รักเลย 💜', durationMs: 5000 } } },
];

/** เสียงสำเร็จรูป — ชุดเดียวกับ overlay/js/sfx.js (ฟังตัวอย่างโดยโหลดไฟล์นั้นมาเล่น) */
const SFX: [string, string][] = [['chime', '🔔 กริ๊ง'], ['coin', '🪙 เหรียญ'], ['levelup', '⬆️ เลเวลอัป'], ['fanfare', '🎺 ฟันแฟร์'], ['magic', '✨ เวทมนตร์'], ['pop', '🫧 ป๊อป'], ['whoosh', '💨 วู้ช'], ['drum', '🥁 ตึ่งโป๊ะ'], ['boing', '🌀 ดึ๋ง'], ['heart', '💗 หัวใจ'], ['applause', '👏 ปรบมือ'], ['alarm', '🚨 ไซเรน']];
let sfxLoad: Promise<void> | null = null;
async function playSfx(id: string) {
  const w = window as unknown as { VJLSfx?: { play: (id: string) => boolean } };
  sfxLoad ??= new Promise((ok, bad) => { const s = document.createElement('script'); s.src = `${process.env.NEXT_PUBLIC_API_BASE ?? ''}/overlay/js/sfx.js`; s.onload = () => ok(); s.onerror = bad; document.head.appendChild(s); });
  try { await sfxLoad; w.VJLSfx?.play(id); } catch { sfxLoad = null; }
}

interface Upload { id: string; name: string; size: number; url: string }
const readAsDataUrl = (f: File) => new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => bad(new Error(translate('อ่านไฟล์ไม่ได้'))); r.readAsDataURL(f); });

function toDraft(r: Rule): Draft {
  return {
    id: r.id, name: r.name, enabled: r.enabled, event: r.trigger.event,
    giftName: r.trigger.giftName ?? '', minDiamonds: r.trigger.minDiamonds != null ? String(r.trigger.minDiamonds) : '',
    keyword: r.trigger.keyword ?? '', pk: r.trigger.pk ?? 'win', pkSide: r.trigger.pkSide ?? '', type: r.action.type, url: r.action.url ?? '',
    sound: r.action.sound ?? (r.action.url ? '' : 'chime'), text: r.action.text ?? '',
    durationSec: r.action.durationMs ? String(r.action.durationMs / 1000) : '5',
    cards: String(r.action.cards ?? 1),
    deck: r.action.deck ?? 'full',
    topic: r.action.topic ?? 'general',
    count: String(r.action.count ?? 12),
    move: r.action.move ?? 'dance',
    repeat: String(r.action.repeat ?? 1),
    tint: r.action.tint ?? 'pink',
    signStyle: r.action.signStyle ?? 'led', signMode: r.action.signMode ?? 'scroll', signPos: r.action.signPos ?? 'top', color: r.action.color ?? '#ff4fa3',
  };
}

function toBody(d: Draft) {
  const trigger: Rule['trigger'] = { event: d.event };
  if (d.event === 'gift') {
    if (d.giftName.trim()) trigger.giftName = d.giftName.trim();
    if (!d.giftName.trim() && d.minDiamonds.trim()) trigger.minDiamonds = Math.max(0, Math.floor(Number(d.minDiamonds)));
  }
  if (d.event === 'chat' && d.keyword.trim()) trigger.keyword = d.keyword.trim();
  if (d.event === 'pk') { trigger.pk = d.pk || 'win'; if (d.pkSide && !['start', 'win', 'lose', 'draw'].includes(trigger.pk)) trigger.pkSide = d.pkSide; }
  const action: Rule['action'] = { type: d.type };
  const needsFile = (d.type === 'sound' && !d.sound) || d.type === 'image' || d.type === 'video';
  if (needsFile && d.url.trim()) action.url = d.url.trim();
  if (d.type === 'sound' && d.sound) action.sound = d.sound;
  if (d.type === 'mascot') action.move = d.move;
  if (d.type === 'glove') action.count = Math.max(1, Math.min(5, Number(d.count) || 1));
  if (d.type === 'effect') { action.tint = d.tint; action.effect = 'butterflies'; action.count = Math.max(1, Math.min(30, Number(d.count) || 12)); }
  if (d.text.trim()) action.text = d.text.trim();
  if (d.type === 'tarot') { action.cards = Number(d.cards) || 1; if (d.deck !== 'full') action.deck = d.deck; if (d.topic !== 'general') action.topic = d.topic; }
  if (d.type === 'sign') { action.signStyle = d.signStyle; action.signMode = d.signMode; action.signPos = d.signPos; if (/^#[0-9a-fA-F]{3,8}$/.test(d.color)) action.color = d.color; }
  if (d.type !== 'tarot' && d.event === 'gift') { const n = Math.max(1, Math.min(20, Math.floor(Number(d.repeat) || 1))); if (n > 1) action.repeat = n; }
  const sec = Number(d.durationSec);
  if (sec > 0) action.durationMs = Math.min(60_000, Math.round(sec * 1000));
  return { name: d.name.trim(), enabled: d.enabled, trigger, action };
}

function describe(r: Rule, t: typeof translate): string {
  const tr = r.trigger;
  let s = t(EVENT_LABELS[tr.event]);
  if (tr.event === 'gift') s += tr.giftName ? ` “${tr.giftName}”` : '';
  if (tr.event === 'gift' && !tr.giftName && tr.minDiamonds) s += ` ≥ ${tr.minDiamonds} 💎`;
  if (tr.event === 'chat') s += ` “${tr.keyword ?? ''}”`;
  if (tr.event === 'pk') s += ` ${t(PK_LABELS[tr.pk ?? ''] ?? '')}${tr.pkSide === 'us' ? t(' (ให้เรา)') : tr.pkSide === 'them' ? t(' (ใส่คู่แข่ง)') : ''}`;
  return `${s} → ${t(ACTION_LABELS[r.action.type])}${r.action.type === 'tarot' ? ` ${t('{n} ใบ', { n: r.action.cards ?? 1 })}` : ''}${r.action.text ? ` “${r.action.text}”` : ''}`;
}

export default function ActionsPage() {
  // ?pk=1 = เมนู PK Battle · Suspense จำเป็นกับ useSearchParams ใน static export
  return <Suspense fallback={<Spinner />}><ActionsInner /></Suspense>;
}

function ActionsInner() {
  const t = useT();
  const { entitlements, isAdmin } = useAuth();
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<{ text: string; upgrade?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  // ลิงก์วิดเจ็ต FX (ตัวที่แสดง Actions บนจอ) — คัดลอกได้จากหน้านี้เลย
  const [fxUrl, setFxUrl] = useState<string | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    api<{ tokens: OverlayTokenRow[] }>('/api/overlay-tokens')
      .then((r) => { const u = r.tokens[0]?.urls; setFxUrl(u?.find((x) => x.type === 'fx')?.url ?? null); setMenuUrl(u?.find((x) => x.type === 'fxmenu')?.url ?? null); })
      .catch(() => setFxUrl(null));
  }, []);
  // ลิงก์ "เมนูของขวัญ" — บอกผู้ชมว่าส่งอะไรแล้วจะเกิดอะไร (ดึงจากกฎในหน้านี้)
  const [menuUrl, setMenuUrl] = useState<string | null>(null);
  const [menuCopied, setMenuCopied] = useState(false);
  async function copyMenu() {
    if (!menuUrl) return;
    try { await navigator.clipboard.writeText(menuUrl); } catch { window.prompt(t('คัดลอกลิงก์นี้'), menuUrl); return; }
    setMenuCopied(true); setTimeout(() => setMenuCopied(false), 1500);
  }
  async function copyFx() {
    if (!fxUrl) return;
    try { await navigator.clipboard.writeText(fxUrl); } catch { window.prompt(t('คัดลอกลิงก์นี้'), fxUrl); return; }
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }
  // กดแก้ไข/เพิ่มกฎ → เลื่อนขึ้นไปที่ฟอร์ม (ฟอร์มอยู่บนสุด ถ้าไม่เลื่อนจะดูเหมือนกดไม่ติด)
  const formRef = useRef<HTMLDivElement>(null);
  const draftKey = draft ? draft.id ?? 'new' : null;
  useEffect(() => { if (draftKey) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [draftKey]);

  const load = useCallback(async () => {
    try { setRules((await api<{ rules: Rule[] }>('/api/actions')).rules); }
    catch (err) { setError({ text: (err as Error).message }); setRules([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    // ต้องมีลิงก์ไฟล์เฉพาะ เสียง/รูป/วิดีโอ (ไพ่ทาโร่ · ผีเสื้อ · ข้อความ ไม่ต้องใช้)
    if (((draft.type === 'sound' && !draft.sound) || draft.type === 'image' || draft.type === 'video') && !draft.url.trim()) { setError({ text: t('ใส่ลิงก์ไฟล์ (https://...) ด้วย') }); return; }
    if (draft.type === 'text' && !draft.text.trim()) { setError({ text: t('ใส่ข้อความที่จะแสดงด้วย') }); return; }
    setBusy(true);
    setError(null);
    try {
      const body = toBody(draft);
      if (draft.id) await api(`/api/actions/${draft.id}`, { method: 'PUT', body });
      else await api('/api/actions', { method: 'POST', body });
      setDraft(null);
      await load();
      setSaved(t('บันทึก “{name}” แล้ว ✓ มีผลกับไลฟ์ทันที', { name: body.name })); setTimeout(() => setSaved(null), 4000);
    } catch (err) {
      setError({ text: err instanceof ApiError && err.status === 400 ? t('ข้อมูลไม่ถูกต้อง — ลิงก์ต้องขึ้นต้นด้วย https://') : (err as Error).message,
        upgrade: err instanceof ApiError && err.upgrade });
    } finally {
      setBusy(false);
    }
  }

  async function toggle(r: Rule) {
    try { await api(`/api/actions/${r.id}`, { method: 'PUT', body: { enabled: !r.enabled } }); await load(); }
    catch (err) { setError({ text: (err as Error).message }); }
  }

  // ▶ ทดลองเล่นบนจอ fx — ถ้าไม่มีจอ fx เปิดอยู่ บอกให้ใส่ลิงก์ก่อน
  async function test(r: Rule) {
    try {
      const res = await api<{ screens: number }>(`/api/actions/${r.id}/test`, { method: 'POST' });
      if (res.screens > 0) alert(t('ส่ง “{name}” ไปที่จอแล้ว ✓ (เปิดอยู่ {n} จอ)', { name: r.name, n: res.screens }));
      else alert(t('ยังไม่มีจอเอฟเฟกต์ (fx) เปิดอยู่ — คัดลอกลิงก์ “จอเอฟเฟกต์” ด้านบนไปใส่ในโปรแกรมไลฟ์ก่อน แล้วกดทดลองอีกครั้ง'));
    } catch (err) { setError({ text: (err as Error).message }); }
  }

  async function remove(r: Rule) {
    if (!confirm(t('ลบกฎ “{name}”?', { name: r.name }))) return;
    try { await api(`/api/actions/${r.id}`, { method: 'DELETE' }); await load(); }
    catch (err) { setError({ text: (err as Error).message }); }
  }

  // ไฟล์เสียงที่อัปโหลดไว้ (ใช้กับกฎ "เล่นเสียง")
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [maxBytes, setMaxBytes] = useState(5 * 1024 * 1024);
  useEffect(() => { api<{ sounds: Upload[]; maxBytes: number }>('/api/sounds').then((r) => { setUploads(r.sounds); if (r.maxBytes) setMaxBytes(r.maxBytes); }).catch(() => {}); }, []);
  // รูป/GIF/วิดีโอ สำหรับกฎ "แสดงรูป" / "เล่นวิดีโอ" (ไม่เกิน 20MB)
  async function uploadVisual(f: File) {
    if (f.size > 20 * 1024 * 1024) { setError({ text: t('วิดีโอ/รูปใหญ่เกิน 20MB — ตัดให้สั้นลงก่อน') }); return; }
    setUploading(true); setError(null);
    try {
      const r = await api<{ sound: { url: string } }>('/api/sounds', { method: 'POST', body: { name: f.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'media', data: await readAsDataUrl(f) } });
      setDraft((d) => (d ? { ...d, url: r.sound.url } : d));
    } catch (err) { setError({ text: (err as Error).message }); } finally { setUploading(false); }
  }
  async function uploadSound(f: File) {
    if (f.size > maxBytes) { setError({ text: t('ไฟล์ใหญ่เกิน {mb}MB — ตัดให้สั้นลง หรือแปลงเป็น mp3', { mb: Math.round(maxBytes / 1048576) }) }); return; }
    setUploading(true); setError(null);
    try {
      const data = await toAudioDataUrl(f);
      const r = await api<{ sound: Upload }>('/api/sounds', { method: 'POST', body: { name: f.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'เสียง', data } });
      setUploads((u) => [r.sound, ...u]);
      setDraft((d) => (d ? { ...d, sound: '', url: r.sound.url } : d));
    } catch (err) { setError({ text: (err as Error).message }); } finally { setUploading(false); }
  }

  const fxLocked = entitlements ? !entitlements.widgets.includes('fx') : false;
  const [adding, setAdding] = useState<string | null>(null);
  async function applyTemplate(tp: Template) {
    setAdding(tp.rule.name); setError(null);
    try { await api('/api/actions', { method: 'POST', body: { ...tp.rule, enabled: true } }); await load(); }
    catch (err) { setError({ text: (err as Error).message, upgrade: err instanceof ApiError && err.upgrade }); }
    finally { setAdding(null); }
  }
  const have = new Set((rules ?? []).map((r) => r.name));
  // เมนู ⚔️ PK Battle (/dashboard/actions/?pk=1): โชว์เฉพาะกฎ/เทมเพลต PK
  const sp = useSearchParams(), path = usePathname();
  const pkMode = path.includes('/dashboard/pk') || sp.get('pk') === '1'; // เปลี่ยนเมนู Actions ↔ PK แล้วหน้าเปลี่ยนตามทันที (เดิมอ่านครั้งเดียวตอนเปิด → กดจากหน้า Actions แล้วค้าง)

  return (
    <div>
      <PageHeader title={pkMode ? '⚔️ PK Battle' : 'Actions & Events'}
        description={pkMode ? t('ตั้งเอฟเฟกต์ตอนแข่ง PK: เริ่ม PK · ชนะ/แพ้ · มีคนใช้การ์ด (นวม สายฟ้า หมอก ต่อเวลา ฯลฯ) → ขึ้นจอผ่านวิดเจ็ต FX') : t('ตั้งกฎอัตโนมัติ: เมื่อเกิดเหตุการณ์ในไลฟ์ → overlay FX เล่นเสียง/รูป/วิดีโอ/ข้อความ')}
        actions={!draft && <Button onClick={() => { setError(null); setDraft(pkMode ? { ...EMPTY, event: 'pk', type: 'text', name: '', text: '⚔️ {user} ใช้การ์ดช่วยเรา!' } : { ...EMPTY }); }}><Plus className="size-4" /> {t('เพิ่มกฎ')}</Button>} />

      <Card className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="font-medium">{t('✨ ลิงก์วิดเจ็ตเอฟเฟกต์ (FX)')}</div>
            <p className="text-sm text-muted">{t('Actions ทุกกฎจะแสดงผ่านวิดเจ็ตนี้ — วางในโปรแกรมไลฟ์')} <b>{t('ให้เต็มจอ')}</b> {t('และไว้')} <b>{t('ชั้นบนสุด')}</b> {t('ครั้งเดียวพอ')}</p>
            {fxUrl && <code className="mt-1.5 block truncate rounded-lg bg-canvas px-3 py-1.5 text-xs text-muted">{fxUrl}</code>}
          </div>
          {fxUrl ? (
            <Button variant="secondary" onClick={copyFx}>{copied ? <><Check className="size-4 text-mint" /> {t('คัดลอกแล้ว')}</> : <><Copy className="size-4" /> {t('คัดลอกลิงก์ FX')}</>}</Button>
          ) : fxUrl === null ? (
            <Link href="/dashboard/" className="text-sm font-medium text-pink underline">{t('ตั้งชื่อ TikTok ที่หน้าภาพรวมก่อน แล้วลิงก์จะสร้างให้อัตโนมัติ')}</Link>
          ) : <Spinner />}
        </div>
        {menuUrl && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{t('📜 เมนูของขวัญ (ให้ผู้ชมรู้ว่าต้องส่งอะไร)')}</div>
              <p className="text-sm text-muted">{t('โชว์รูปกิฟต์ + สิ่งที่จะเกิดบนจอ จากกฎด้านล่างอัตโนมัติ แก้กฎแล้วเมนูบนจอเปลี่ยนทันที · ปรับหน้าตาได้ที่')} <Link href="/dashboard/widgets/settings/?type=fxmenu" className="text-pink underline">{t('ตั้งค่าเมนู')}</Link></p>
              <code className="mt-1.5 block truncate rounded-lg bg-canvas px-3 py-1.5 text-xs text-muted">{menuUrl}</code>
            </div>
            <Button variant="secondary" onClick={copyMenu}>{menuCopied ? <><Check className="size-4 text-mint" /> {t('คัดลอกแล้ว')}</> : <><Copy className="size-4" /> {t('คัดลอกลิงก์เมนู')}</>}</Button>
          </div>
        )}
      </Card>

      {fxLocked && (
        <div className="mb-5">
          <Alert tone="info">{t('overlay FX (ที่เล่น Actions) ใช้ได้ในแพลน Pro — ตั้งกฎไว้ก่อนได้ แล้ว')} <Link href="/dashboard/billing/" className="font-medium text-pink underline">{t('อัปเกรด')}</Link> {t('เพื่อให้แสดงบนไลฟ์')}</Alert>
        </div>
      )}
      {saved && <div className="mb-5"><Alert tone="success">{saved}</Alert></div>}
      {error && <div className="mb-5"><Alert>{error.text} {error.upgrade && <Link href="/dashboard/billing/" className="font-medium underline">{t('อัปเกรด')}</Link>}</Alert></div>}

      {draft && (
        <div ref={formRef} className="scroll-mt-4">
        <Card className="mb-6 ring-2 ring-pink/40">
          <form onSubmit={save} className="space-y-4">
            <h2 className="font-medium">{draft.id ? t('แก้ไขกฎ') : t('กฎใหม่')}</h2>
            <Field label={t('ชื่อกฎ')}><Input required maxLength={80} value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder={t('เช่น ได้ Rose เล่นเสียงปรบมือ')} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('เมื่อ')}>
                <Select value={draft.event} onChange={(e) => set('event', e.target.value as TriggerEvent)}>
                  {Object.entries(EVENT_LABELS).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
                </Select>
              </Field>
              {draft.event === 'gift' && (
                <>
                  <Field label={t('กิฟต์')}><GiftPicker value={draft.giftName} onChange={(v) => setDraft((d) => (d ? { ...d, giftName: v, minDiamonds: v ? '' : d.minDiamonds } : d))} /></Field>
                  {/* เลือกกิฟต์เฉพาะ = ขึ้นทุกครั้งที่ส่งกิฟต์นั้น · ทุกกิฟต์ = ตั้งมูลค่าขั้นต่ำได้ (ไม่ให้ตั้งคู่กัน เงื่อนไขจะขัดกัน) */}
                  {draft.giftName ? (
                    <div className="self-end rounded-xl bg-pink-soft/50 px-3 py-2 text-sm text-muted">{t('ขึ้นทุกครั้งที่มีคนส่ง')} <b className="text-ink">{draft.giftName}</b> {t('(ส่งรัว ๆ นับเป็น 1 ครั้งตอนจบคอมโบ) · อยากใช้มูลค่าขั้นต่ำแทน กด ✕ ที่ช่องกิฟต์')}</div>
                  ) : (
                    <Field label={t('มูลค่าขั้นต่ำ (เพชร)')} hint={t('กิฟต์อะไรก็ได้ที่มูลค่ารวมในคอมโบถึงเท่านี้ · เว้นว่าง = ทุกกิฟต์')}><Input type="text" inputMode="numeric" value={draft.minDiamonds} onChange={(e) => set('minDiamonds', toDigits(e.target.value))} placeholder={t('เช่น 99')} /></Field>
                  )}
                </>
              )}
              {draft.event === 'pk' && (
                <>
                  <Field label={t('สถานการณ์ PK')}><Select value={draft.pk} onChange={(e) => set('pk', e.target.value)}>{Object.entries(PK_LABELS).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</Select></Field>
                  {!['start', 'win', 'lose', 'draw'].includes(draft.pk) && (
                    <Field label={t('การ์ดนี้ใช้กับ')}><Select value={draft.pkSide} onChange={(e) => set('pkSide', e.target.value as Draft['pkSide'])}><option value="">{t('ทั้งสองฝั่ง')}</option><option value="us">{t('💖 ฝั่งเรา (มีคนช่วยเรา)')}</option><option value="them">{t('😈 ฝั่งคู่แข่ง')}</option></Select></Field>
                  )}
                </>
              )}
              {draft.event === 'chat' && (
                <Field label={t('คำในแชท')}><Input required value={draft.keyword} onChange={(e) => set('keyword', e.target.value)} placeholder={t('!เต้น')} /></Field>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('ให้ทำ')}>
                <Select value={draft.type} onChange={(e) => set('type', e.target.value as ActionType)}>
                  {Object.entries(ACTION_LABELS).filter(([k]) => k !== 'tarot' || isAdmin || draft.type === 'tarot').map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
                </Select>
              </Field>
              {draft.type === 'sound' && (
                <Field label={t('เสียง')} hint={t('เลือกเสียงสำเร็จรูป หรืออัปโหลดเพลง/เสียงของคุณ (mp3 · wav · ogg · m4a ไม่เกิน {mb}MB) · กด ▶ เพื่อฟัง', { mb: Math.round(maxBytes / 1048576) })}>
                  <div className="flex flex-wrap gap-2">
                    <Select className="min-w-0 flex-1" value={draft.sound || (uploads.some((u) => u.url === draft.url) ? 'url:' + draft.url : '')}
                      onChange={(e) => { const v = e.target.value; setDraft((d) => (d ? (v.startsWith('url:') ? { ...d, sound: '', url: v.slice(4) } : { ...d, sound: v, url: v ? d.url : (uploads.some((u) => u.url === d.url) ? '' : d.url) }) : d)); }}>
                      <optgroup label={t('เสียงสำเร็จรูป')}>{SFX.map(([id, name]) => <option key={id} value={id}>{t(name)}</option>)}</optgroup>
                      {uploads.length > 0 && <optgroup label={t('🎵 ไฟล์ที่อัปโหลด')}>{uploads.map((u) => <option key={u.id} value={'url:' + u.url}>🎵 {u.name}</option>)}</optgroup>}
                      <option value="">{t('🔗 ใช้ลิงก์ไฟล์เสียงเอง')}</option>
                    </Select>
                    <Button type="button" variant="secondary" className="px-3" aria-label={t('ฟังเสียง')} onClick={() => { if (draft.sound) void playSfx(draft.sound); else if (draft.url) void new Audio(draft.url).play().catch(() => {}); }}><Play className="size-4" /></Button>
                    <SoundUpload onUploaded={(u) => { setUploads((x) => [u, ...x]); setDraft((d) => (d ? { ...d, sound: '', url: u.url } : d)); }} />
                  </div>
                </Field>
              )}
              {((draft.type === 'sound' && !draft.sound && !uploads.some((u) => u.url === draft.url)) || draft.type === 'image' || draft.type === 'video') && (
                <Field label={t('ลิงก์ไฟล์')} hint={t('ลิงก์ตรงไปยังไฟล์ .mp3 / .png / .gif / .mp4 (https://)')}>
                  <div className="flex gap-2">
                    <Input type="url" required value={draft.url} onChange={(e) => set('url', e.target.value)} placeholder="https://..." className="min-w-0 flex-1" />
                    {(draft.type === 'image' || draft.type === 'video') && (
                      <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-sm hover:bg-pink-soft">
                        {uploading ? <Spinner /> : <UploadIcon className="size-4" />} {t('อัปโหลด')}
                        <input type="file" accept={draft.type === 'video' ? 'video/*' : 'image/gif,image/png,image/webp,image/jpeg'} className="hidden" disabled={uploading}
                          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadVisual(f); }} />
                      </label>
                    )}
                  </div>
                </Field>
              )}
              <Field label={draft.type === 'text' ? t('ข้อความ') : t('ข้อความประกอบ (ไม่บังคับ)')} hint={draft.type === 'sign' ? t('ข้อความบนป้าย · {user} = ชื่อคนส่ง · แนะนำแสดงนาน 5–8 วินาที') : draft.type === 'tarot' ? t('สุ่มไพ่ครบสำรับ 78 ใบ พร้อมคำทำนาย · {user} = ชื่อคนส่ง · แนะนำแสดงนาน 8 วินาที') : t('ใช้ {user} แทนชื่อคนที่ทำให้เกิดเหตุการณ์')}>
                <Input maxLength={200} value={draft.text} onChange={(e) => set('text', e.target.value)} placeholder={t('ขอบคุณ {user} 💕')} />
              </Field>
              {draft.type === 'tarot' && (
                <Field label={t('จำนวนไพ่')}>
                  <Select value={draft.cards} onChange={(e) => { set('cards', e.target.value); set('durationSec', e.target.value === '7' ? '20' : e.target.value === '3' ? '13' : '8'); }}>
                    <option value="1">{t('🃏 เปิด 1 ใบ — คำทำนายเดียว')}</option>
                    <option value="3">{t('🃏🃏🃏 เปิด 3 ใบ — อดีต · ปัจจุบัน · อนาคต')}</option>
                    <option value="7">{t('เปิด 7 ใบ — ดูดวงเต็มชุด')}</option>
                  </Select>
                </Field>
              )}
              {draft.type === 'mascot' && (
                <Field label={t('ท่าของมาสคอต')} hint={t('ต้องใส่วิดเจ็ต "ตัวแทนวีเจ (มาสคอต)" บนจอด้วย')}>
                  <Select value={draft.move} onChange={(e) => set('move', e.target.value as Draft['move'])}>
                    <option value="dance">{t('💃 เต้น')}</option><option value="kiss">{t('💋 เดินมาส่งจุ๊บ แล้วเดินกลับ')}</option>
                    <option value="joy">{t('🎉 ดีใจสุด ๆ')}</option><option value="heart">{t('😘 ส่งหัวใจ')}</option><option value="walk">{t('🚶 เดินไปมา')}</option><option value="spin">{t('🌀 หมุนตัว')}</option><option value="jump">{t('🦘 กระโดดสูง')}</option>
                  </Select>
                </Field>
              )}
              {draft.type === 'glove' && (
                <Field label={t('จำนวนหมัด')} hint={t('1–5 หมัด (สลับซ้ายขวา) · ข้อความประกอบขึ้นกลางจอ · มีเสียงในตัว')}>
                  <Input type="text" inputMode="numeric" value={draft.count === '12' ? '1' : draft.count} onChange={(e) => set('count', toDigits(e.target.value))} />
                </Field>
              )}
              {draft.type === 'effect' && (
                <Field label={t('สีผีเสื้อ')}>
                  <Select value={draft.tint} onChange={(e) => set('tint', e.target.value as Draft['tint'])}>
                    <option value="pink">{t('🩷 ชมพู (ค่าเริ่มต้น)')}</option><option value="purple">{t('💜 ม่วง')}</option><option value="blue">{t('💙 ฟ้า')}</option>
                    <option value="mint">{t('💚 มิ้นต์')}</option><option value="gold">{t('💛 ทอง')}</option><option value="rainbow">{t('🌈 หลากสี')}</option>
                  </Select>
                </Field>
              )}
              {draft.type === 'effect' && (
                <Field label={t('จำนวนผีเสื้อ')} hint={t('1–30 ตัว · ข้อความประกอบจะขึ้นเป็นหัวเรื่องกลางจอ')}>
                  <Input type="text" inputMode="numeric" value={draft.count} onChange={(e) => set('count', toDigits(e.target.value))} />
                </Field>
              )}
              {draft.type === 'tarot' && (
                <Field label={t('หัวข้อคำทำนาย')}>
                  <Select value={draft.topic} onChange={(e) => set('topic', e.target.value as TarotTopic)}>
                    <option value="general">{t('🔮 ดวงทั่วไป')}</option>
                    <option value="love">{t('💘 ความรัก — ใจคุณ · ใจเขา · อนาคตความรัก')}</option>
                    <option value="money">{t('💰 การเงิน — การเงินตอนนี้ · สิ่งที่ต้องระวัง · โชคลาภที่กำลังมา')}</option>
                    <option value="daily">{t('📅 ไพ่ประจำวัน — คนเดิมได้ไพ่ใบเดิมทั้งวัน (เช้า · บ่าย · ค่ำ)')}</option>
                    <option value="self">{t('🪞 ตัวตน — นิสัยจริง · คนอื่นมองคุณ · จุดเด่นที่ซ่อนอยู่')}</option>
                  </Select>
                </Field>
              )}
              {draft.type === 'tarot' && (
                <Field label={t('สำรับไพ่')}>
                  <Select value={draft.deck} onChange={(e) => set('deck', e.target.value as TarotDeck)}>
                    <option value="full">{t('ครบสำรับ 78 ใบ')}</option>
                    <option value="major">{t('ชุดใหญ่ 22 ใบ (Major Arcana)')}</option>
                    <option value="swords">{t('⚔️ เฉพาะชุดดาบ — “ร่างกายต้องการดาบ”')}</option>
                    <option value="cups">{t('🏆 เฉพาะชุดถ้วย (ความรัก)')}</option>
                    <option value="wands">{t('🔥 เฉพาะชุดไม้เท้า (พลัง/งาน)')}</option>
                    <option value="pentacles">{t('💰 เฉพาะชุดเหรียญ (การเงิน)')}</option>
                  </Select>
                </Field>
              )}
              {draft.type === 'sign' && (
                <>
                  <Field label={t('แบบป้าย')}>
                    <Select value={draft.signStyle} onChange={(e) => set('signStyle', e.target.value as Draft['signStyle'])}>
                      <option value="led">{t('🟥 LED จุด')}</option><option value="neon">{t('🌈 นีออน')}</option><option value="bulb">{t('💡 ไฟหลอดรอบป้าย')}</option><option value="cute">{t('🍬 พาสเทลน่ารัก')}</option><option value="pixel">{t('👾 Pixel (เกม 8-bit)')}</option><option value="y2k">{t('💿 Y2K')}</option><option value="glass">{t('🫧 Glassmorphism (กระจกฝ้า)')}</option><option value="surreal">{t('🌀 Surrealism (ฝันเหนือจริง)')}</option><option value="boho">{t('🌻 Bohemian (โบฮีเมียน)')}</option><option value="victorian">{t('👑 Victorian (วิกตอเรียน)')}</option><option value="graffiti">{t('🎨 Graffiti (กราฟฟิตี้)')}</option><option value="future">{t('🚀 Futuristic (ไซเบอร์)')}</option><option value="mwhite">{t('◻️ มินิมอล ขาว')}</option><option value="mblack">{t('◼️ มินิมอล ดำ')}</option><option value="mline">{t('▁ มินิมอล เส้นใต้')}</option><option value="mpill">{t('◯ มินิมอล แคปซูล')}</option>
                    </Select>
                  </Field>
                  <Field label={t('การเคลื่อนไหว')}>
                    <Select value={draft.signMode} onChange={(e) => set('signMode', e.target.value as Draft['signMode'])}>
                      <option value="scroll">{t('⬅️ วิ่ง')}</option><option value="static">{t('⏸ อยู่กับที่')}</option><option value="blink">{t('💡 กะพริบ')}</option><option value="pulse">{t('💓 เต้นตุบ ๆ')}</option>
                    </Select>
                  </Field>
                  <Field label={t('ตำแหน่ง')}>
                    <Select value={draft.signPos} onChange={(e) => set('signPos', e.target.value as Draft['signPos'])}>
                      <option value="top">{t('บน')}</option><option value="center">{t('กลางจอ')}</option><option value="bottom">{t('ล่าง')}</option>
                    </Select>
                  </Field>
                  {draft.signStyle !== 'bulb' && draft.signStyle !== 'cute' && (
                    <Field label={t('สีตัวอักษร')}><input type="color" value={draft.color} onChange={(e) => set('color', e.target.value)} className="h-10 w-20 cursor-pointer rounded-lg border border-line" /></Field>
                  )}
                </>
              )}
              {draft.event === 'gift' && (draft.type === 'tarot'
                ? <Field label={t('ส่งคอมโบ (เช่น กุหลาบ 100 ดอก)')}><div className="rounded-xl bg-canvas px-3 py-2 text-sm text-muted">{t('🔒 เปิดไพ่ 1 ครั้งต่อคอมโบ (ไพ่ล็อกไว้ ไม่เปิดรัว)')}</div></Field>
                : <Field label={t('ส่งคอมโบ เล่นซ้ำสูงสุด (ครั้ง)')} hint={t('เช่น ตั้ง 1 = ส่งกุหลาบ 100 ดอกรวดเดียว เล่นแค่ครั้งเดียว · ตั้ง 5 = เล่นตามจำนวนชิ้น ไม่เกิน 5 ครั้ง (สูงสุด 20)')}>
                    <Input type="text" inputMode="numeric" value={draft.repeat} onChange={(e) => set('repeat', toDigits(e.target.value))} placeholder="1" />
                  </Field>)}
              <Field label={t('แสดงนาน (วินาที)')}><Input type="text" inputMode="decimal" value={draft.durationSec} onChange={(e) => set('durationSec', toDigits(e.target.value, true))} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.enabled} onChange={(e) => set('enabled', e.target.checked)} className="accent-pink" /> {t('เปิดใช้งาน')}</label>
            <div className="flex gap-2">
              <Button type="submit" loading={busy}>{t('บันทึก')}</Button>
              <Button type="button" variant="ghost" onClick={() => { setDraft(null); setError(null); }}>{t('ยกเลิก')}</Button>
            </div>
          </form>
        </Card>
        </div>
      )}

      {!draft && rules && (
        <Card className="mb-6">
          <h2 className="mb-1 flex items-center gap-2 font-medium"><Sparkles className="size-4 text-pink" /> {t('เทมเพลตยอดนิยม')}</h2>
          <p className="mb-4 text-sm text-muted">{t('กด “ใช้เลย” แล้วใช้ได้ทันที — แก้ข้อความหรือเงื่อนไขทีหลังได้ด้วยปุ่มดินสอ')}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(pkMode ? PK_TEMPLATES : TEMPLATES).filter((tp) => isAdmin || tp.rule.action.type !== 'tarot').map((tp) => {
              const added = have.has(tp.rule.name);
              return (
                <div key={tp.rule.name} className="flex flex-col rounded-xl border border-line bg-canvas/50 p-3">
                  {/* PK: รูปวีเจประจำเทมเพลต (ตามการ์ด/สถานการณ์) · เทมเพลตอื่นใช้อีโมจิ */}
                  {tp.rule.trigger.event === 'pk' && tp.rule.trigger.pk
                    ? <img src={`/pk-tpl/${tp.rule.trigger.pk}.webp`} alt="" width={96} height={96} loading="lazy" className="mx-auto -mt-1 size-24 object-contain drop-shadow-md" />
                    : <div className="text-2xl">{tp.icon}</div>}
                  <div className="mt-1 text-sm font-medium leading-snug">{t(tp.title)}</div>
                  <div className="mt-0.5 flex-1 text-xs text-muted">{t(tp.desc)}</div>
                  <Button variant={added ? 'ghost' : 'secondary'} className="mt-3 w-full" disabled={added} loading={adding === tp.rule.name} onClick={() => applyTemplate(tp)}>
                    {added ? <><Check className="size-4" /> {t('เพิ่มแล้ว')}</> : t('ใช้เลย')}
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {!rules ? <Spinner /> : rules.length === 0 ? (
        !draft && <Card className="py-10 text-center text-sm text-muted">{t('ยังไม่มีกฎ — เลือกเทมเพลตด้านบน หรือกด “เพิ่มกฎ” เพื่อตั้งเอง')}</Card>
      ) : (
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-line px-5 py-3 text-xs text-muted">
            <span className="flex items-center gap-3"><span className="w-11 shrink-0" /><span className="w-24 text-center">{t('ของขวัญ')}</span><span>{rules.length}/{entitlements?.maxActionRules ?? '-'} {t('กฎ')}</span></span>
            <span>{t('มีผลกับไลฟ์ทันทีหลังบันทึก')}</span>
          </div>
          <ul className="divide-y divide-line">
            {rules.filter((r) => !pkMode || r.trigger.event === 'pk').map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <button role="switch" aria-checked={r.enabled} aria-label={t('เปิด/ปิดกฎ')} onClick={() => toggle(r)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${r.enabled ? 'bg-mint' : 'bg-gray-200'}`}>
                  <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition ${r.enabled ? 'left-5.5' : 'left-0.5'}`} />
                </button>
                <GiftCell name={r.trigger.giftName} event={r.trigger.event} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-medium">{r.name} {!r.enabled && <Badge tone="gray">{t('ปิดอยู่')}</Badge>}</div>
                  <div className="truncate text-sm text-muted">{describe(r, t)}</div>
                </div>
                <Button variant="ghost" className="px-3" aria-label={t('ทดลองเล่น')} title={t('ทดลองเล่นบนจอ')} onClick={() => test(r)}><Play className="size-4" /></Button>
                <Button variant="ghost" className="px-3" aria-label={t('แก้ไข')} onClick={() => { setError(null); setDraft(toDraft(r)); }}><Pencil className="size-4" /></Button>
                <Button variant="ghost" className="px-3 hover:text-red-600" aria-label={t('ลบ')} onClick={() => remove(r)}><Trash2 className="size-4" /></Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
