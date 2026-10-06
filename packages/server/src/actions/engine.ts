import type { TikTokEvent } from '../tiktok/types.js';
import { giftIdOf, giftInfo } from '../tiktok/giftCatalog.js';

/** กฎทริกเกอร์: ถ้าเหตุการณ์เข้าเงื่อนไข trigger ให้ทำ action */
export interface RuleTrigger {
  event: 'gift' | 'follow' | 'share' | 'like' | 'chat';
  giftName?: string;     // เจาะจงชื่อกิฟต์ (เฉพาะ event=gift)
  minDiamonds?: number;  // มูลค่าเพชรขั้นต่ำ (เฉพาะ event=gift)
  keyword?: string;      // คำในแชท (เฉพาะ event=chat)
}

export interface RuleAction {
  type: 'sound' | 'image' | 'video' | 'text' | 'tarot' | 'effect';
  /** เอฟเฟกต์เต็มจอ (type=effect) */
  effect?: 'butterflies';
  /** จำนวนตัว/ชิ้นของเอฟเฟกต์ */
  count?: number;
  url?: string;
  /** เสียงสำเร็จรูป (ไม่ต้องมีไฟล์) เช่น chime · coin · fanfare */
  sound?: string;
  text?: string;
  durationMs?: number;
  /** สุ่มไพ่ทาโร่: จำนวนใบ 1 | 3 | 7 */
  cards?: number;
  /** สำรับที่สุ่ม: ทั้งสำรับ / ชุดใหญ่ / เฉพาะชุดไม้เท้า·ถ้วย·ดาบ·เหรียญ */
  deck?: 'full' | 'major' | 'wands' | 'cups' | 'swords' | 'pentacles';
  /** หัวข้อคำทำนาย: ทั่วไป | ความรัก | ตัวตน | การเงิน */
  topic?: 'general' | 'love' | 'self' | 'money';
}

export interface ActionRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: RuleTrigger;
  action: RuleAction;
}

/** payload ที่ยิงไปให้ overlay fx เล่น */
export interface ActionFire {
  ruleId: string;
  name: string;
  action: RuleAction;
  event: TikTokEvent;
  ts: number;
}

/** ตรวจว่าเหตุการณ์หนึ่งเข้ากฎข้อนี้ไหม */
export function ruleMatches(rule: ActionRule, e: TikTokEvent): boolean {
  if (!rule.enabled) return false;
  const t = rule.trigger;
  if (t.event !== e.type) return false;

  if (e.type === 'gift') {
    if (e.streaking) return false; // นับเฉพาะตอน streak จบ
    if (t.giftName && (e.giftName ?? '').trim().toLowerCase() !== t.giftName.trim().toLowerCase()) {
      // ชื่อไม่ตรง (TikTok ส่งชื่อตามภาษาแอปคนส่ง) → เทียบด้วย id ของของขวัญแทน
      const id = giftIdOf(t.giftName);
      if (!id || !e.giftId || id !== e.giftId) return false;
    }
    const value = e.totalValue ?? (e.diamondCount ?? 0) * (e.repeatCount ?? 1);
    // เลือกกิฟต์เฉพาะแล้ว ไม่ใช้มูลค่าขั้นต่ำ (กฎเก่าที่ตั้งคู่กัน เช่น Heart + 99 จะไม่มีวันขึ้น)
    if (!t.giftName && t.minDiamonds != null && value < t.minDiamonds) return false;
  }
  if (e.type === 'chat' && t.keyword) {
    if (!(e.comment ?? '').toLowerCase().includes(t.keyword.toLowerCase())) return false;
  }
  return true;
}

/** คืนรายการ action ที่ต้องยิงสำหรับเหตุการณ์นี้ */
export function evaluate(rules: ActionRule[], e: TikTokEvent): ActionFire[] {
  const out: ActionFire[] = [];
  for (const r of rules) {
    if (ruleMatches(r, e)) out.push({ ruleId: r.id, name: r.name, action: r.action, event: e, ts: Date.now() });
  }
  return out;
}

/** รายการในจอ "เมนูของขวัญ" — บอกผู้ชมว่าส่งอะไรแล้วจะเกิดอะไร */
export interface MenuItem {
  event: RuleTrigger['event'];
  gift?: string;
  th?: string;
  image?: string;
  diamonds?: number;
  minDiamonds?: number;
  keyword?: string;
  label: string;
  kind: RuleAction['type'];
  cards?: number;
}

export function menuItems(rules: ActionRule[]): MenuItem[] {
  const items = rules.filter((r) => r.enabled).map((r): MenuItem => {
    const t = r.trigger, g = t.giftName ? giftInfo(t.giftName) : undefined;
    return {
      event: t.event, gift: t.giftName, th: g?.th, image: g?.image, diamonds: g?.diamonds,
      minDiamonds: t.giftName ? undefined : t.minDiamonds, keyword: t.keyword,
      label: r.name, kind: r.action.type, cards: r.action.cards,
    };
  });
  // ของขวัญเรียงถูก → แพง แล้วตามด้วยแชท/ติดตาม/แชร์
  const rank = (m: MenuItem) => (m.event === 'gift' ? (m.diamonds ?? m.minDiamonds ?? 0) : 1e9 + ['chat', 'follow', 'share', 'like'].indexOf(m.event));
  return items.sort((a, b) => rank(a) - rank(b));
}
