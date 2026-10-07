import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireUser, getUser } from '../auth/middleware.js';
import { getHub } from '../realtime/hub.js';

/**
 * Beat Pad — แผงปุ่มเสียงกดเล่นระหว่างไลฟ์ (แบบ Stream Deck)
 * ตั้งปุ่มเก็บบนเซิร์ฟเวอร์ (เปิดจากมือถือ/คอมเครื่องไหนก็เห็นปุ่มชุดเดียวกัน)
 * กดปุ่ม → เสียงดังที่คอมที่เปิดเว็บไว้ (ลำโพงแดชบอร์ด) หรือที่จอ FX ในโปรแกรมไลฟ์
 */
const DIR = path.join(process.env.SNAPSHOT_DIR ? path.dirname(process.env.SNAPSHOT_DIR) : path.resolve(process.cwd(), '../../data'), 'beatpad');
const fileOf = (uid: string) => path.join(DIR, uid.replace(/[^\w-]/g, '') + '.json');

const padSchema = z.object({
  label: z.string().trim().max(24).default(''),
  emoji: z.string().max(8).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#a78bfa'),
  sound: z.string().regex(/^[a-z]{2,20}$/).optional(),
  url: z.string().url().max(500).optional(),
  volume: z.number().min(0).max(1.5).default(1),
  key: z.string().max(12).optional(),                       // คีย์ลัดของปุ่ม
  media: z.string().url().max(500).optional(),              // สติกเกอร์ (รูป/GIF) หรือวิดีโอ ขึ้นจอ FX พร้อมเสียง
  mediaType: z.enum(['image', 'video']).optional(),
  tab: z.string().max(40).optional(), // แท็บที่กด (แท็บนั้นไม่ต้องเล่นซ้ำ)
});
const boardSchema = z.object({ cols: z.number().int().min(2).max(6).default(4), pads: z.array(padSchema).max(36) });
type Board = z.infer<typeof boardSchema>;

const DEFAULT: Board = {
  cols: 4,
  pads: [
    { label: 'ปรบมือ', color: '#a78bfa', sound: 'applause', emoji: '👏', volume: 1 }, { label: 'ตึ่งโป๊ะ', color: '#60a5fa', sound: 'drum', emoji: '🥁', volume: 1 }, { label: 'กริ๊ง', color: '#38bdf8', sound: 'chime', emoji: '🔔', volume: 1 },
    { label: 'ฟันแฟร์', color: '#c084fc', sound: 'fanfare', emoji: '🎺', volume: 1 }, { label: 'หัวใจ', color: '#f472b6', sound: 'heart', emoji: '💗', volume: 1 }, { label: 'เวทมนตร์', color: '#84cc16', sound: 'magic', emoji: '✨', volume: 1 },
    { label: 'ไซเรน', color: '#fb923c', sound: 'alarm', emoji: '🚨', volume: 1 }, { label: 'ต่อยน่ารัก', color: '#facc15', sound: 'punch', emoji: '🥊', volume: 1 }, { label: 'ดึ๋ง', color: '#4ade80', sound: 'boing', emoji: '🌀', volume: 1 },
  ],
};
function load(uid: string): Board { try { return boardSchema.parse(JSON.parse(fs.readFileSync(fileOf(uid), 'utf8'))); } catch { return DEFAULT; } }

export async function beatpadRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/beatpad', { preHandler: requireUser }, async (req) => ({ board: load(getUser(req)!.userId) }));

  app.put('/api/beatpad', { preHandler: requireUser }, async (req, reply) => {
    const parsed = boardSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'ข้อมูลปุ่มไม่ถูกต้อง' });
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(fileOf(getUser(req)!.userId), JSON.stringify(parsed.data));
    return { board: parsed.data };
  });

  // กดปุ่ม → ส่งเสียงไปเล่นที่ลำโพงแดชบอร์ด/จอ FX ของวีเจ (คืนจำนวนเครื่องที่รับ)
  app.post('/api/beatpad/play', { preHandler: requireUser, config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (req, reply) => {
    const parsed = padSchema.safeParse(req.body);
    if (!parsed.success || (!parsed.data.sound && !parsed.data.url && !parsed.data.media)) return reply.code(400).send({ error: 'ปุ่มนี้ยังไม่ได้เลือกเสียง' });
    const { userId } = getUser(req)!;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { tiktokUsername: true } });
    if (!user?.tiktokUsername) return reply.code(400).send({ error: 'ยังไม่ได้ผูกชื่อ TikTok' });
    const { sound, url, volume, label, tab, media, mediaType } = parsed.data;
    const hub = getHub(), name = `🎛️ ${label || 'Beat Pad'}`;
    let screens = 0;
    if (sound || url) screens = (await hub?.emitOwnerCount(userId, user.tiktokUsername, 'action', {
      ruleId: 'beatpad', name, action: { type: 'sound', ...(sound ? { sound } : { url }), volume }, event: { type: 'beatpad' }, ts: Date.now(), times: 1, tab,
    })) ?? 0;
    // สติกเกอร์/วิดีโอ ขึ้นจอ FX ในโปรแกรมไลฟ์
    if (media) screens = Math.max(screens, (await hub?.emitOwnerCount(userId, user.tiktokUsername, 'action', {
      ruleId: 'beatpad', name, action: { type: mediaType === 'video' ? 'video' : 'image', url: media, durationMs: 4000 }, event: { type: 'beatpad' }, ts: Date.now(), times: 1, tab,
    })) ?? 0);
    return { ok: true, screens };
  });
}
