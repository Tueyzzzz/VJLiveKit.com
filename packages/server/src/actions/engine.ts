import type { TikTokEvent } from '../tiktok/types.js';
import { giftIdOf, giftInfo } from '../tiktok/giftCatalog.js';

/** กฎทริกเกอร์: ถ้าเหตุการณ์เข้าเงื่อนไข trigger ให้ทำ action */
export interface RuleTrigger {
  event: 'gift' | 'follow' | 'share' | 'like' | 'chat' | 'pk' | 'chest' | 'superfanbox' | 'join';
  /** PK: start / end (จบทุกผล) / win / lose / draw / anycard / รหัสการ์ด (glove critical smoke ...) (เฉพาะ event=pk) */
  pk?: string;
  /** PK การ์ด: ใช้กับฝั่งไหน (us = ให้เรา · them = คู่แข่ง · ไม่ระบุ = ทั้งคู่) */
  pkSide?: 'us' | 'them';
  giftName?: string;     // เจาะจงชื่อกิฟต์ (เฉพาะ event=gift)
  minDiamonds?: number;  // มูลค่าเพชรขั้นต่ำ (event=gift / chest / superfanbox)
  keyword?: string;      // คำในแชท (เฉพาะ event=chat)
  /** join: ทักครั้งเดียวต่อคนต่อไลฟ์ (ไม่ระบุ = เปิด) */
  joinOnce?: boolean;
  /** join: เว้นระยะกี่วินาทีก่อนทักคนถัดไป (ทั้งกฎ · ไม่ระบุ = 10) */
  cooldownSec?: number;
  /** join: ทักเฉพาะ follower = คนที่ติดตามแล้ว · fan = สมาชิกแฟนคลับ */
  joinWho?: 'follower' | 'fan';
}

export interface RuleAction {
  type: 'sound' | 'image' | 'video' | 'text' | 'tarot' | 'effect' | 'sign' | 'glove' | 'mascot';
  /** มาสคอต: ท่าที่สั่ง */
  move?: 'dance' | 'kiss' | 'joy' | 'heart' | 'walk' | 'spin' | 'jump';
  /** ป้ายไฟ (type=sign) */
  signStyle?: 'led' | 'neon' | 'bulb' | 'cute' | 'pixel' | 'y2k' | 'glass' | 'surreal' | 'boho' | 'victorian' | 'graffiti' | 'future' | 'mwhite' | 'mblack' | 'mline' | 'mpill';
  signMode?: 'scroll' | 'static' | 'blink' | 'pulse';
  signPos?: 'top' | 'center' | 'bottom';
  color?: string;
  /** เอฟเฟกต์เต็มจอ (type=effect) — ผีเสื้อ + อนุภาค 10 แบบ (ซากุระ หัวใจ เหรียญ ดาว หิมะ ฟองสบู่ ลูกโป่ง กลีบกุหลาบ หิ่งห้อย คอนเฟตติ) */
  effect?: 'butterflies' | 'sakura' | 'hearts' | 'coins' | 'stars' | 'snow' | 'bubbles' | 'balloons' | 'roses' | 'fireflies' | 'confetti' | 'vcake' | 'vcat' | 'vchicks' | 'animal';
  /** effect=animal: ตัวสัตว์น่ารัก (สไปรต์ 6 เฟรม overlay/public/fx/animals/<ชื่อ>/) */
  animal?: 'catshake' | 'dogshake' | 'catdance' | 'dogdance' | 'bunnyhop' | 'pandawave' | 'hamsterspin' | 'penguinslide' | 'capybara' | 'duckwalk' | 'frogjump' | 'bearhug' | 'catpunch' | 'dogspin' | 'catshock' | 'dogwag' | 'owlblink' | 'pigdance' | 'foxtail' | 'corgiwiggle';
  /** สีผีเสื้อ (ค่าเริ่มต้น ชมพูสีเดียว) */
  tint?: 'pink' | 'blue' | 'purple' | 'mint' | 'gold' | 'rainbow';
  /** จำนวนตัว/ชิ้นของเอฟเฟกต์ */
  count?: number;
  /** ส่งคอมโบ (เช่น กุหลาบ 100 ดอก) เล่นซ้ำได้สูงสุดกี่ครั้ง — ค่าเริ่มต้น 1 · ไพ่ทาโร่ล็อก 1 เสมอ */
  repeat?: number;
  /** ความดังเสียง 0–1.5 (1 = ปกติ) */
  volume?: number;
  /** ปุ่มลัดคีย์บอร์ด (เล่นเสียงเองจากแดชบอร์ด) */
  key?: string;
  url?: string;
  /** เสียงสำเร็จรูป (ไม่ต้องมีไฟล์) เช่น chime · coin · fanfare */
  sound?: string;
  text?: string;
  durationMs?: number;
  /** สุ่มไพ่ทาโร่: จำนวนใบ 1 | 3 | 7 */
  cards?: number;
  /** สำรับที่สุ่ม: ทั้งสำรับ / ชุดใหญ่ / เฉพาะชุดไม้เท้า·ถ้วย·ดาบ·เหรียญ */
  deck?: 'full' | 'major' | 'wands' | 'cups' | 'swords' | 'pentacles' | 'lakshmi'; // lakshmi = ไพ่พระแม่ลักษมี (ความรัก) 52 ใบ
  /** หัวข้อคำทำนาย: ทั่วไป | ความรัก | ตัวตน | การเงิน */
  topic?: 'general' | 'love' | 'self' | 'money' | 'daily';
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
  /** จำนวนครั้งที่ให้เล่น (ตามจำนวนชิ้นในคอมโบ ไม่เกิน repeat) */
  times?: number;
}

/** ตรวจว่าเหตุการณ์หนึ่งเข้ากฎข้อนี้ไหม */
export function ruleMatches(rule: ActionRule, e: TikTokEvent): boolean {
  if (!rule.enabled) return false;
  const t = rule.trigger;
  if (t.event !== (e.type === 'member' ? 'join' : e.type)) return false; // join = อีเวนต์ member (มีคนเข้าห้อง)

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
  if (e.type === 'chest' || e.type === 'superfanbox') { // กล่องสมบัติ / ถุงม่วง: กรองด้วยเพชรในกล่องได้
    if (t.minDiamonds != null && (e.chest?.diamonds ?? 0) < t.minDiamonds) return false;
  }
  if (e.type === 'member') { // มีคนเข้าห้อง: เฉพาะคนที่ติดตาม/แฟนคลับ (ข้อมูลจาก TikTok)
    if (t.joinWho === 'follower' && !e.fan?.follower) return false;
    if (t.joinWho === 'fan' && !e.fan?.club) return false;
  }
  if (e.type === 'pk') { // PK: เริ่ม / ผลแพ้ชนะ / การ์ด
    const k = e.pk; if (!k || !t.pk) return false;
    if (t.pk === 'start') return k.kind === 'start';
    if (t.pk === 'end') return k.kind === 'end'; // จบ PK ทุกผล (ประกาศ MVP)
    if (t.pk === 'win' || t.pk === 'lose' || t.pk === 'draw') return k.kind === 'end' && k.result === t.pk;
    if (k.kind !== 'card') return false;
    if (t.pk !== 'anycard' && t.pk !== k.card) return false;
    if (t.pkSide && k.side && t.pkSide !== k.side) return false;
    return true;
  }
  if (e.type === 'chat' && t.keyword) {
    if (!(e.comment ?? '').toLowerCase().includes(t.keyword.toLowerCase())) return false;
  }
  return true;
}

/** กันสแปม "มีคนเข้าห้อง" ต่อกฎ: คนที่ทักแล้วในไลฟ์นี้ + เวลาที่ทักล่าสุด */
interface JoinState { session: string; greeted: Set<string>; last: number }
const joinStates = new Map<string, JoinState>();

/** ผ่านด่านกันสแปมของกฎ join ไหม (ผ่าน = จดว่าทักแล้ว) · session = รหัสไลฟ์ เปลี่ยนไลฟ์ = เริ่มนับใหม่ */
export function joinAllowed(r: ActionRule, e: TikTokEvent, session = '', now = Date.now()): boolean {
  let st = joinStates.get(r.id);
  if (!st || st.session !== session) {
    st = { session, greeted: new Set(), last: 0 };
    joinStates.delete(r.id); joinStates.set(r.id, st);
    if (joinStates.size > 5000) joinStates.delete(joinStates.keys().next().value!);
  }
  const who = e.user?.userId || e.user?.uniqueId || '';
  const once = r.trigger.joinOnce !== false;
  if (once && who && st.greeted.has(who)) return false;
  const cd = Math.max(0, Math.min(3600, r.trigger.cooldownSec ?? 10)) * 1000;
  if (cd && now - st.last < cd) return false;
  st.last = now;
  if (once && who) { st.greeted.add(who); if (st.greeted.size > 20000) st.greeted.delete(st.greeted.values().next().value!); }
  return true;
}

/** คืนรายการ action ที่ต้องยิงสำหรับเหตุการณ์นี้ · session = รหัสไลฟ์ (กฎ join ทักครั้งเดียวต่อคนต่อไลฟ์) */
export function evaluate(rules: ActionRule[], e: TikTokEvent, session = ''): ActionFire[] {
  const out: ActionFire[] = [];
  for (const r of rules) {
    if (!ruleMatches(r, e)) continue;
    if (e.type === 'member' && !joinAllowed(r, e, session)) continue;
    const limit = r.action.type === 'tarot' ? 1 : Math.max(1, Math.min(20, r.action.repeat ?? 1));
    const times = e.type === 'gift' ? Math.min(limit, Math.max(1, e.repeatCount ?? 1)) : 1;
    out.push({ ruleId: r.id, name: r.name, action: r.action, event: e, ts: Date.now(), times });
  }
  return out;
}

/** รายการในจอ "เมนูของขวัญ" — บอกผู้ชมว่าส่งอะไรแล้วจะเกิดอะไร */
export interface MenuItem {
  id: string;
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
  const items = rules.filter((r) => r.enabled && r.trigger.event !== 'pk' && r.trigger.event !== 'join').map((r): MenuItem => { // PK / มีคนเข้าห้อง ไม่ขึ้นเมนูของขวัญ
    const t = r.trigger, g = t.giftName ? giftInfo(t.giftName) : undefined;
    return {
      id: r.id, event: t.event, gift: t.giftName, th: g?.th, image: g?.image, diamonds: g?.diamonds,
      minDiamonds: t.giftName ? undefined : t.minDiamonds, keyword: t.keyword,
      label: r.name, kind: r.action.type, cards: r.action.cards,
    };
  });
  // ของขวัญเรียงถูก → แพง แล้วตามด้วยแชท/ติดตาม/แชร์
  const rank = (m: MenuItem) => (m.event === 'gift' ? (m.diamonds ?? m.minDiamonds ?? 0) : 1e9 + ['chat', 'follow', 'share', 'like', 'chest', 'superfanbox'].indexOf(m.event));
  return items.sort((a, b) => rank(a) - rank(b));
}
