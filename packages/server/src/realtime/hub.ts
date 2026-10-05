import { TikTokRoom } from '../tiktok/manager.js';
import type { Server } from 'socket.io';

/**
 * จัดการหลายห้องไลฟ์พร้อมกัน (หนึ่ง username = หนึ่งห้อง)
 * แต่ละห้องจะ relay อีเวนต์ไปยัง socket channel ชื่อเดียวกับ username
 * หมายเหตุ: in-memory — ถ้าสเกลหลาย instance ให้ใช้ Redis adapter + แชร์สถานะ
 */
export class RoomHub {
  private rooms = new Map<string, TikTokRoom>();

  constructor(private io: Server) {}

  private channel(username: string) { return `room:${username}`; }

  async ensure(username: string, demo?: boolean): Promise<TikTokRoom> {
    const key = username.replace(/^@/, '').trim();
    let room = this.rooms.get(key);
    if (room) return room;

    room = new TikTokRoom(key);
    const ch = this.channel(key);
    room.on('event', (e) => this.io.to(ch).emit('tiktok-event', e));
    room.on('stats', (s) => this.io.to(ch).emit('stats', s));
    room.on('status', (s) => this.io.to(ch).emit('status', s));
    this.rooms.set(key, room);
    await room.connect(demo);
    return room;
  }

  get(username: string): TikTokRoom | undefined {
    return this.rooms.get(username.replace(/^@/, '').trim());
  }

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
