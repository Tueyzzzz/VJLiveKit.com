import { TikTokRoom } from '../tiktok/manager.js';
import { evaluate, type ActionRule } from '../actions/engine.js';
import type { Server } from 'socket.io';

export type RulesProvider = (username: string) => Promise<ActionRule[]>;

/**
 * จัดการหลายห้องไลฟ์พร้อมกัน (หนึ่ง username = หนึ่งห้อง)
 * - relay อีเวนต์ไปยัง socket channel ของ username
 * - ประเมิน Actions & Events แล้วยิง 'action' ให้ overlay fx
 * หมายเหตุ: in-memory — ถ้าสเกลหลาย instance ให้ใช้ Redis adapter
 */
export class RoomHub {
  private rooms = new Map<string, TikTokRoom>();
  // แคชกฎต่อ username (กัน query DB ทุกอีเวนต์)
  private rulesCache = new Map<string, { rules: ActionRule[]; at: number }>();
  private RULES_TTL = 30_000;

  constructor(private io: Server, private rulesProvider?: RulesProvider) {}

  private channel(username: string) { return `room:${username}`; }

  private async getRules(username: string): Promise<ActionRule[]> {
    if (!this.rulesProvider) return [];
    const cached = this.rulesCache.get(username);
    if (cached && Date.now() - cached.at < this.RULES_TTL) return cached.rules;
    let rules: ActionRule[] = [];
    try { rules = await this.rulesProvider(username); } catch { rules = []; }
    this.rulesCache.set(username, { rules, at: Date.now() });
    return rules;
  }

  async ensure(username: string, demo?: boolean): Promise<TikTokRoom> {
    const key = username.replace(/^@/, '').trim();
    let room = this.rooms.get(key);
    if (room) return room;

    room = new TikTokRoom(key);
    const ch = this.channel(key);
    room.on('event', (e) => {
      this.io.to(ch).emit('tiktok-event', e);
      // ประเมิน Actions & Events
      void this.getRules(key).then((rules) => {
        if (!rules.length) return;
        for (const fire of evaluate(rules, e)) this.io.to(ch).emit('action', fire);
      });
    });
    room.on('stats', (s) => this.io.to(ch).emit('stats', s));
    room.on('status', (s) => this.io.to(ch).emit('status', s));
    this.rooms.set(key, room);
    await room.connect(demo);
    return room;
  }

  invalidateRules(username: string): void { this.rulesCache.delete(username.replace(/^@/, '').trim()); }

  get(username: string): TikTokRoom | undefined { return this.rooms.get(username.replace(/^@/, '').trim()); }

  async stop(username: string): Promise<void> {
    const key = username.replace(/^@/, '').trim();
    const room = this.rooms.get(key);
    if (room) { await room.disconnect(); this.rooms.delete(key); }
  }

  async stopAll(): Promise<void> {
    await Promise.all([...this.rooms.values()].map((r) => r.disconnect()));
    this.rooms.clear();
  }
}
