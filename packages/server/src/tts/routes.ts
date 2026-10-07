import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config/index.js';
import { prisma } from '../db/prisma.js';
import { verifyOverlayToken } from '../widgets/tokens.js';
import { requireUser, getUser } from '../auth/middleware.js';
import { getEntitlements } from '../plans/index.js';

/**
 * อ่านออกเสียง (TTS) ฝั่งเซิร์ฟเวอร์ด้วย Google Cloud Text-to-Speech -> ไฟล์ mp3
 * overlay เล่นเป็น <audio> ได้ทั้งใน OBS Browser Source และทุกเครื่อง (ไม่พึ่งเสียงในเบราว์เซอร์)
 * ต้องตั้ง GOOGLE_TTS_API_KEY — ไม่ตั้ง = ปิด (overlay ถอยไปใช้ Web Speech ของเบราว์เซอร์)
 */

const MAX_TEXT = 200;
const CACHE_MAX = 300;
const cache = new Map<string, Buffer>(); // LRU อย่างง่าย: ข้อความซ้ำ ๆ (เช่น "ขอบคุณสำหรับ Rose") ไม่ต้องเรียก Google ซ้ำ

function cacheGet(key: string): Buffer | undefined {
  const v = cache.get(key);
  if (v) { cache.delete(key); cache.set(key, v); }
  return v;
}
function cacheSet(key: string, v: Buffer): void {
  cache.set(key, v);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
}

const querySchema = z.object({
  t: z.string().min(10),
  text: z.string().trim().min(1).max(1000),
  voice: z.string().regex(/^[a-z]{2,3}-[A-Z]{2}-[A-Za-z0-9-]+$/).default('th-TH-Neural2-C'),
  rate: z.coerce.number().min(0.25).max(4).default(1),
  pitch: z.coerce.number().min(-20).max(20).default(0),
});

async function synthesize(text: string, voice: string, rate: number, pitch: number): Promise<Buffer> {
  const languageCode = voice.split('-').slice(0, 2).join('-');
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(config.googleTtsKey!)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode, name: voice },
      // Chirp3-HD ไม่รองรับ pitch
      audioConfig: { audioEncoding: 'MP3', speakingRate: rate, ...(voice.includes('Chirp') ? {} : { pitch }) },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Google TTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { audioContent?: string };
  if (!json.audioContent) throw new Error('Google TTS: ไม่มีเสียงตอบกลับ');
  return Buffer.from(json.audioContent, 'base64');
}

async function cached(text: string, voice: string, rate: number, pitch: number): Promise<Buffer> {
  const key = `${voice}|${rate}|${pitch}|${text}`;
  let audio = cacheGet(key);
  if (!audio) { audio = await synthesize(text, voice, rate, pitch); cacheSet(key, audio); }
  return audio;
}

const sayBody = z.object({
  text: z.string().trim().min(1).max(1000),
  voice: z.string().regex(/^[a-z]{2,3}-[A-Z]{2}-[A-Za-z0-9-]+$/).default('th-TH-Neural2-C'),
  rate: z.coerce.number().min(0.25).max(4).default(1),
  pitch: z.coerce.number().min(-20).max(20).default(0),
});

export async function ttsRoutes(app: FastifyInstance): Promise<void> {
  // อ่านแชทออกเสียงบนหน้าเว็บ (ล็อกอิน) — เสียงไทยจาก Google ใช้ได้ทุกเบราว์เซอร์ ไม่ต้องมีเสียงไทยในเครื่อง
  app.post('/api/tts/say', {
    preHandler: requireUser,
    config: { rateLimit: { max: 90, timeWindow: '1 minute', keyGenerator: (req) => getUser(req)?.userId ?? req.ip } },
  }, async (req, reply) => {
    if (!config.googleTtsKey) return reply.code(503).send({ error: 'ยังไม่ได้ตั้งค่า GOOGLE_TTS_API_KEY' });
    const parsed = sayBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'ข้อมูลไม่ถูกต้อง' });
    const en = await getEntitlements(getUser(req)!.userId);
    if (!en.widgets.includes('tts')) return reply.code(403).send({ error: 'อ่านแชทออกเสียงใช้ได้ในแพลน Pro' });
    const { voice, rate, pitch } = parsed.data;
    try { return reply.type('audio/mpeg').send(await cached(parsed.data.text.slice(0, MAX_TEXT), voice, rate, pitch)); }
    catch (err) { req.log.error(err, 'tts failed'); return reply.code(502).send({ error: 'สร้างเสียงไม่สำเร็จ' }); }
  });

  app.get('/api/tts/status', async () => ({ enabled: !!config.googleTtsKey }));

  app.get('/api/tts', {
    // จำกัดต่อ overlay token กันถูกใช้เป็นบริการ TTS ฟรีจนเกินโควตา
    config: { rateLimit: { max: 120, timeWindow: '1 minute', keyGenerator: (req) => String((req.query as { t?: string }).t ?? req.ip).slice(-32) } },
  }, async (req, reply) => {
    if (!config.googleTtsKey) return reply.code(503).send({ error: 'ยังไม่ได้ตั้งค่า GOOGLE_TTS_API_KEY' });
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'ข้อมูลไม่ถูกต้อง' });
    const { t, voice, rate, pitch } = parsed.data;
    const text = parsed.data.text.slice(0, MAX_TEXT);

    const payload = verifyOverlayToken(t);
    if (!payload?.tid) return reply.code(401).send({ error: 'token ไม่ถูกต้อง' });
    const token = await prisma.overlayToken.findUnique({ where: { id: payload.tid }, select: { revoked: true, userId: true } });
    if (!token || token.revoked || token.userId !== payload.userId) return reply.code(401).send({ error: 'token ถูกเพิกถอนแล้ว' });

    const key = `${voice}|${rate}|${pitch}|${text}`;
    let audio = cacheGet(key);
    if (!audio) {
      try { audio = await synthesize(text, voice, rate, pitch); }
      catch (err) { req.log.error(err, 'tts failed'); return reply.code(502).send({ error: 'สร้างเสียงไม่สำเร็จ' }); }
      cacheSet(key, audio);
    }
    return reply.header('cache-control', 'private, max-age=3600').type('audio/mpeg').send(audio);
  });
}
