import { Server } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { RoomHub, type RulesProvider } from './hub.js';
import { verifyOverlayToken } from '../widgets/tokens.js';
import { config } from '../config/index.js';
import { prisma } from '../db/prisma.js';
import type { ActionRule, RuleTrigger, RuleAction } from '../actions/engine.js';

/** โหลดกฎ Actions ของผู้ใช้จาก DB ตามชื่อ TikTok (best-effort) */
const rulesProvider: RulesProvider = async (username) => {
  try {
    const user = await prisma.user.findFirst({ where: { tiktokUsername: username }, select: { id: true } });
    if (!user) return [];
    const rules = await prisma.actionRule.findMany({ where: { userId: user.id, enabled: true } });
    return rules.map((r): ActionRule => ({
      id: r.id, name: r.name, enabled: r.enabled,
      trigger: r.trigger as unknown as RuleTrigger,
      action: r.action as unknown as RuleAction,
    }));
  } catch {
    return [];
  }
};

/**
 * ตั้งค่า Socket.IO:
 * - overlay/dashboard เชื่อมต่อพร้อม query { token } หรือ { username }
 * - token (จาก OverlayToken) จะ resolve เป็น username ของเจ้าของ แล้ว join ห้องนั้น
 * - ในโหมดเดโม อนุญาตให้ส่ง username ตรง ๆ ได้
 */
export function setupRealtime(httpServer: HttpServer): RoomHub {
  const io = new Server(httpServer, { cors: { origin: '*' } });
  const hub = new RoomHub(io, rulesProvider);

  io.on('connection', async (socket) => {
    const { token, username } = socket.handshake.query as { token?: string; username?: string };

    let room: string | null = null;
    if (token) {
      const payload = verifyOverlayToken(token);
      if (payload?.username) room = payload.username;
    } else if (username && config.demoMode) {
      room = username.replace(/^@/, '').trim();
    }

    if (!room) {
      socket.emit('status', { type: 'error', message: 'ไม่มี token หรือ username ที่ถูกต้อง' });
      socket.disconnect(true);
      return;
    }

    socket.join(`room:${room}`);
    const live = await hub.ensure(room, config.demoMode);
    socket.emit('state', live.getState());
  });

  return hub;
}
