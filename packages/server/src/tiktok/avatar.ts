import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';

/**
 * รูปโปรไฟล์ TikTok จากชื่อผู้ใช้ — ดึงจากหน้าโปรไฟล์สาธารณะ แล้วเก็บไว้ในเครื่อง 24 ชม.
 * (ลิงก์รูปของ TikTok มีวันหมดอายุ จึงเก็บตัวรูปไว้เอง ไม่เก็บแค่ลิงก์)
 * GET /api/tiktok/avatar/:username → รูป (jpeg/webp) หรือ 404
 */
const DIR = path.join(process.env.SNAPSHOT_DIR ? path.dirname(process.env.SNAPSHOT_DIR) : path.resolve(process.cwd(), '../../data'), 'avatars');
const TTL = 24 * 3600_000, MISS_TTL = 30 * 60_000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const misses = new Map<string, number>();
const inflight = new Map<string, Promise<string | null>>();

async function fetchAvatar(user: string): Promise<string | null> {
  const file = path.join(DIR, `${user}.img`);
  try { if (Date.now() - fs.statSync(file).mtimeMs < TTL) return file; } catch { /* ยังไม่มี */ }
  if ((misses.get(user) ?? 0) > Date.now()) return fs.existsSync(file) ? file : null;
  try {
    const html = await fetch(`https://www.tiktok.com/@${user}`, { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' }, signal: AbortSignal.timeout(10_000) }).then((r) => r.text());
    const m = /"avatar(?:Larger|Medium)":"([^"]+)"/.exec(html);
    if (!m) throw new Error('no avatar');
    const url = JSON.parse(`"${m[1]}"`) as string; // ถอด /
    if (!/^https:\/\/[\w.-]+\.tiktokcdn(-\w+)?\.com\//.test(url)) throw new Error('bad url');
    const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(String(res.status));
    const img = Buffer.from(new Uint8Array(await res.arrayBuffer()));
    if (img.length < 200 || img.length > 3_000_000) throw new Error('bad image');
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(file, img);
    return file;
  } catch {
    misses.set(user, Date.now() + MISS_TTL); // ไม่เจอ/โดนบล็อก → พักก่อนค่อยลองใหม่
    return fs.existsSync(file) ? file : null; // มีรูปเก่าก็ใช้รูปเก่าไปก่อน
  }
}

export async function avatarRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/tiktok/avatar/:username', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const user = String((req.params as { username: string }).username).replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9._]{2,24}$/.test(user)) return reply.code(400).send({ error: 'ชื่อ TikTok ไม่ถูกต้อง' });
    let p = inflight.get(user);
    if (!p) { p = fetchAvatar(user).finally(() => inflight.delete(user)); inflight.set(user, p); }
    const file = await p;
    if (!file) return reply.code(404).send({ error: 'ไม่พบรูปโปรไฟล์' });
    const buf = fs.readFileSync(file);
    const type = buf.subarray(0, 4).toString('hex') === '52494646' ? 'image/webp' : buf[0] === 0x89 ? 'image/png' : 'image/jpeg';
    return reply.type(type).header('cache-control', 'public, max-age=3600').send(buf);
  });
}
