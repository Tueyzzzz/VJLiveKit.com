import { TikTokRoom } from '../tiktok/manager.js';
import { evaluate, menuItems, type ActionRule, type MenuItem } from '../actions/engine.js';
import type { Server } from 'socket.io';
import { loadSession, saveSession } from './sessions.js';
import { connStats } from './connstats.js';
import { trackLive, listLives } from './lives.js';
import { settings } from '../settings/index.js';
import { config } from '../config/index.js';
import fs from 'node:fs';
import path from 'node:path';

/**
 * "สิทธิ์ไลฟ์" ของวีเจที่กำลังไลฟ์อยู่ — เก็บลงดิสก์ ให้ deploy/รีสตาร์ทกลางไลฟ์แล้ววิดเจ็ตไม่ถูกพัก (ล็อกวิดเจ็ตเปิดอยู่)
 * ต่ออายุทุกนาทีระหว่างไลฟ์ · ไลฟ์จบแล้วหมดอายุเองใน 15 นาที
 */
const GRANT_FILE = path.join(process.env.SNAPSHOT_DIR ? path.dirname(process.env.SNAPSHOT_DIR) : path.resolve(process.cwd(), '../../data'), 'live-grants.json');
const GRANT_MS = 15 * 60_000;
const grants = new Map<string, number>();
try { for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(GRANT_FILE, 'utf8')) as Record<string, number>)) if (v > Date.now()) grants.set(k, v); } catch { /* ยังไม่มีไฟล์ */ }
let grantSave: ReturnType<typeof setTimeout> | null = null;
function saveGrants(): void {
  if (grantSave) return;
  grantSave = setTimeout(() => {
    grantSave = null;
    try { fs.mkdirSync(path.dirname(GRANT_FILE), { recursive: true }); fs.writeFileSync(GRANT_FILE, JSON.stringify(Object.fromEntries(grants))); } catch { /* ignore */ }
  }, 2000);
}

/** โหลดกฎ Actions ที่เปิดใช้ของผู้ใช้หนึ่งคน */
export type RulesProvider = (userId: string) => Promise<ActionRule[]>;

interface RoomEntry {
  room: TikTokRoom;
  /** จำนวน socket ที่ดูห้องนี้อยู่ */
  viewers: number;
  /** ผู้ใช้ (เจ้าของ overlay token) ที่ดูห้องนี้ -> จำนวน socket — ใช้ยิง Actions แยกรายคน */
  owners: Map<string, number>;
  stopTimer: NodeJS.Timeout | null;
  retryTimer: NodeJS.Timeout | null;
  connecting: Promise<void> | null;
  /** มีอีเวนต์ใหม่ที่ยังไม่ได้บันทึกลงฐานข้อมูล */
  dirty: boolean;
  saveTimer: NodeJS.Timeout | null;
  attempts: number;
  /** ต่อไม่ติดติดกันกี่ครั้ง (ยังไม่ไลฟ์) → ยิ่งนานยิ่งเว้นช่วงลองใหม่ */
  fails: number;
  connectedAt: number | null;
  lastError: string | null;
  lastErrorAt: number | null;
  /** roomId ที่โหลดสถิติที่บันทึกไว้กลับมาแล้ว (กันบวกซ้ำ) */
  restoredFor: string | null;
}

const normalize = (username: string) => username.replace(/^@/, '').trim().toLowerCase();

let current: RoomHub | null = null;
/** เข้าถึง hub จาก route อื่น (เช่น ล้างแคชกฎหลังแก้ไข) — null ถ้ายังไม่ได้เปิด realtime */
export function getHub(): RoomHub | null { return current; }

/**
 * จัดการหลายห้องไลฟ์พร้อมกัน (หนึ่ง TikTok username = หนึ่งการเชื่อมต่อ)
 * - relay อีเวนต์ไปยัง channel `room:<username>`
 * - ประเมิน Actions & Events ของ "เจ้าของ overlay แต่ละคน" แล้วยิง 'action' ไปที่ `owner:<userId>:<username>`
 * - ไม่มีคนดู -> ปิดการเชื่อมต่อหลัง grace period, ต่อไม่ติด (ยังไม่ไลฟ์) -> retry เป็นระยะ
 * หมายเหตุ: in-memory — ถ้าสเกลหลาย instance ให้ใช้ Redis adapter
 */
export class RoomHub {
  private rooms = new Map<string, RoomEntry>();
  private rulesCache = new Map<string, { rules: ActionRule[]; at: number }>();
  private readonly RULES_TTL = 30_000;
  private readonly IDLE_STOP_MS = 60_000;
  private readonly RETRY_MS = 30_000;
  private readonly RETRY_MAX_MS = 120_000;
  private readonly SAVE_MS = 20_000;

  constructor(private io: Server, private rulesProvider?: RulesProvider, private demo = false) {
    current = this;
    // ทุก 3 นาที: ห้องที่ระบบคิดว่ายังไลฟ์ → ถาม TikTok ซ้ำ ถ้าจบแล้วแต่สัญญาณจบไม่มา ให้ปิดเอง (กันสถานะ "ไลฟ์อยู่" ค้าง)
    if (!demo) setInterval(() => {
      for (const e of this.rooms.values()) if (e.room.getState().connected) this.grantLive(e);
      // สิทธิ์ไลฟ์หมดอายุ (ไลฟ์จบแล้ว) + ไม่ได้เปิดเว็บ → พักวิดเจ็ตที่ไม่ได้ไลฟ์ (เหมือนปิดเว็บ)
      for (const [id, until] of grants) if (until < Date.now()) { grants.delete(id); saveGrants(); if (!this.presence.get(id) && !this.graceTimers.has(id)) this.pauseIdle(id); }
    }, 60_000).unref();
    if (!demo) setInterval(() => {
      for (const e of this.rooms.values()) {
        if (!e.room.getState().connected) continue;
        void e.room.checkLive().then((live) => { if (live === false) { console.log('[hub] stale live → end', e.room.username); e.room.endStale(); } });
      }
    }, 3 * 60_000).unref();
  }

  static roomChannel(username: string) { return `room:${normalize(username)}`; }
  static ownerChannel(userId: string, username: string) { return `owner:${userId}:${normalize(username)}`; }
  static configChannel(userId: string, widget: string) { return `cfg:${userId}:${widget}`; }
  /** แดชบอร์ดที่เปิด "ลำโพง" ไว้ (เล่นเสียงจากกฎบนเว็บ แบบ TikFinity) */
  static speakerChannel(userId: string) { return `spk:${userId}`; }
  /** แดชบอร์ดที่เปิดเสียงอยู่ (เสียงกฎดังที่เว็บ → จอ fx ไม่ต้องเล่นซ้ำ) */
  static soundChannel(userId: string) { return `snd:${userId}`; }
  /** แดชบอร์ดที่รับอีเวนต์ไปอ่านออกเสียง (TTS แบบ TikFinity — เสียงดังที่หน้าเว็บ) */
  static ttsChannel(userId: string) { return `tts:${userId}`; }

  // ---- ล็อกแบบ TikFinity: วิดเจ็ตทำงานเฉพาะตอนวีเจเปิดหน้าเว็บ (แดชบอร์ด) ค้างไว้ ----
  // ประหยัดเซิร์ฟเวอร์: ไม่ต่อ TikTok ให้ลิงก์ที่ถูกทิ้งไว้ใน OBS ตอนวีเจไม่ได้ใช้งาน
  private presence = new Map<string, number>();
  private waiting = new Map<string, Set<{ on: () => void; off: () => void; room?: string }>>();
  private graceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private get PRESENCE_GRACE_MS() { return settings().presenceGraceSec * 1000; } // รีเฟรช/เปลี่ยนหน้าเว็บ ไม่ทำให้จอดับ (ปรับได้)

  /** วีเจคนนี้เปิดเว็บอยู่ไหม (หน้าแอดมิน) */
  webOpen(ownerId: string): boolean { return (this.presence.get(ownerId) ?? 0) > 0; }

  isPresent(ownerId: string): boolean { if (!settings().presenceLock) return true; return (this.presence.get(ownerId) ?? 0) > 0 || this.graceTimers.has(ownerId) || (grants.get(ownerId) ?? 0) > Date.now(); }
  /** ห้องนี้กำลังไลฟ์ → เจ้าของวิดเจ็ตทุกคนในห้องได้ "สิทธิ์ไลฟ์" ต่ออีก 15 นาที */
  private grantLive(entry: RoomEntry): void {
    const until = Date.now() + GRANT_MS;
    for (const id of entry.owners.keys()) grants.set(id, until);
    for (const [k, v] of grants) if (v < Date.now()) grants.delete(k);
    saveGrants();
  }

  /** แดชบอร์ดเปิด/ปิด → ปลุก/พักวิดเจ็ตของวีเจคนนั้น */
  presenceUp(ownerId: string): void {
    const n = (this.presence.get(ownerId) ?? 0) + 1; this.presence.set(ownerId, n);
    const g = this.graceTimers.get(ownerId);
    if (g) { clearTimeout(g); this.graceTimers.delete(ownerId); }
    else if (n === 1) for (const w of this.waiting.get(ownerId) ?? []) w.on();
  }
  presenceDown(ownerId: string): void {
    const n = Math.max(0, (this.presence.get(ownerId) ?? 1) - 1);
    if (n > 0) { this.presence.set(ownerId, n); return; }
    this.presence.delete(ownerId);
    this.graceTimers.set(ownerId, setTimeout(() => {
      this.graceTimers.delete(ownerId);
      this.pauseIdle(ownerId);
    }, this.PRESENCE_GRACE_MS));
  }
  /**
   * ปิดเว็บแล้ว → พักเฉพาะวิดเจ็ตที่ "ไม่ได้ไลฟ์อยู่" · ถ้ากำลังไลฟ์ ให้ทำงานต่อจนไลฟ์จบ (ของขวัญห้ามหายกลางไลฟ์)
   * แล้วเช็กซ้ำทุก 2 นาที จนกว่าจะเปิดเว็บกลับมา หรือไลฟ์จบแล้วค่อยพัก
   */
  private pauseIdle(ownerId: string): void {
    if ((this.presence.get(ownerId) ?? 0) > 0 || !settings().presenceLock) return;
    let busy = false;
    for (const w of this.waiting.get(ownerId) ?? []) {
      if (w.room && this.rooms.get(normalize(w.room))?.room.getState().connected) busy = true;
      else w.off();
    }
    if (busy) this.graceTimers.set(ownerId, setTimeout(() => { this.graceTimers.delete(ownerId); this.pauseIdle(ownerId); }, 2 * 60_000));
  }
  /** ปิดล็อกวิดเจ็ตจากหน้าแอดมิน → ปลุกวิดเจ็ตที่พักอยู่ทุกตัวทันที (ไม่ต้องรอวีเจเปิดเว็บ/รีโหลดจอ) */
  wakeAll(): number { let n = 0; for (const set of this.waiting.values()) for (const w of set) { w.on(); n++; } return n; }
  /** วิดเจ็ตลงทะเบียนรอ — on() เมื่อแดชบอร์ดเปิด, off() เมื่อปิด · คืนฟังก์ชันยกเลิก */
  watchPresence(ownerId: string, w: { on: () => void; off: () => void; room?: string }): () => void {
    let set = this.waiting.get(ownerId); if (!set) this.waiting.set(ownerId, (set = new Set()));
    set.add(w);
    return () => { set!.delete(w); if (!set!.size) this.waiting.delete(ownerId); };
  }

  /** ส่งถึงหน้าเว็บ (แดชบอร์ด) ของผู้ใช้ที่เปิดอยู่ — เช่น แอดมินตอบแชท */
  emitUser(userId: string, event: string, payload: unknown): void { this.io.to(RoomHub.speakerChannel(userId)).emit(event, payload); }
  /** ส่งถึงหน้าเว็บของแอดมินทุกคนที่เปิดอยู่ */
  emitAdmins(event: string, payload: unknown): void { this.io.to('admins').emit(event, payload); }

  /** ส่งอีเวนต์ให้ overlay ของเจ้าของ (เช่น โดเนทที่ยืนยันแล้ว) */
  emitOwner(userId: string, username: string, event: string, payload: unknown): void {
    this.io.to(RoomHub.ownerChannel(userId, username)).emit(event, payload);
  }

  /**
   * ส่ง action ไปที่จอ fx + แดชบอร์ด
   * กฎ "เล่นเสียง" + มีแดชบอร์ดเปิดลำโพงอยู่ → เสียงออกที่แดชบอร์ด จอ fx ไม่ต้องเล่นซ้ำ (elsewhere)
   */
  fireAction(ownerId: string, username: string, fire: object & { action: { type: string } }): void {
    const spk = RoomHub.speakerChannel(ownerId);
    const speakers = this.io.sockets.adapter.rooms.get(RoomHub.soundChannel(ownerId))?.size ?? 0;
    this.io.to(spk).emit('action', fire);
    this.io.to(RoomHub.ownerChannel(ownerId, username)).emit('action', speakers && fire.action.type === 'sound' ? { ...fire, elsewhere: true } : fire);
  }

  /** ยิงให้ overlay ของเจ้าของ แล้วคืนจำนวนจอที่เปิดรับอยู่ (ใช้ปุ่ม "ทดลองเล่น") */
  async emitOwnerCount(userId: string, username: string, event: string, payload: unknown): Promise<number> {
    const ch = RoomHub.ownerChannel(userId, username);
    if (event === 'action') this.fireAction(userId, username, payload as { action: { type: string } });
    else this.io.to(ch).emit(event, payload);
    return (await this.io.in(ch).fetchSockets()).length + (event === 'action' ? (await this.io.in(RoomHub.speakerChannel(userId)).fetchSockets()).length : 0);
  }

  /** ส่งตั้งค่าวิดเจ็ตใหม่ให้ overlay ที่เปิดอยู่ของผู้ใช้ (หลังบันทึกใน Dashboard) */
  pushConfig(userId: string, widget: string, settings: unknown): void {
    this.io.to(RoomHub.configChannel(userId, widget)).emit('config', settings ?? {});
  }

  private async getRules(userId: string): Promise<ActionRule[]> {
    if (!this.rulesProvider) return [];
    const cached = this.rulesCache.get(userId);
    if (cached && Date.now() - cached.at < this.RULES_TTL) return cached.rules;
    let rules: ActionRule[] = [];
    try { rules = await this.rulesProvider(userId); } catch { rules = []; }
    this.rulesCache.set(userId, { rules, at: Date.now() });
    return rules;
  }

  /** ล้างแคชกฎของผู้ใช้ (เรียกหลัง CRUD /api/actions ให้มีผลทันที) */
  invalidateRules(userId: string): void {
    this.rulesCache.delete(userId);
    void this.menuFor(userId).then((m) => this.io.to(RoomHub.configChannel(userId, 'fxmenu')).emit('menu', m)); // จอเมนูอัปเดตทันที
  }

  /** รายการเมนูของขวัญของวีเจ (จากกฎ Actions ที่เปิดอยู่) */
  async menuFor(userId: string): Promise<MenuItem[]> { return menuItems(await this.getRules(userId)); }

  /**
   * เปิดเซิร์ฟเวอร์ใหม่ (deploy): ต่อห้องที่กำลังไลฟ์อยู่ล่วงหน้า ระหว่างที่ตัวเก่ายังรับอยู่ → ไม่มีช่วงที่ของขวัญหลุด
   * ตัวใหม่จดของขวัญไว้ (recentGifts) วิดเจ็ตย้ายมาแล้วเติมชิ้นที่พลาดได้ครบ · ถ้าไม่มีใครต่อเข้ามาใน 3 นาที ปล่อยห้องตามปกติ
   */
  warmUp(): void {
    const cut = Date.now() - 10 * 60_000;
    const rooms = [...new Set(listLives().filter((l) => !l.ended && new Date(l.lastSeenAt).getTime() > cut).map((l) => l.username))];
    for (const u of rooms) {
      void this.attach(u).then(() => setTimeout(() => this.detach(u), 3 * 60_000)).catch(() => {});
    }
    if (rooms.length) console.log('[hub] warm-up rooms', rooms.length);
  }

  /** มี socket เข้ามาดูห้อง — สร้าง/เชื่อมต่อถ้ายังไม่มี แล้วคืน state ปัจจุบัน */
  async attach(username: string, ownerId?: string): Promise<ReturnType<TikTokRoom['getState']>> {
    const key = normalize(username);
    let entry = this.rooms.get(key);
    if (!entry) {
      entry = this.create(key);
      this.rooms.set(key, entry);
    }
    if (entry.stopTimer) { clearTimeout(entry.stopTimer); entry.stopTimer = null; }
    entry.viewers++;
    if (ownerId) entry.owners.set(ownerId, (entry.owners.get(ownerId) ?? 0) + 1);
    if (!entry.room.isConnected() && !entry.connecting && !entry.retryTimer) this.connect(key, entry);
    if (entry.connecting) await entry.connecting;
    return entry.room.getState();
  }

  /** socket ออกจากห้อง — ถ้าไม่เหลือใครดูจะปิดหลัง IDLE_STOP_MS */
  detach(username: string, ownerId?: string): void {
    const key = normalize(username);
    const entry = this.rooms.get(key);
    if (!entry) return;
    entry.viewers = Math.max(0, entry.viewers - 1);
    if (ownerId) {
      const n = (entry.owners.get(ownerId) ?? 1) - 1;
      if (n <= 0) entry.owners.delete(ownerId); else entry.owners.set(ownerId, n);
    }
    if (entry.viewers === 0 && !entry.stopTimer) {
      entry.stopTimer = setTimeout(() => void this.stop(key), this.IDLE_STOP_MS);
    }
  }

  private create(key: string): RoomEntry {
    const room = new TikTokRoom(key);
    const entry: RoomEntry = { room, viewers: 0, owners: new Map(), stopTimer: null, retryTimer: null, connecting: null, dirty: false, saveTimer: null, restoredFor: null, attempts: 0, fails: 0, connectedAt: null, lastError: null, lastErrorAt: null };
    const ch = RoomHub.roomChannel(key);
    room.on('event', (e) => {
      entry.dirty = true;
      this.io.to(ch).emit('tiktok-event', e);
      // TTS: ส่งเฉพาะที่อ่านได้ (แชท/ของขวัญจบคอมโบ/ติดตาม/แชร์) ขนาดเล็ก ไปที่หน้าเว็บของเจ้าของ
      const speak = e.type === 'chat' || e.type === 'follow' || e.type === 'share' || (e.type === 'gift' && !e.streaking);
      const lite = speak ? { type: e.type, user: e.user ? { uniqueId: e.user.uniqueId, nickname: e.user.nickname } : undefined, comment: e.comment, giftName: e.giftName, repeatCount: e.repeatCount, value: e.totalValue ?? (e.diamondCount ?? 0) * (e.repeatCount ?? 1) } : null;
      for (const ownerId of entry.owners.keys()) {
        if (lite) this.io.to(RoomHub.ttsChannel(ownerId)).emit('tts', lite);
        void this.getRules(ownerId).then((rules) => {
          if (!rules.length) return;
          for (const fire of evaluate(rules, e)) this.fireAction(ownerId, key, fire);
        });
      }
    });
    room.on('stats', (s) => this.io.to(ch).emit('stats', s));
    room.on('status', (s) => {
      this.io.to(ch).emit('status', s);
      // หลุด/ไลฟ์จบ -> บันทึกสถิติ แล้วลองต่อใหม่ถ้ายังมีคนดู
      if (s.type === 'disconnected' || s.type === 'streamEnd') void this.persist(entry, s.type === 'streamEnd');
      if ((s.type === 'disconnected' || s.type === 'streamEnd') && entry.viewers > 0) this.scheduleRetry(key, entry);
    });
    return entry;
  }

  /** บันทึกสถิติไลฟ์ลงฐานข้อมูล (ไม่ให้ error ทำห้องล่ม) */
  private persist(entry: RoomEntry, ended = false): Promise<void> {
    if (this.demo || !entry.room.liveRoomId || (!entry.dirty && !ended)) return Promise.resolve();
    entry.dirty = false;
    const st = entry.room.getState().stats;
    trackLive(entry.room.liveRoomId, entry.room.username, { diamonds: st.diamondCount, gifts: st.giftCount, likes: st.likeCount, peakViewers: entry.room.peakViewers }, ended);
    return saveSession(entry.room, ended).catch((err) => console.error('[sessions] save failed', err));
  }

  private connect(key: string, entry: RoomEntry): void {
    if (!this.demo) connStats.bump('attempt');
    entry.attempts++;
    entry.connecting = entry.room.connect(this.demo)
      .then(async () => {
        // TikTok บางทีให้ต่อเข้าห้องที่ไลฟ์จบไปแล้วได้ (ห้องค้าง) → ถามซ้ำว่าไลฟ์อยู่จริงไหม ไม่ไลฟ์ = ถือว่ายังไม่ได้ไลฟ์ แล้วลองใหม่ทีหลัง
        if (!this.demo && (await entry.room.checkLive()) === false) {
          await entry.room.disconnect().catch(() => {});
          throw new Error('ยังไม่ได้เริ่มไลฟ์ (ห้องเก่าที่จบแล้ว)');
        }
        entry.connectedAt = Date.now(); entry.lastError = null; entry.fails = 0;
        if (!this.demo) this.grantLive(entry);
        if (this.demo) return;
        connStats.bump('success');
        // ไลฟ์เดิม (เซิร์ฟเวอร์เพิ่งรีสตาร์ท/deploy) → โหลดสถิติ/อันดับที่บันทึกไว้กลับมา
        // room.connect() ล้างสถิติในหน่วยความจำทุกครั้ง → โหลดของไลฟ์เดิมคืนทุกครั้งที่ต่อสำเร็จ (ไม่บวกซ้ำ)
        if (entry.room.liveRoomId) {
          trackLive(entry.room.liveRoomId, entry.room.username, {}); // นับไลฟ์ (หน้าแอดมิน)
          entry.restoredFor = entry.room.liveRoomId;
          try { await loadSession(entry.room); } catch (err) { console.error('[sessions] load failed', err); }
        }
        if (!entry.saveTimer) entry.saveTimer = setInterval(() => void this.persist(entry), this.SAVE_MS);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        entry.lastError = message.slice(0, 300); entry.lastErrorAt = Date.now(); entry.connectedAt = null;
        if (!this.demo) connStats.bump((err as { precheck?: boolean })?.precheck ? 'skipped' : 'failed'); // เช็กล่วงหน้าแล้วยังไม่ไลฟ์ = ไม่ได้ใช้โควตา
        this.io.to(RoomHub.roomChannel(key)).emit('status', {
          type: 'offline', message: `ยังเชื่อมต่อ @${key} ไม่ได้ (ยังไม่ได้ไลฟ์?) ระบบจะลองต่อใหม่ให้เอง`, detail: message,
        });
        this.scheduleRetry(key, entry);
      })
      .finally(() => { entry.connecting = null; });
  }

  private scheduleRetry(key: string, entry: RoomEntry): void {
    if (entry.retryTimer || this.rooms.get(key) !== entry) return;
    // ยังไม่ไลฟ์: ลองใหม่ 30 วิ → 60 วิ → ทุก 2 นาที (สุ่มเหลื่อม ±15% ไม่ให้ทุกห้องยิง TikTok พร้อมกัน)
    const n = ++entry.fails, delay = Math.min(this.RETRY_MAX_MS, this.RETRY_MS * 2 ** Math.min(n - 1, 3)) * (0.85 + Math.random() * 0.3);
    entry.retryTimer = setTimeout(() => {
      entry.retryTimer = null;
      if (this.rooms.get(key) === entry && entry.viewers > 0 && !entry.room.isConnected()) this.connect(key, entry);
    }, delay);
  }

  get(username: string): TikTokRoom | undefined { return this.rooms.get(normalize(username))?.room; }

  async stop(username: string): Promise<void> {
    const key = normalize(username);
    const entry = this.rooms.get(key);
    if (!entry) return;
    this.rooms.delete(key);
    if (entry.stopTimer) clearTimeout(entry.stopTimer);
    if (entry.retryTimer) clearTimeout(entry.retryTimer);
    if (entry.saveTimer) clearInterval(entry.saveTimer);
    await this.persist(entry); // ปิดเซิร์ฟเวอร์ (deploy) → บันทึกให้ทันก่อน
    await entry.room.disconnect();
  }

  /** รายการห้องทั้งหมด (หน้าแอดมิน) */
  listRooms() {
    return [...this.rooms.entries()].map(([key, e]) => {
      const st = e.room.getState();
      // ไลฟ์อยู่จริง = ต่ออยู่ และมีอีเวนต์ (คนดู/แชท/กิฟต์) ภายใน 3 นาที — กันสถานะค้างตอนไลฟ์จบแต่ TikTok ไม่ส่งสัญญาณจบ
      const fresh = Date.now() - Math.max(e.room.lastActivityAt, e.connectedAt ?? 0) < 3 * 60_000;
      return { username: key, connected: st.connected && fresh, roomId: st.roomId, widgets: e.viewers, owners: e.owners.size,
        diamonds: st.stats.diamondCount, gifts: st.stats.giftCount, likes: st.stats.likeCount, viewers: st.stats.viewerCount ?? 0, topGifter: st.topGifters[0]?.nickname ?? null,
        attempts: e.attempts, connectedAt: e.connectedAt, lastError: e.lastError, lastErrorAt: e.lastErrorAt, retrying: !!e.retryTimer };
    }).sort((a, b) => Number(b.connected) - Number(a.connected) || b.diamonds - a.diamonds);
  }

  /** แอดมิน: สั่งวิดเจ็ตทุกตัวของห้องนี้รีโหลด (กองของขวัญบันทึกก่อนรีโหลด + เติมชิ้นที่พลาดจากเซิร์ฟเวอร์) · คืนจำนวนจอที่ได้รับ */
  async reloadRoom(username: string): Promise<number> {
    const ch = RoomHub.roomChannel(username);
    const n = (await this.io.in(ch).fetchSockets()).length;
    this.io.to(ch).emit('reload', { at: Date.now() });
    return n;
  }
  /** แอดมิน: ของขวัญล่าสุดของห้อง (ใหม่สุดก่อน) */
  recentGifts(username: string, limit = 60) {
    const e = this.rooms.get(normalize(username));
    if (!e) return null;
    return e.room.getState().recentGifts.slice(-limit).reverse().map((g) => {
      const x = g as unknown as { ts?: number; user?: { nickname?: string; uniqueId?: string }; giftName?: string; giftImage?: string; diamondCount?: number; repeatCount?: number };
      return { ts: x.ts ?? 0, user: x.user?.nickname || x.user?.uniqueId || '?', gift: x.giftName ?? '', img: x.giftImage ?? '', d: x.diamondCount ?? 0, n: x.repeatCount ?? 1 };
    });
  }

  /** แอดมิน: อีเวนต์ PK ดิบล่าสุดของห้อง (ตรวจว่า TikTok ส่งอะไรมา) */
  pkLog(username: string) { return this.rooms.get(normalize(username))?.room.pkLog ?? null; }

  /** จำนวนห้องที่เชื่อม TikTok อยู่ (กำลังไลฟ์) */
  liveCount(): number { let n = 0; for (const e of this.rooms.values()) if (e.room.isConnected()) n++; return n; }

  async stopAll(): Promise<void> {
    await Promise.all([...this.rooms.keys()].map((k) => this.stop(k)));
  }
}
