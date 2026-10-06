import { Server } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { RoomHub, type RulesProvider } from './hub.js';
import { verifyOverlayToken } from '../widgets/tokens.js';
import { config } from '../config/index.js';
import { OVERLAY_VERSION } from '../overlay-version.js';
import { prisma } from '../db/prisma.js';
import { getEntitlements, isWidgetType } from '../plans/index.js';
import type { ActionRule, RuleTrigger, RuleAction } from '../actions/engine.js';

/** โหลดกฎ Actions ที่เปิดใช้ของผู้ใช้ */
const rulesProvider: RulesProvider = async (userId) => {
  const rules = await prisma.actionRule.findMany({ where: { userId, enabled: true } });
  return rules.map((r): ActionRule => ({
    id: r.id, name: r.name, enabled: r.enabled,
    trigger: r.trigger as unknown as RuleTrigger,
    action: r.action as unknown as RuleAction,
  }));
};

interface Viewer { username: string; ownerId?: string; watermark?: boolean }

/** ตรวจสิทธิ์การเชื่อมต่อ: token ต้องยังไม่ถูกเพิกถอน และแพลนต้องเปิดวิดเจ็ตนี้ */
async function resolveViewer(token: string | undefined, username: string | undefined, widget: string | undefined): Promise<Viewer | { error: string }> {
  if (token) {
    const payload = verifyOverlayToken(token);
    if (!payload?.tid || !payload.userId) return { error: 'token ไม่ถูกต้องหรือหมดอายุ' };
    const record = await prisma.overlayToken.findUnique({ where: { id: payload.tid }, select: { revoked: true, userId: true } });
    if (!record || record.revoked || record.userId !== payload.userId) return { error: 'token ถูกเพิกถอนแล้ว — สร้างลิงก์ใหม่ใน Dashboard' };
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { tiktokUsername: true, email: true, role: true } });
    if (!user?.tiktokUsername) return { error: 'ยังไม่ได้ตั้งชื่อ TikTok ใน Dashboard' };
    const ent = await getEntitlements(payload.userId);
    if (widget && isWidgetType(widget) && !ent.widgets.includes(widget)) return { error: 'หมดช่วงทดลองฟรี/สิทธิ์ Pro — ต่ออายุที่ vjlivekit.com แล้วลิงก์นี้จะกลับมาใช้ได้เอง' };
    // ใช้ชื่อ TikTok ปัจจุบันของผู้ใช้ (เปลี่ยนชื่อแล้วลิงก์เดิมยังใช้ได้)
    // แอดมิน/เจ้าของระบบ ไม่มีป้าย vjlivekit.com บนจอ
    const admin = user.role === 'ADMIN' || config.adminEmails.includes((user.email ?? '').toLowerCase());
    return { username: user.tiktokUsername, ownerId: payload.userId, watermark: !ent.noWatermark && !admin };
  }
  if (username && config.demoMode) return { username: username.replace(/^@/, '').trim() };
  return { error: 'ไม่มี token หรือ username ที่ถูกต้อง' };
}

/**
 * ตั้งค่า Socket.IO:
 * - overlay เชื่อมต่อพร้อม query { token, widget } (หรือ { username } ในโหมดเดโม)
 * - join `room:<username>` (อีเวนต์ไลฟ์) + `owner:<userId>:<username>` (Actions ของเจ้าของ token)
 */
export function setupRealtime(httpServer: HttpServer): RoomHub {
  const io = new Server(httpServer, { cors: { origin: '*' } });
  const hub = new RoomHub(io, rulesProvider, config.demoMode);

  // เรทลิมิตการเชื่อมต่อต่อ IP: กันสคริปต์เปิด socket รัว ๆ (แต่ละครั้งต้องเช็ก token + DB)
  // OBS/TikTok Studio ปกติ = ไม่กี่วิดเจ็ตต่อเครื่อง จึงตั้งเพดานเผื่อไว้กว้าง ๆ
  const MAX_PER_MIN = 60, MAX_OPEN = 40;
  const recent = new Map<string, number[]>(), open = new Map<string, number>();
  const ipOf = (s: { handshake: { address: string; headers: Record<string, unknown> } }) =>
    String(s.handshake.headers['x-forwarded-for'] ?? s.handshake.address).split(',')[0]!.trim();
  setInterval(() => { const cut = Date.now() - 60_000; for (const [ip, ts] of recent) { const keep = ts.filter((t) => t > cut); if (keep.length) recent.set(ip, keep); else recent.delete(ip); } }, 60_000).unref();
  io.use((socket, next) => {
    const ip = ipOf(socket), now = Date.now();
    const ts = (recent.get(ip) ?? []).filter((t) => t > now - 60_000);
    if (ts.length >= MAX_PER_MIN || (open.get(ip) ?? 0) >= MAX_OPEN) return next(new Error('rate limited'));
    ts.push(now); recent.set(ip, ts); open.set(ip, (open.get(ip) ?? 0) + 1);
    socket.once('disconnect', () => { const n = (open.get(ip) ?? 1) - 1; if (n > 0) open.set(ip, n); else open.delete(ip); });
    next();
  });

  io.on('connection', (socket) => {
    const { token, username, widget } = socket.handshake.query as { token?: string; username?: string; widget?: string };
    socket.emit('version', OVERLAY_VERSION); // overlay เวอร์ชันเก่า → โหลดตัวเองใหม่

    void (async () => {
      let viewer: Viewer | { error: string };
      try { viewer = await resolveViewer(token, username, widget); }
      catch (err) { viewer = { error: 'เซิร์ฟเวอร์ขัดข้อง' }; console.error('[socket] resolve failed', err); }

      if ('error' in viewer) {
        socket.emit('status', { type: 'error', message: viewer.error, fatal: true }); // ปัญหาลิงก์/สิทธิ์ — วีเจต้องแก้เอง → โชว์บนจอได้
        socket.disconnect(true);
        return;
      }
      if (socket.disconnected) return;

      const { username: room, ownerId } = viewer;
      socket.emit('brand', { show: !!viewer.watermark }); // ป้าย VJLiveKit มุมจอ (ฟรี/ทดลอง) — Pro ไม่มี
      socket.join(RoomHub.roomChannel(room));
      if (ownerId) socket.join(RoomHub.ownerChannel(ownerId, room));
      // ตั้งค่าวิดเจ็ตที่บันทึกจาก Dashboard → ส่งให้ overlay (แก้ใน Dashboard แล้วจอเปลี่ยนทันที ไม่ต้องเปลี่ยนลิงก์)
      if (ownerId && widget && isWidgetType(widget)) {
        socket.join(RoomHub.configChannel(ownerId, widget));
        try {
          const cfg = await prisma.widgetConfig.findUnique({ where: { userId_type: { userId: ownerId, type: widget } }, select: { settings: true } });
          socket.emit('config', cfg?.settings ?? {});
        } catch (err) { console.error('[socket] load widget config failed', err); }
        if (widget === 'fxmenu') socket.emit('menu', await hub.menuFor(ownerId));
      }
      const state = await hub.attach(room, ownerId);
      // หลุดไประหว่างรอเชื่อมต่อ -> คืนที่นั่งทันที
      if (socket.disconnected) { hub.detach(room, ownerId); return; }
      socket.once('disconnect', () => hub.detach(room, ownerId));
      socket.emit('state', state);
    })();
  });

  return hub;
}
