import type { TikTokEvent } from '../tiktok/types.js';

/** กฎทริกเกอร์: ถ้าเหตุการณ์เข้าเงื่อนไข trigger ให้ทำ action */
export interface RuleTrigger {
  event: 'gift' | 'follow' | 'share' | 'like' | 'chat';
  giftName?: string;     // เจาะจงชื่อกิฟต์ (เฉพาะ event=gift)
  minDiamonds?: number;  // มูลค่าเพชรขั้นต่ำ (เฉพาะ event=gift)
  keyword?: string;      // คำในแชท (เฉพาะ event=chat)
}

export interface RuleAction {
  type: 'sound' | 'image' | 'video' | 'text' | 'tarot';
  url?: string;
  text?: string;
  durationMs?: number;
  /** สุ่มไพ่ทาโร่: จำนวนใบ 1 | 3 | 7 */
  cards?: number;
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
    if (t.giftName && (e.giftName ?? '').toLowerCase() !== t.giftName.toLowerCase()) return false;
    const value = e.totalValue ?? (e.diamondCount ?? 0) * (e.repeatCount ?? 1);
    if (t.minDiamonds != null && value < t.minDiamonds) return false;
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
