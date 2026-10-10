import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'node:crypto';
import os from 'node:os';
import { prisma } from '../db/prisma.js';
import { requireUser, getUser } from '../auth/middleware.js';
import { hashPassword } from '../auth/service.js';
import { config } from '../config/index.js';
import { getEntitlements, trialEndOf } from '../plans/index.js';
import { grantDays } from '../referrals/routes.js';
import { getHub } from '../realtime/hub.js';
import { connStats } from '../realtime/connstats.js';
import { listLives } from '../realtime/lives.js';
import { listSounds } from '../media/routes.js';
import { audit, listAudit, isSuspended, setSuspended, suspendedInfo } from './store.js';
import { settings, updateSettings, DEFAULTS, LIMITS, type SystemSettings } from '../settings/index.js';
import { serverStats } from './server-stats.js';

/** แอดมิน = role ADMIN ในฐานข้อมูล หรืออีเมลอยู่ใน ADMIN_EMAILS */
export function isAdmin(req: FastifyRequest): boolean {
  const c = getUser(req);
  return !!c && (c.role === 'ADMIN' || config.adminEmails.includes(c.email.toLowerCase()));
}
async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireUser(req, reply);
  if (reply.sent) return;
  if (!isAdmin(req)) await reply.code(403).send({ error: 'สำหรับแอดมินเท่านั้น' });
}

const DAY = 86_400_000;

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // ---- ภาพรวม ----
  app.get('/api/admin/overview', { preHandler: requireAdmin }, async () => {
    const now = Date.now(), today = new Date(new Date().setHours(0, 0, 0, 0));
    const [users, today_, week, paid] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.user.count({ where: { createdAt: { gte: new Date(now - 7 * DAY) } } }),
      prisma.subscription.count({ where: { status: 'ACTIVE', currentPeriodEnd: { gt: new Date() } } }),
    ]);
    const trial = await prisma.user.count({ where: { createdAt: { gte: new Date(now - 30 * DAY) }, subscription: { is: null } } });
    const mem = process.memoryUsage();
    return {
      users, signupsToday: today_, signups7d: week, paidActive: paid, inTrial: trial,
      liveNow: getHub()?.liveCount() ?? 0,
      tiktok: { day: connStats.day, attempts: connStats.attempts, success: connStats.success, failed: connStats.failed, signKey: !!config.signApiKey },
      server: {
        uptimeMin: Math.round(process.uptime() / 60), rssMB: Math.round(mem.rss / 1048576), heapMB: Math.round(mem.heapUsed / 1048576),
        load1: Number(os.loadavg()[0].toFixed(2)), cpus: os.cpus().length,
        freeMemMB: Math.round(os.freemem() / 1048576), totalMemMB: Math.round(os.totalmem() / 1048576),
      },
    };
  });

  // ---- ผู้ใช้ ----
  app.get('/api/admin/users', { preHandler: requireAdmin }, async (req) => {
    const q = String((req.query as { q?: string }).q ?? '').trim().replace(/^@/, '');
    const rows = await prisma.user.findMany({
      where: q ? { OR: [{ email: { contains: q, mode: 'insensitive' } }, { tiktokUsername: { contains: q, mode: 'insensitive' } }, { displayName: { contains: q, mode: 'insensitive' } }] } : {},
      orderBy: { createdAt: 'desc' }, take: 100,
      select: { id: true, email: true, displayName: true, tiktokUsername: true, role: true, createdAt: true,
        subscription: { select: { status: true, provider: true, currentPeriodEnd: true } } },
    });
    // สถานะไลฟ์ของลูกค้า: ไลฟ์อยู่ / เปิดเว็บรอไลฟ์ / ออฟไลน์ + ไลฟ์ล่าสุด + จำนวนไลฟ์ 30 วัน
    const hub = getHub(), rooms = new Map((hub?.listRooms() ?? []).map((r) => [r.username.toLowerCase(), r]));
    const all = listLives(), cut = Date.now() - 30 * DAY;
    const users = await Promise.all(rows.map(async (u) => {
      const ent = await getEntitlements(u.id);
      const tk = (u.tiktokUsername ?? '').toLowerCase(), room = tk ? rooms.get(tk) : undefined;
      const mine = tk ? all.filter((l) => l.username.toLowerCase() === tk) : [];
      const live = room?.connected
        ? { status: 'live' as const, viewers: room.viewers, diamonds: room.diamonds, since: room.connectedAt }
        : { status: hub?.webOpen(u.id) || room ? 'online' as const : 'offline' as const };
      return { ...u, live, lastLiveAt: mine.at(-1)?.startedAt ?? null, lives30: mine.filter((l) => new Date(l.startedAt).getTime() >= cut).length, plan: ent.plan, trialEndsAt: ent.trialEndsAt ?? null, trialEnd: trialEndOf(u.createdAt), admin: u.role === 'ADMIN' || config.adminEmails.includes(u.email.toLowerCase()) };
    }));
    return { users };
  });

  // แจก Pro เพิ่ม (วัน)
  app.post('/api/admin/users/:id/grant', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const days = Math.round(Number((req.body as { days?: number } | undefined)?.days ?? 30));
    if (!Number.isFinite(days) || days < 1 || days > 3650) return reply.code(400).send({ error: 'จำนวนวันไม่ถูกต้อง' });
    if (!(await prisma.user.findUnique({ where: { id }, select: { id: true } }))) return reply.code(404).send({ error: 'ไม่พบผู้ใช้' });
    await grantDays(id, days);
    audit(getUser(req)!.email, 'แจก Pro', id, `${days} วัน`);
    return { ok: true, entitlements: await getEntitlements(id) };
  });

  // รีเซ็ตรหัสผ่าน → รหัสชั่วคราว (แอดมินส่งให้ผู้ใช้เอง แล้วให้ผู้ใช้เปลี่ยนในหน้าภาพรวม)
  app.post('/api/admin/users/:id/reset-password', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await prisma.user.findUnique({ where: { id }, select: { id: true } }))) return reply.code(404).send({ error: 'ไม่พบผู้ใช้' });
    const temp = crypto.randomBytes(6).toString('base64url'); // 8 ตัวอักษร
    await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(temp) } });
    audit(getUser(req)!.email, 'รีเซ็ตรหัสผ่าน', id);
    return { ok: true, tempPassword: temp };
  });

  // ---- รายงาน ----
  app.get('/api/admin/reports', { preHandler: requireAdmin }, async () => {
    const now = Date.now(), since = new Date(now - 30 * DAY);
    const recent = await prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } });
    const byDay: Record<string, number> = {};
    const thDay = (ms: number) => new Date(ms + 7 * 3_600_000).toISOString().slice(0, 10); // นับวันตามเวลาไทย
    for (let i = 29; i >= 0; i--) byDay[thDay(now - i * DAY)] = 0;
    for (const u of recent) { const k = thDay(u.createdAt.getTime()); if (k in byDay) byDay[k]++; }
    const [total, pro, trial] = await Promise.all([
      prisma.user.count(),
      prisma.subscription.count({ where: { status: 'ACTIVE', currentPeriodEnd: { gt: new Date() } } }),
      prisma.user.count({ where: { createdAt: { gte: since }, OR: [{ subscription: { is: null } }, { subscription: { isNot: { status: 'ACTIVE' } } }] } }),
    ]);
    const paid = await prisma.payment.findMany({ where: { status: 'PAID', createdAt: { gte: new Date(now - 365 * DAY) } }, select: { amountCents: true, createdAt: true } });
    const revenue: Record<string, number> = {};
    for (const p of paid) { const k = p.createdAt.toISOString().slice(0, 7); revenue[k] = (revenue[k] ?? 0) + p.amountCents / 100; }
    const refs = await prisma.widgetConfig.findMany({ where: { type: '_referral' }, select: { settings: true } });
    const refCount: Record<string, number> = {};
    for (const r of refs) { const by = (r.settings as { by?: string } | null)?.by; if (by) refCount[by] = (refCount[by] ?? 0) + 1; }
    const topIds = Object.entries(refCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const topUsers = await prisma.user.findMany({ where: { id: { in: topIds.map(([id]) => id) } }, select: { id: true, email: true, tiktokUsername: true } });
    // ลูกค้าใช้ฟีเจอร์อะไรบ้าง: ตั้งค่าวิดเจ็ตไหน (กี่คน) + กฎ Actions แต่ละแบบ
    const cfgs = await prisma.widgetConfig.findMany({ where: { NOT: { type: { startsWith: '_' } } }, select: { type: true } });
    const widgetUse: Record<string, number> = {};
    for (const c of cfgs) widgetUse[c.type] = (widgetUse[c.type] ?? 0) + 1;
    const rules = await prisma.actionRule.findMany({ select: { action: true, trigger: true, userId: true, enabled: true } });
    const actionUse: Record<string, number> = {}, triggerUse: Record<string, number> = {}, giftUse: Record<string, number> = {};
    for (const r of rules) {
      const a = (r.action as { type?: string } | null)?.type ?? '?', t = r.trigger as { event?: string; giftName?: string } | null;
      actionUse[a] = (actionUse[a] ?? 0) + 1; if (t?.event) triggerUse[t.event] = (triggerUse[t.event] ?? 0) + 1;
      if (t?.giftName) giftUse[t.giftName] = (giftUse[t.giftName] ?? 0) + 1;
    }
    return {
      usage: { widgetUse, actionUse, triggerUse, topGifts: Object.entries(giftUse).sort((a, b) => b[1] - a[1]).slice(0, 10), rules: rules.length, usersWithRules: new Set(rules.map((r) => r.userId)).size },
      signupsByDay: Object.entries(byDay).map(([day, n]) => ({ day, n })),
      plans: { pro, trial, free: Math.max(0, total - pro - trial), total },
      revenueByMonth: Object.entries(revenue).sort().map(([month, baht]) => ({ month, baht })),
      topReferrers: topIds.map(([id, n]) => { const u = topUsers.find((x) => x.id === id); return { email: u?.email ?? id, tiktok: u?.tiktokUsername ?? null, referred: n }; }),
    };
  });

  // รายชื่อลูกค้าทั้งหมดเป็น CSV (เปิดใน Excel ได้ — มี BOM ให้ภาษาไทยไม่เพี้ยน)
  app.get('/api/admin/users.csv', { preHandler: requireAdmin }, async (_req, reply) => {
    const rows = await prisma.user.findMany({ orderBy: { createdAt: 'desc' },
      select: { email: true, displayName: true, tiktokUsername: true, createdAt: true, subscription: { select: { status: true, provider: true, currentPeriodEnd: true } } } });
    const esc = (v: unknown) => { const t = v == null ? '' : String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const now = Date.now();
    const lines = [['อีเมล', 'ชื่อที่แสดง', 'TikTok', 'สมัครเมื่อ', 'แพลน', 'หมดสิทธิ์', 'ช่องทาง'].join(',')];
    for (const u of rows) {
      const activeSub = u.subscription?.status === 'ACTIVE' && (u.subscription.currentPeriodEnd?.getTime() ?? 0) > now;
      const trialEnd = trialEndOf(u.createdAt).getTime();
      const plan = activeSub ? 'Pro' : trialEnd > now ? 'ทดลองฟรี' : 'Free';
      const until = activeSub ? u.subscription!.currentPeriodEnd!.toISOString().slice(0, 10) : trialEnd > now ? new Date(trialEnd).toISOString().slice(0, 10) : '';
      lines.push([u.email, u.displayName, u.tiktokUsername, u.createdAt.toISOString().slice(0, 10), plan, until, u.subscription?.provider ?? ''].map(esc).join(','));
    }
    reply.header('content-type', 'text/csv; charset=utf-8').header('content-disposition', `attachment; filename="vjlivekit-users-${new Date().toISOString().slice(0, 10)}.csv"`);
    return String.fromCharCode(0xfeff) + lines.join(String.fromCharCode(13, 10)); // BOM + CRLF -> Excel อ่านภาษาไทยถูก
  });

  // ---- ไลฟ์ที่เชื่อมต่ออยู่ ----
  // ตั้งค่าระบบ (แก้แล้วมีผลทันที ไม่ต้อง deploy)
  app.get('/api/admin/settings', { preHandler: requireAdmin }, async () => ({ settings: settings(), defaults: DEFAULTS, limits: LIMITS }));
  app.put('/api/admin/settings', { preHandler: requireAdmin }, async (req) => {
    const before = settings(), after = updateSettings((req.body ?? {}) as Partial<SystemSettings>);
    const diff = Object.keys(after).filter((k) => (after as unknown as Record<string, unknown>)[k] !== (before as unknown as Record<string, unknown>)[k])
      .map((k) => `${k}: ${String((before as unknown as Record<string, unknown>)[k])} → ${String((after as unknown as Record<string, unknown>)[k])}`).join(', ');
    if (diff) audit(getUser(req)!.email, 'แก้ตั้งค่าระบบ', undefined, diff);
    return { settings: after };
  });

  // ---- ลูกค้ารายคน: ดูทุกอย่าง + จัดการ ----
  app.get('/api/admin/users/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const u = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, displayName: true, tiktokUsername: true, role: true, createdAt: true, updatedAt: true,
        subscription: { select: { status: true, provider: true, currentPeriodEnd: true, cancelAtPeriodEnd: true, plan: { select: { code: true } } } },
        payments: { orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, provider: true, amountCents: true, currency: true, status: true, createdAt: true } },
        overlayTokens: { orderBy: { createdAt: 'desc' }, select: { id: true, label: true, revoked: true, createdAt: true } },
        actionRules: { orderBy: { createdAt: 'desc' }, select: { id: true, name: true, enabled: true, trigger: true, action: true } },
        widgetConfigs: { select: { type: true, updatedAt: true, settings: true } } },
    });
    if (!u) return reply.code(404).send({ error: 'ไม่พบผู้ใช้' });
    const ent = await getEntitlements(id);
    const tk = (u.tiktokUsername ?? '').toLowerCase();
    const lives = tk ? listLives().filter((l) => l.username.toLowerCase() === tk).slice(-20).reverse() : [];
    const room = tk ? (getHub()?.listRooms() ?? []).find((r) => r.username.toLowerCase() === tk) : undefined;
    return {
      user: { ...u, widgetConfigs: u.widgetConfigs.filter((w) => !w.type.startsWith('_')) },
      entitlements: ent, trialEnd: trialEndOf(u.createdAt),
      admin: u.role === 'ADMIN' || config.adminEmails.includes(u.email.toLowerCase()), adminByEnv: config.adminEmails.includes(u.email.toLowerCase()),
      suspended: suspendedInfo(id),
      live: room ? { connected: room.connected, viewers: room.viewers, diamonds: room.diamonds, widgets: room.widgets } : null,
      webOpen: getHub()?.webOpen(id) ?? false,
      sounds: listSounds(id),
      lives,
    };
  });

  app.post('/api/admin/users/:id/role', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const admin = !!(req.body as { admin?: boolean } | undefined)?.admin;
    if (id === getUser(req)!.userId && !admin) return reply.code(400).send({ error: 'ถอดสิทธิ์แอดมินตัวเองไม่ได้' });
    await prisma.user.update({ where: { id }, data: { role: admin ? 'ADMIN' : 'USER' } }).catch(() => null);
    audit(getUser(req)!.email, admin ? 'ตั้งเป็นแอดมิน' : 'ถอดแอดมิน', id);
    return { ok: true };
  });

  app.post('/api/admin/users/:id/suspend', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { on, reason } = (req.body ?? {}) as { on?: boolean; reason?: string };
    if (id === getUser(req)!.userId) return reply.code(400).send({ error: 'ระงับบัญชีตัวเองไม่ได้' });
    setSuspended(id, !!on, reason ?? '');
    audit(getUser(req)!.email, on ? 'ระงับบัญชี' : 'ยกเลิกระงับ', id, reason);
    return { ok: true, suspended: isSuspended(id) };
  });

  // ยกเลิก Pro ที่แอดมินแจก (ไม่ยุ่งกับรอบบิลบัตรของ Stripe — ให้ยกเลิกที่ Stripe แทน)
  app.post('/api/admin/users/:id/revoke-pro', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const sub = await prisma.subscription.findUnique({ where: { userId: id } });
    if (!sub) return reply.code(400).send({ error: 'ผู้ใช้นี้ไม่มี Pro' });
    if (sub.provider === 'stripe' && sub.status === 'ACTIVE') return reply.code(400).send({ error: 'Pro นี้ตัดบัตรอัตโนมัติผ่าน Stripe — ยกเลิกที่ Stripe แทน' });
    await prisma.subscription.update({ where: { userId: id }, data: { status: 'CANCELED', currentPeriodEnd: new Date() } });
    audit(getUser(req)!.email, 'ยกเลิก Pro', id);
    return { ok: true, entitlements: await getEntitlements(id) };
  });

  app.post('/api/admin/users/:id/revoke-tokens', { preHandler: requireAdmin }, async (req) => {
    const { id } = req.params as { id: string };
    const r = await prisma.overlayToken.updateMany({ where: { userId: id, revoked: false }, data: { revoked: true } });
    audit(getUser(req)!.email, 'เพิกถอนลิงก์วิดเจ็ตทั้งหมด', id, `${r.count} ชุด`);
    return { ok: true, count: r.count };
  });

  // ---- การชำระเงิน + บันทึกการกระทำ ----
  app.get('/api/admin/payments', { preHandler: requireAdmin }, async () => {
    const payments = await prisma.payment.findMany({ orderBy: { createdAt: 'desc' }, take: 200,
      select: { id: true, provider: true, providerRef: true, amountCents: true, currency: true, status: true, createdAt: true, user: { select: { id: true, email: true, tiktokUsername: true } } } });
    return { payments };
  });
  app.get('/api/admin/audit', { preHandler: requireAdmin }, async () => ({ audit: listAudit().slice(0, 300) }));

  app.get('/api/admin/live', { preHandler: requireAdmin }, async () => ({ rooms: getHub()?.listRooms() ?? [] }));
  // สุขภาพเซิร์ฟเวอร์ (แท็บ "เซิร์ฟเวอร์")
  app.get('/api/admin/server', { preHandler: requireAdmin }, async () => {
    const rooms = getHub()?.listRooms() ?? [];
    return serverStats({ rooms: rooms.length, liveRooms: rooms.filter((r) => r.connected).length });
  });
  // แอดมินช่วยลูกค้าโดยไม่ต้องบอก: สั่งวิดเจ็ตบนจอรีโหลด (ของขวัญไม่หาย) + ดูของขวัญล่าสุดของห้อง
  app.post('/api/admin/live/:username/reload', { preHandler: requireAdmin }, async (req) => {
    const { username } = req.params as { username: string };
    return { ok: true, screens: (await getHub()?.reloadRoom(username)) ?? 0 };
  });
  app.post('/api/admin/live-reload-all', { preHandler: requireAdmin }, async () => {
    const hub = getHub(); let screens = 0;
    for (const r of hub?.listRooms() ?? []) screens += await hub!.reloadRoom(r.username);
    return { ok: true, screens };
  });
  app.get('/api/admin/live/:username/gifts', { preHandler: requireAdmin }, async (req, reply) => {
    const { username } = req.params as { username: string };
    const gifts = getHub()?.recentGifts(username);
    if (!gifts) return reply.code(404).send({ error: 'ไม่พบห้องนี้' });
    return { gifts };
  });

  // จำนวนไลฟ์ (1 รหัสห้องไลฟ์ TikTok = 1 ไลฟ์) — วันนี้ / 7 วัน / 30 วัน / ทั้งหมด + อันดับวีเจที่ไลฟ์บ่อย + ไลฟ์ล่าสุด
  app.get('/api/admin/lives', { preHandler: requireAdmin }, async () => {
    const all = listLives(), now = Date.now();
    const TZ = 7 * 3_600_000; // นับวันตามเวลาไทย
    const startToday = new Date(Math.floor((now + TZ) / DAY) * DAY - TZ);
    const since = (ms: number) => all.filter((l) => new Date(l.startedAt).getTime() >= ms);
    const per = new Map<string, { username: string; lives: number; diamonds: number; last: string }>();
    for (const l of since(now - 30 * DAY)) {
      const p = per.get(l.username) ?? { username: l.username, lives: 0, diamonds: 0, last: l.startedAt };
      p.lives++; p.diamonds += l.diamonds; if (l.startedAt > p.last) p.last = l.startedAt; per.set(l.username, p);
    }
    const daily: { date: string; lives: number; streamers: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d0 = new Date(startToday.getTime() - i * DAY), d1 = d0.getTime() + DAY;
      const ls = all.filter((l) => { const t = new Date(l.startedAt).getTime(); return t >= d0.getTime() && t < d1; });
      daily.push({ date: new Date(d0.getTime() + TZ).toISOString().slice(0, 10), lives: ls.length, streamers: new Set(ls.map((l) => l.username)).size });
    }
    return {
      totals: { today: since(startToday.getTime()).length, d7: since(now - 7 * DAY).length, d30: since(now - 30 * DAY).length, all: all.length,
        streamers30: per.size, liveNow: (getHub()?.listRooms() ?? []).filter((r) => r.connected).length },
      daily,
      top: [...per.values()].sort((a, b) => b.lives - a.lives).slice(0, 20),
      recent: all.slice(-30).reverse(),
    };
  });
}
