import { Server } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { RoomHub } from './hub.js';
import { verifyOverlayToken } from '../widgets/tokens.js';
import { config } from '../config/index.js';

/**
 * ตั้งค่า Socket.IO:
 * - overlay/dashboard เชื่อมต่อพร้อม query { token } หรือ { username }
 * - token (จาก OverlayToken) จะ resolve เป็น username ของเจ้าของ แล้ว join ห้องนั้น
 * - ในโหมดเดโม อนุญาตให้ส่ง username ตรง ๆ ได้
 */
export function setupRealtime(httpServer: HttpServer): RoomHub {
  const io = new Server(httpServer, { cors: { origin: '*' } });
  const hub = new RoomHub(io);

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
