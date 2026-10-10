import { EventEmitter } from 'node:events';
import { recordGift } from './giftCatalog.js';
import { config } from '../config/index.js';
import { emptyStats, type LiveStats, type NormalizedUser, type TikTokEvent, type TikTokEventType, type TopGifter } from './types.js';

// tiktok-live-connector v2 เป็น ESM — โหลดแบบ optional (dynamic import) เพื่อให้ DEMO_MODE ทำงานได้แม้ยังไม่ติดตั้ง
let TikTokLiveConnection: any = null;
try {
  ({ TikTokLiveConnection } = await import('tiktok-live-connector'));
} catch {
  console.warn('[tiktok] ยังไม่ได้ติดตั้ง tiktok-live-connector — ใช้ได้เฉพาะ DEMO_MODE');
}

/** อันดับสะสมรายคนในห้อง (ผู้ให้ของขวัญ / ผู้กดไลค์) */
const RoomRanking = {
  add(map: Map<string, TopGifter>, user: NormalizedUser, value: number): void {
    if (!value) return;
    const id = user.uniqueId || user.userId || user.nickname;
    const cur = map.get(id) ?? { uniqueId: user.uniqueId, nickname: user.nickname, avatar: user.avatar, value: 0 };
    cur.value += value; cur.nickname = user.nickname || cur.nickname; cur.avatar = user.avatar || cur.avatar;
    map.set(id, cur);
  },
  top(map: Map<string, TopGifter>, limit: number): TopGifter[] {
    return [...map.values()].sort((a, b) => b.value - a.value).slice(0, limit);
  },
};

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

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
  /** รหัสห้องไลฟ์ของ TikTok — เปลี่ยน = ไลฟ์ใหม่ (overlay ใช้ล้างอันดับที่จำไว้) */
  private roomId: string | null = null;
  stats: LiveStats = emptyStats();
  // อันดับผู้ให้ของขวัญตลอดไลฟ์ (overlay ที่เปิด/รีเฟรชกลางไลฟ์ได้อันดับครบทันที)
  private gifters = new Map<string, TopGifter>();
  private likers = new Map<string, TopGifter>(); // value = จำนวนไลค์

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

  /** ของขวัญทั้งหมดของไลฟ์นี้ (ล่าสุด 600 ครั้ง) — วิดเจ็ตที่เพิ่งต่อ/ต่อใหม่ (deploy, รีโหลด) ใช้เติมชิ้นที่พลาดไป */
  recentGifts: TikTokEvent[] = [];

  isConnected(): boolean { return this.connected; }
  getState() { return { connected: this.connected, username: this.username, roomId: this.roomId, stats: this.stats, topGifters: this.topGifters(), topLikers: this.topLikers(), recentGifts: this.recentGifts }; }

  /** รหัสห้องไลฟ์ปัจจุบัน (null = ยังไม่ได้ต่อ / โหมดเดโม) */
  get liveRoomId(): string | null { return this.roomId; }
  peakViewers = 0;

  /** สำหรับบันทึกลงฐานข้อมูล */
  snapshot() {
    return { stats: { ...this.stats }, peakViewers: this.peakViewers, topGifters: this.topGifters(200), topLikers: this.topLikers(200), recentGifts: this.recentGifts };
  }

  /** โหลดสถิติที่บันทึกไว้ของไลฟ์เดียวกัน (หลังรีสตาร์ท/deploy) แล้วรวมกับที่นับได้ตั้งแต่เพิ่งต่อ */
  restore(snap: { stats: Partial<LiveStats>; peakViewers: number; topGifters: TopGifter[]; topLikers: TopGifter[]; recentGifts?: TikTokEvent[] }): void {
    if (snap.recentGifts?.length) { // ของขวัญก่อนรีสตาร์ท + ที่ได้หลังต่อใหม่ (ไม่ซ้ำ)
      const key = (e: TikTokEvent) => `${e.ts}|${e.user?.uniqueId}|${e.giftId ?? e.giftName}`;
      const have = new Set(this.recentGifts.map(key));
      this.recentGifts = [...snap.recentGifts.filter((e) => !have.has(key(e))), ...this.recentGifts].slice(-600);
    }
    const s = snap.stats;
    this.stats.diamondCount += s.diamondCount ?? 0;
    this.stats.giftCount += s.giftCount ?? 0;
    this.stats.followCount += s.followCount ?? 0;
    this.stats.shareCount += s.shareCount ?? 0;
    this.stats.chatCount += s.chatCount ?? 0;
    this.stats.likeCount = Math.max(this.stats.likeCount, s.likeCount ?? 0); // TikTok ส่งยอดรวมจริงมา
    this.peakViewers = Math.max(this.peakViewers, snap.peakViewers ?? 0);
    const merge = (map: Map<string, TopGifter>, list: TopGifter[]) => {
      for (const g of list ?? []) {
        const id = g.uniqueId || g.nickname, cur = map.get(id);
        if (cur) cur.value += g.value; else map.set(id, { ...g });
      }
    };
    merge(this.gifters, snap.topGifters); merge(this.likers, snap.topLikers);
    this.emit('stats', this.stats);
  }

  topGifters(limit = 20): TopGifter[] { return RoomRanking.top(this.gifters, limit); }
  topLikers(limit = 20): TopGifter[] { return RoomRanking.top(this.likers, limit); }

  private addGifter(user: NormalizedUser, value: number): void { RoomRanking.add(this.gifters, user, value); }

  async connect(demo = config.demoMode): Promise<void> {
    await this.disconnect();
    this.stats = emptyStats();
    this.recentGifts = [];
    this.seenMsgIds.clear();
    this.gifters.clear();
    this.likers.clear();
    this.peakViewers = 0;
    if (demo || !TikTokLiveConnection) return this.startDemo();
    return this.connectReal();
  }

  // ---------- การเชื่อมต่อจริง ----------
  private async connectReal(): Promise<void> {
    const opts: Record<string, unknown> = {};
    if (config.signApiKey) opts.signApiKey = config.signApiKey;
    this.connection = new TikTokLiveConnection(this.username, opts);
    this.bindRealEvents();
    const state = await this.connection.connect();
    this.connected = true;
    this.roomId = state?.roomId ? String(state.roomId) : null;
    try { const ri: any = this.connection.roomInfo; const oid = ri?.owner?.id_str ?? ri?.owner?.id ?? ri?.owner_user_id; if (oid) this.hostId = String(oid); } catch { /* ไม่มีข้อมูลเจ้าของห้อง — รู้ทีหลังจากข้อมูล PK */ }
    this.emit('status', { type: 'connected', message: `เชื่อมต่อ @${this.username} สำเร็จ`, roomId: this.roomId });
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
    // ---- PK (แข่ง) ----
    c.on('linkMicBattle', (d: any) => this.onBattle(d));
    c.on('linkMicArmies', (d: any) => this.onArmies(d));
    c.on('linkMicBattleItemCard', (d: any) => this.onCard(d));
    c.on('disconnected', () => { this.connected = false; this.emit('status', { type: 'disconnected', message: 'การเชื่อมต่อถูกตัด' }); });
    // v2 ส่ง error เป็น { info, exception }
    c.on('error', (err: any) => this.emit('status', { type: 'error', message: String(err?.exception?.message ?? err?.info ?? err?.message ?? err) }));
    // ไลฟ์จบ → ไม่ถือว่ายังต่ออยู่ (เดิมค้างสถานะ "ไลฟ์อยู่") แล้วปิดการเชื่อมต่อ ระบบจะรอต่อใหม่เองเมื่อเริ่มไลฟ์รอบหน้า
    c.on('streamEnd', () => { this.connected = false; this.emit('status', { type: 'streamEnd', message: 'ไลฟ์จบแล้ว' }); void this.connection?.disconnect?.().catch?.(() => {}); });
  }

  /** ถาม TikTok ว่ายังไลฟ์อยู่จริงไหม (true/false) · ถามไม่ได้ = null (ไม่ตัดสิน) */
  async checkLive(): Promise<boolean | null> {
    if (!this.connection || !this.connected) return null;
    try { return Boolean(await this.connection.fetchIsLive()); } catch { return null; }
  }
  /** TikTok ยืนยันว่าไลฟ์จบแล้ว แต่ไม่ได้ส่งสัญญาณจบมา → ปิดเองเหมือนได้ streamEnd */
  endStale(): void {
    if (!this.connected) return;
    this.connected = false;
    this.emit('status', { type: 'streamEnd', message: 'ไลฟ์จบแล้ว' });
    void this.connection?.disconnect?.().catch?.(() => {});
  }

  // v2 ส่ง protobuf object (user.displayId / avatarThumb.urlList); เผื่อรูปแบบเก่า (uniqueId / profilePicture.url)
  private user(d: any = {}): NormalizedUser {
    const u = d.user ?? {};
    const uniqueId = u.uniqueId ?? u.displayId ?? 'unknown';
    return {
      userId: String(u.userId ?? u.id ?? ''),
      uniqueId,
      nickname: u.nickname || uniqueId || 'ผู้ชม',
      avatar: u.avatarThumb?.urlList?.[0] ?? u.profilePicture?.url?.[0] ?? '',
    };
  }

  // ไลค์รวมเป็นชุดทุก 300ms ต่อคน: คนเคาะจอรัว ๆ หลายพันครั้ง → ส่งต่อให้วิดเจ็ตไม่กี่ข้อความ (ยอดรวมยังตรงทุกไลค์)
  private likeQueue = new Map<string, { user: TikTokEvent['user']; inc: number }>();
  private likeTimer: NodeJS.Timeout | null = null;
  private queueLike(user: TikTokEvent['user'], inc: number): void {
    const key = user?.uniqueId || user?.nickname || '?';
    const row = this.likeQueue.get(key);
    if (row) { row.inc += inc; row.user = user; } else this.likeQueue.set(key, { user, inc });
    if (!this.likeTimer) this.likeTimer = setTimeout(() => this.flushLikes(), 300);
  }
  private flushLikes(): void {
    this.likeTimer = null;
    const rows = [...this.likeQueue.values()]; this.likeQueue.clear();
    for (const r of rows) this.send('like', { user: r.user, likeCount: r.inc, total: this.stats.likeCount });
  }

  // ================= PK =================
  /** รหัสผู้ใช้ TikTok ของเจ้าของห้อง (รู้จากข้อมูล PK) — ไว้แยกฝั่งเรา/คู่แข่ง */
  private hostId = '';
  private lastPkScore = '';
  /** อีเวนต์ PK ดิบล่าสุด (หน้าแอดมินดูไว้ตรวจว่า TikTok ส่งอะไรมา) */
  pkLog: { t: number; kind: string; raw: string }[] = [];
  private logPk(kind: string, d: unknown) {
    let raw = ''; try { raw = JSON.stringify(d, (k, v) => (k === 'common' || /image|Image|avatar|Thumb/.test(k) ? undefined : v)).slice(0, 1500); } catch { /* ignore */ }
    this.pkLog.push({ t: Date.now(), kind, raw }); if (this.pkLog.length > 40) this.pkLog.shift();
  }
  private learnHost(list: any[] | undefined) {
    for (const a of list ?? []) { const u = a?.value?.user ?? a?.user; if (u && String(u.displayId ?? '').toLowerCase() === this.username.toLowerCase()) this.hostId = String(u.userId); }
  }
  private onBattle(d: any) {
    if (this.isDuplicate(d)) return;
    this.logPk('battle', d); this.learnHost(d?.anchorsInfo);
    const act = Number(d?.action);
    if (act === 4 || act === 7) { this.lastPkScore = ''; this.send('pk', { pk: { kind: 'start' } }); }
    else if (act === 5 || act === 6) {
      const res = d?.battleResult ?? {}, me = res[this.hostId], r = Number(me?.result);
      this.send('pk', { pk: { kind: 'end', result: r === 0 ? 'win' : r === 1 ? 'lose' : r === 2 ? 'draw' : undefined, us: me ? Number(me.score) : undefined } });
    }
  }
  private onArmies(d: any) {
    this.logPk('armies', d);
    const armies: Record<string, any> = d?.armies ?? {};
    let us: number | undefined, them = 0;
    for (const [id, a] of Object.entries(armies)) { const sc = Number(a?.hostscore ?? 0); if (id === this.hostId || String(a?.anchorIdStr) === this.hostId) us = sc; else them = Math.max(them, sc); }
    if (us === undefined) return; // ยังไม่รู้ว่าฝั่งไหนคือเรา
    const key = us + ':' + them; if (key === this.lastPkScore) return; this.lastPkScore = key;
    this.send('pk', { pk: { kind: 'score', us, them } });
  }
  private static CARDS: Record<number, [string, string, string]> = {
    2: ['critical', '⚡ สายฟ้า', 'useCriticalStrikeCard'], 3: ['smoke', '🌫️ หมอก', 'useSmokeCard'], 5: ['extra', '⏱️ ต่อเวลา', 'useExtraTimeCard'],
    6: ['effect', '✨ เอฟเฟกต์พิเศษ', 'useSpecialEffectCard'], 7: ['potion', '🧪 ยาพลัง', 'usePotionCard'], 8: ['wave', '🌊 คลื่น', 'useWaveCard'],
    10: ['top2', '🥈 เก้าอี้ที่ 2 X2', 'useTop2Card'], 11: ['top3', '🥉 เก้าอี้ที่ 3 X2', 'useTop3Card'], // อันดับ 2/3 ของห้องส่งของขวัญได้คะแนนคูณ 2 12: ['glove', '🥊 นวม', 'useVaultGloveCard'],
  };
  private onCard(d: any) {
    if (this.isDuplicate(d)) return;
    this.logPk('card', d);
    const def = TikTokRoom.CARDS[Number(d?.msgType)];
    if (!def) return; // แนะนำ/แจกการ์ด — ยังไม่ส่งต่อ
    const use = d?.[def[2]] ?? {}, info = use.cardInfo ?? {}, su = info.sendUser?.user;
    const anchor = String(use.anchorId ?? info.toAnchorId ?? '');
    this.send('pk', { user: su?.nickName ? { userId: String(su.userId ?? ''), uniqueId: String(su.displayId ?? su.nickName), nickname: su.nickName, avatar: '' } : undefined, pk: { kind: 'card', card: def[0], label: def[1], by: su?.nickName || undefined, side: !this.hostId || !anchor ? null : anchor === this.hostId ? 'us' : 'them', text: use.displayContent?.defaultPattern || undefined } });
  }

  /** เวลาที่ได้รับอีเวนต์ล่าสุดจากไลฟ์ (คนดู/แชท/กิฟต์) — ไว้เช็กว่ายังไลฟ์อยู่จริง */
  lastActivityAt = 0;

  private send(type: TikTokEventType, payload: Partial<TikTokEvent>): void {
    this.lastActivityAt = Date.now();
    const ev = { type, ts: Date.now(), ...payload } as TikTokEvent;
    if (type === 'gift' && !payload.streaking) {
      const u = ev.user;
      this.recentGifts.push({ ...ev, user: u ? { userId: u.userId, uniqueId: u.uniqueId, nickname: u.nickname, avatar: '' } : undefined });
      if (this.recentGifts.length > 600) this.recentGifts.splice(0, this.recentGifts.length - 600);
    }
    this.emit('event', ev);
    this.emit('stats', this.stats);
  }

  // TikTok ส่งข้อความเดิมซ้ำได้ (เช่น ประวัติแชทตอนเพิ่งต่อ) — กันซ้ำด้วย msgId
  private seenMsgIds = new Set<string>();
  private isDuplicate(d: any): boolean {
    const id = d?.common?.msgId ?? d?.msgId;
    if (id === undefined || id === null || id === '' || id === '0') return false;
    const key = String(id);
    if (this.seenMsgIds.has(key)) return true;
    this.seenMsgIds.add(key);
    if (this.seenMsgIds.size > 2000) this.seenMsgIds.delete(this.seenMsgIds.values().next().value!);
    return false;
  }

  private handle(type: TikTokEventType, d: any): void {
    if (this.isDuplicate(d)) return;
    const user = this.user(d);
    switch (type) {
      case 'chat': this.stats.chatCount++; this.send('chat', { user, comment: d.content ?? d.comment ?? '' }); break;
      case 'gift': {
        const g = d.gift ?? d.giftDetails ?? {};
        const giftName: string = g.name ?? g.giftName ?? d.giftName ?? '';
        const giftId = num(d.giftId ?? g.id);
        const giftImage: string | undefined = g.image?.urlList?.[0] ?? d.giftPictureUrl ?? undefined;
        const diamonds = num(g.diamondCount ?? d.diamondCount);
        const streak = num(g.type ?? d.giftType) === 1;
        const streakEnd = d.repeatEnd === true || num(d.repeatEnd) === 1;
        const count = num(d.repeatCount, 1) || 1;
        if (streak && !streakEnd) { this.send('gift', { user, giftName, giftId, giftImage, repeatCount: count, diamondCount: diamonds, streaking: true }); return; }
        const value = diamonds * count;
        this.stats.giftCount += count; this.stats.diamondCount += value;
        this.addGifter(user, value);
        this.send('gift', { user, giftName, giftId, giftImage, repeatCount: count, diamondCount: diamonds, totalValue: value, streaking: false });
        recordGift(giftName, giftId || undefined, giftImage, diamonds); // คลังของขวัญ (ดรอปดาวน์ใน Dashboard)
        break;
      }
      case 'like': {
        const inc = num(d.count ?? d.likeCount, 1);
        RoomRanking.add(this.likers, user, inc);
        const total = num(d.total ?? d.totalLikeCount, NaN);
        this.stats.likeCount = Number.isFinite(total) && total > 0 ? total : this.stats.likeCount + inc;
        this.queueLike(user, inc);
        break;
      }
      case 'follow': this.stats.followCount++; this.send('follow', { user }); break;
      case 'share': this.stats.shareCount++; this.send('share', { user }); break;
      case 'member': this.send('member', { user }); break;
      case 'roomUser': this.stats.viewerCount = num(d.total ?? d.viewerCount); this.peakViewers = Math.max(this.peakViewers, this.stats.viewerCount); this.send('roomUser', { viewerCount: this.stats.viewerCount }); break;
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
      else if (r < 0.7) { const inc = 1 + Math.floor(Math.random() * 15); this.stats.likeCount += inc; const u = mockUser(); RoomRanking.add(this.likers, u, inc); this.send('like', { user: u, likeCount: inc, total: this.stats.likeCount }); }
      else if (r < 0.85) { const g = pick(gifts); const count = g.d >= 1000 ? 1 : 1 + Math.floor(Math.random() * 3); const value = g.d * count; this.stats.giftCount += count; this.stats.diamondCount += value; const u = mockUser(); this.addGifter(u, value); this.send('gift', { user: u, giftName: g.name, repeatCount: count, diamondCount: g.d, totalValue: value, streaking: false }); }
      else if (r < 0.93) { this.stats.followCount++; this.send('follow', { user: mockUser() }); }
      else if (r < 0.97) { this.stats.shareCount++; this.send('share', { user: mockUser() }); }
      else this.send('member', { user: mockUser() });
    }, 900);
  }

  async disconnect(): Promise<void> {
    if (this.likeTimer) { clearTimeout(this.likeTimer); this.flushLikes(); }
    if (this.mockTimer) { clearInterval(this.mockTimer); this.mockTimer = null; }
    if (this.connection) { try { await this.connection.disconnect(); } catch { /* ignore */ } this.connection = null; }
    this.connected = false;
  }
}
