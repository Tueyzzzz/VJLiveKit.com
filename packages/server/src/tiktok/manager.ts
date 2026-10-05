import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { config } from '../config/index.js';
import { emptyStats, type LiveStats, type NormalizedUser, type TikTokEvent, type TikTokEventType } from './types.js';

// tiktok-live-connector เป็น CommonJS — โหลดแบบ optional เพื่อให้ DEMO_MODE ทำงานได้แม้ยังไม่ติดตั้ง
const require = createRequire(import.meta.url);
let WebcastPushConnection: any = null;
try {
  const lib = require('tiktok-live-connector');
  WebcastPushConnection = lib.TikTokLiveConnection ?? lib.WebcastPushConnection;
} catch {
  console.warn('[tiktok] ยังไม่ได้ติดตั้ง tiktok-live-connector — ใช้ได้เฉพาะ DEMO_MODE');
}

type Events = {
  event: (e: TikTokEvent) => void;
  stats: (s: LiveStats) => void;
  status: (s: { type: string; message: string; [k: string]: unknown }) => void;
};

/**
 * จัดการการเชื่อมต่อไลฟ์ของ "หนึ่งห้อง" (หนึ่ง instance ต่อหนึ่ง username)
 * - connect() เชื่อมต่อจริง หรือ เริ่มโหมดเดโม
 * - ส่งอีเวนต์ normalized ผ่าน emitter ('event' / 'stats' / 'status')
 */
export class TikTokRoom extends EventEmitter {
  readonly username: string;
  private connection: any = null;
  private mockTimer: NodeJS.Timeout | null = null;
  private connected = false;
  stats: LiveStats = emptyStats();

  constructor(username: string) {
    super();
    this.username = (username || '').replace(/^@/, '').trim();
  }

  override on<K extends keyof Events>(event: K, listener: Events[K]): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }
  override emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>): boolean {
    return super.emit(event, ...args);
  }

  isConnected(): boolean { return this.connected; }
  getState() { return { connected: this.connected, username: this.username, stats: this.stats }; }

  async connect(demo = config.demoMode): Promise<void> {
    await this.disconnect();
    this.stats = emptyStats();
    if (demo || !WebcastPushConnection) return this.startDemo();
    return this.connectReal();
  }

  // ---------- การเชื่อมต่อจริง ----------
  private async connectReal(): Promise<void> {
    const opts: Record<string, unknown> = {};
    if (config.signApiKey) opts.signApiKey = config.signApiKey;
    this.connection = new WebcastPushConnection(this.username, opts);
    this.bindRealEvents();
    const state = await this.connection.connect();
    this.connected = true;
    this.emit('status', { type: 'connected', message: `เชื่อมต่อ @${this.username} สำเร็จ`, roomId: state?.roomId });
  }

  private bindRealEvents(): void {
    const c = this.connection;
    const map: Record<string, TikTokEventType> = {
      chat: 'chat', gift: 'gift', like: 'like', follow: 'follow',
      share: 'share', member: 'member', roomUser: 'roomUser',
    };
    for (const [evName, type] of Object.entries(map)) {
      c.on(evName, (d: any) => this.handle(type, d));
    }
    c.on('disconnected', () => { this.connected = false; this.emit('status', { type: 'disconnected', message: 'การเชื่อมต่อถูกตัด' }); });
    c.on('error', (err: any) => this.emit('status', { type: 'error', message: String(err?.message ?? err) }));
    c.on('streamEnd', () => this.emit('status', { type: 'streamEnd', message: 'ไลฟ์จบแล้ว' }));
  }

  private user(d: any = {}): NormalizedUser {
    return {
      userId: d.userId ?? d.user?.userId ?? '',
      uniqueId: d.uniqueId ?? d.user?.uniqueId ?? 'unknown',
      nickname: d.nickname ?? d.user?.nickname ?? d.uniqueId ?? 'ผู้ชม',
      avatar: d.profilePictureUrl ?? d.user?.profilePicture?.url?.[0] ?? '',
    };
  }

  private send(type: TikTokEventType, payload: Partial<TikTokEvent>): void {
    this.emit('event', { type, ts: Date.now(), ...payload });
    this.emit('stats', this.stats);
  }

  private handle(type: TikTokEventType, d: any): void {
    const user = this.user(d);
    switch (type) {
      case 'chat': this.stats.chatCount++; this.send('chat', { user, comment: d.comment }); break;
      case 'gift': {
        const streak = d.giftType === 1;
        const streakEnd = d.repeatEnd === true || d.repeatEnd === 1;
        if (streak && !streakEnd) { this.send('gift', { user, giftName: d.giftName, giftId: d.giftId, repeatCount: d.repeatCount ?? 1, diamondCount: d.diamondCount ?? 0, streaking: true }); return; }
        const count = d.repeatCount ?? 1; const value = (d.diamondCount ?? 0) * count;
        this.stats.giftCount += count; this.stats.diamondCount += value;
        this.send('gift', { user, giftName: d.giftName, giftId: d.giftId, repeatCount: count, diamondCount: d.diamondCount ?? 0, totalValue: value, streaking: false });
        break;
      }
      case 'like': this.stats.likeCount = d.totalLikeCount ?? this.stats.likeCount + (d.likeCount ?? 1); this.send('like', { user, likeCount: d.likeCount ?? 1, total: this.stats.likeCount }); break;
      case 'follow': this.stats.followCount++; this.send('follow', { user }); break;
      case 'share': this.stats.shareCount++; this.send('share', { user }); break;
      case 'member': this.send('member', { user }); break;
      case 'roomUser': this.stats.viewerCount = d.viewerCount ?? 0; this.send('roomUser', { viewerCount: this.stats.viewerCount }); break;
    }
  }

  // ---------- โหมดเดโม ----------
  private startDemo(): void {
    this.connected = true;
    this.emit('status', { type: 'connected', message: `โหมดเดโม @${this.username || 'demo'}`, demo: true });
    const names = ['somchai', 'nong_may', 'gamer_x', 'lisa_fan', 'ต้นน้ำ', 'บิ๊ก', 'mimi'];
    const gifts = [
      { name: 'Rose', d: 1 }, { name: 'Finger Heart', d: 5 }, { name: 'Perfume', d: 20 },
      { name: 'Galaxy', d: 1000 }, { name: 'Lion', d: 2999 },
    ];
    const comments = ['สวัสดีครับ', 'เก่งมาก!', 'สู้ๆ', 'กดไลค์ให้แล้ว', '555', 'ปังมาก'];
    const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    const mockUser = (): NormalizedUser => { const u = pick(names); return { userId: String(Math.floor(Math.random() * 1e9)), uniqueId: u, nickname: u, avatar: '' }; };
    this.stats.viewerCount = 120 + Math.floor(Math.random() * 300);

    this.mockTimer = setInterval(() => {
      const r = Math.random();
      if (r < 0.45) { this.stats.chatCount++; this.send('chat', { user: mockUser(), comment: pick(comments) }); }
      else if (r < 0.7) { const inc = 1 + Math.floor(Math.random() * 15); this.stats.likeCount += inc; this.send('like', { user: mockUser(), likeCount: inc, total: this.stats.likeCount }); }
      else if (r < 0.85) { const g = pick(gifts); const count = g.d >= 1000 ? 1 : 1 + Math.floor(Math.random() * 3); const value = g.d * count; this.stats.giftCount += count; this.stats.diamondCount += value; this.send('gift', { user: mockUser(), giftName: g.name, repeatCount: count, diamondCount: g.d, totalValue: value, streaking: false }); }
      else if (r < 0.93) { this.stats.followCount++; this.send('follow', { user: mockUser() }); }
      else if (r < 0.97) { this.stats.shareCount++; this.send('share', { user: mockUser() }); }
      else this.send('member', { user: mockUser() });
    }, 900);
  }

  async disconnect(): Promise<void> {
    if (this.mockTimer) { clearInterval(this.mockTimer); this.mockTimer = null; }
    if (this.connection) { try { await this.connection.disconnect(); } catch { /* ignore */ } this.connection = null; }
    this.connected = false;
  }
}
