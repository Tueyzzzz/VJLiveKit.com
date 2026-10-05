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

interface Viewer { username: string; ownerId?: string }

/** ตรวจสิทธิ์การเชื่อมต่อ: token ต้องยังไม่ถูกเพิกถอน และแพลนต้องเปิดวิดเจ็ตนี้ */
async function resolveViewer(token: string | undefined, username: string | undefined, widget: string | undefined): Promise<Viewer | { error: string }> {
  if (token) {
    const payload = verifyOverlayToken(token);
    if (!payload?.tid || !payload.userId) return { error: 'token ไม่ถูกต้องหรือหมดอายุ' };
    const record = await prisma.overlayToken.findUnique({ where: { id: payload.tid }, select: { revoked: true, userId: true } });
    if (!record || record.revoked || record.userId !== payload.userId) return { error: 'token ถูกเพิกถอนแล้ว — สร้างลิงก์ใหม่ใน Dashboard' };
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { tiktokUsername: true } });
    if (!user?.tiktokUsername) return { error: 'ยังไม่ได้ตั้งชื่อ TikTok ใน Dashboard' };
    if (widget && isWidgetType(widget)) {
      const ent = await getEntitlements(payload.userId);
      if (!ent.widgets.includes(widget)) return { error: `วิดเจ็ต ${widget} ใช้ได้เฉพาะแพลน Pro` };
    }
    // ใช้ชื่อ TikTok ปัจจุบันของผู้ใช้ (เปลี่ยนชื่อแล้วลิงก์เดิมยังใช้ได้)
    return { username: user.tiktokUsername, ownerId: payload.userId };
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

  io.on('connection', (socket) => {
    const { token, username, widget } = socket.handshake.query as { token?: string; username?: string; widget?: string };
    socket.emit('version', OVERLAY_VERSION); // overlay เวอร์ชันเก่า → โหลดตัวเองใหม่

    void (async () => {
      let viewer: Viewer | { error: string };
      try { viewer = await resolveViewer(token, username, widget); }
      catch (err) { viewer = { error: 'เซิร์ฟเวอร์ขัดข้อง' }; console.error('[socket] resolve failed', err); }

      if ('error' in viewer) {
        socket.emit('status', { type: 'error', message: viewer.error });
        socket.disconnect(true);
        return;
      }
      if (socket.disconnected) return;

      const { username: room, ownerId } = viewer;
      socket.join(RoomHub.roomChannel(room));
      if (ownerId) socket.join(RoomHub.ownerChannel(ownerId, room));
      // ตั้งค่าวิดเจ็ตที่บันทึกจาก Dashboard → ส่งให้ overlay (แก้ใน Dashboard แล้วจอเปลี่ยนทันที ไม่ต้องเปลี่ยนลิงก์)
      if (ownerId && widget && isWidgetType(widget)) {
        socket.join(RoomHub.configChannel(ownerId, widget));
        try {
          const cfg = await prisma.widgetConfig.findUnique({ where: { userId_type: { userId: ownerId, type: widget } }, select: { settings: true } });
          socket.emit('config', cfg?.settings ?? {});
        } catch (err) { console.error('[socket] load widget config failed', err); }
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
