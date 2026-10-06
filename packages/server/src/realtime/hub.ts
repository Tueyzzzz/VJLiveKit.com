import { TikTokRoom } from '../tiktok/manager.js';
import { evaluate, menuItems, type ActionRule, type MenuItem } from '../actions/engine.js';
import type { Server } from 'socket.io';
import { loadSession, saveSession } from './sessions.js';
import { connStats } from './connstats.js';
import { trackLive } from './lives.js';
import { config } from '../config/index.js';

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
  private readonly SAVE_MS = 20_000;

  constructor(private io: Server, private rulesProvider?: RulesProvider, private demo = false) {
    current = this;
  }

  static roomChannel(username: string) { return `room:${normalize(username)}`; }
  static ownerChannel(userId: string, username: string) { return `owner:${userId}:${normalize(username)}`; }
  static configChannel(userId: string, widget: string) { return `cfg:${userId}:${widget}`; }
  /** แดชบอร์ดที่เปิด "ลำโพง" ไว้ (เล่นเสียงจากกฎบนเว็บ แบบ TikFinity) */
  static speakerChannel(userId: string) { return `spk:${userId}`; }
  /** แดชบอร์ดที่เปิดเสียงอยู่ (เสียงกฎดังที่เว็บ → จอ fx ไม่ต้องเล่นซ้ำ) */
  static soundChannel(userId: string) { return `snd:${userId}`; }

  // ---- ล็อกแบบ TikFinity: วิดเจ็ตทำงานเฉพาะตอนวีเจเปิดหน้าเว็บ (แดชบอร์ด) ค้างไว้ ----
  // ประหยัดเซิร์ฟเวอร์: ไม่ต่อ TikTok ให้ลิงก์ที่ถูกทิ้งไว้ใน OBS ตอนวีเจไม่ได้ใช้งาน
  private presence = new Map<string, number>();
  private waiting = new Map<string, Set<{ on: () => void; off: () => void }>>();
  private graceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly PRESENCE_GRACE_MS = 90_000; // รีเฟรช/เปลี่ยนหน้าเว็บ ไม่ทำให้จอดับ

  isPresent(ownerId: string): boolean { return (this.presence.get(ownerId) ?? 0) > 0 || this.graceTimers.has(ownerId); }

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
      if ((this.presence.get(ownerId) ?? 0) === 0) for (const w of this.waiting.get(ownerId) ?? []) w.off();
    }, this.PRESENCE_GRACE_MS));
  }
  /** วิดเจ็ตลงทะเบียนรอ — on() เมื่อแดชบอร์ดเปิด, off() เมื่อปิด · คืนฟังก์ชันยกเลิก */
  watchPresence(ownerId: string, w: { on: () => void; off: () => void }): () => void {
    let set = this.waiting.get(ownerId); if (!set) this.waiting.set(ownerId, (set = new Set()));
    set.add(w);
    return () => { set!.delete(w); if (!set!.size) this.waiting.delete(ownerId); };
  }

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
    const entry: RoomEntry = { room, viewers: 0, owners: new Map(), stopTimer: null, retryTimer: null, connecting: null, dirty: false, saveTimer: null, restoredFor: null, attempts: 0, connectedAt: null, lastError: null, lastErrorAt: null };
    const ch = RoomHub.roomChannel(key);
    room.on('event', (e) => {
      entry.dirty = true;
      this.io.to(ch).emit('tiktok-event', e);
      for (const ownerId of entry.owners.keys()) {
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
        entry.connectedAt = Date.now(); entry.lastError = null;
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
        if (!this.demo) connStats.bump('failed');
        this.io.to(RoomHub.roomChannel(key)).emit('status', {
          type: 'offline', message: `ยังเชื่อมต่อ @${key} ไม่ได้ (ยังไม่ได้ไลฟ์?) จะลองใหม่ใน ${this.RETRY_MS / 1000} วินาที`, detail: message,
        });
        this.scheduleRetry(key, entry);
      })
      .finally(() => { entry.connecting = null; });
  }

  private scheduleRetry(key: string, entry: RoomEntry): void {
    if (entry.retryTimer || this.rooms.get(key) !== entry) return;
    entry.retryTimer = setTimeout(() => {
      entry.retryTimer = null;
      if (this.rooms.get(key) === entry && entry.viewers > 0 && !entry.room.isConnected()) this.connect(key, entry);
    }, this.RETRY_MS);
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
      return { username: key, connected: st.connected, roomId: st.roomId, widgets: e.viewers, owners: e.owners.size,
        diamonds: st.stats.diamondCount, gifts: st.stats.giftCount, likes: st.stats.likeCount, viewers: st.stats.viewerCount ?? 0, topGifter: st.topGifters[0]?.nickname ?? null,
        attempts: e.attempts, connectedAt: e.connectedAt, lastError: e.lastError, lastErrorAt: e.lastErrorAt, retrying: !!e.retryTimer };
    }).sort((a, b) => Number(b.connected) - Number(a.connected) || b.diamonds - a.diamonds);
  }

  /** จำนวนห้องที่เชื่อม TikTok อยู่ (กำลังไลฟ์) */
  liveCount(): number { let n = 0; for (const e of this.rooms.values()) if (e.room.isConnected()) n++; return n; }

  async stopAll(): Promise<void> {
    await Promise.all([...this.rooms.keys()].map((k) => this.stop(k)));
  }
}
