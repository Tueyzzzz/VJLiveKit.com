import { TikTokRoom } from '../tiktok/manager.js';
import { evaluate, type ActionRule } from '../actions/engine.js';
import type { Server } from 'socket.io';
import { loadSession, saveSession } from './sessions.js';
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
  invalidateRules(userId: string): void { this.rulesCache.delete(userId); }

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
    const entry: RoomEntry = { room, viewers: 0, owners: new Map(), stopTimer: null, retryTimer: null, connecting: null, dirty: false, saveTimer: null, restoredFor: null };
    const ch = RoomHub.roomChannel(key);
    room.on('event', (e) => {
      entry.dirty = true;
      this.io.to(ch).emit('tiktok-event', e);
      for (const ownerId of entry.owners.keys()) {
        void this.getRules(ownerId).then((rules) => {
          if (!rules.length) return;
          for (const fire of evaluate(rules, e)) this.io.to(RoomHub.ownerChannel(ownerId, key)).emit('action', fire);
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
    return saveSession(entry.room, ended).catch((err) => console.error('[sessions] save failed', err));
  }

  private connect(key: string, entry: RoomEntry): void {
    entry.connecting = entry.room.connect(this.demo)
      .then(async () => {
        if (this.demo) return;
        // ไลฟ์เดิม (เซิร์ฟเวอร์เพิ่งรีสตาร์ท/deploy) → โหลดสถิติ/อันดับที่บันทึกไว้กลับมา
        // โหลดคืนครั้งเดียวต่อไลฟ์ (TikTok หลุดแล้วต่อใหม่ในเซิร์ฟเวอร์ตัวเดิม → ข้อมูลยังอยู่ในหน่วยความจำ ห้ามบวกซ้ำ)
        if (entry.room.liveRoomId && entry.restoredFor !== entry.room.liveRoomId) {
          entry.restoredFor = entry.room.liveRoomId;
          try { await loadSession(entry.room); } catch (err) { console.error('[sessions] load failed', err); }
        }
        if (!entry.saveTimer) entry.saveTimer = setInterval(() => void this.persist(entry), this.SAVE_MS);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
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

  /** จำนวนห้องที่เชื่อม TikTok อยู่ (กำลังไลฟ์) */
  liveCount(): number { let n = 0; for (const e of this.rooms.values()) if (e.room.isConnected()) n++; return n; }

  async stopAll(): Promise<void> {
    await Promise.all([...this.rooms.keys()].map((k) => this.stop(k)));
  }
}
