import 'dotenv/config';

/** ตั้งค่ากลางของเซิร์ฟเวอร์ อ่านจาก environment variables */
export const config = {
  port: Number(process.env.PORT ?? 8080),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  demoMode: process.env.DEMO_MODE === 'true',
  /** บันทึกสถิติไลฟ์ลงตาราง LiveSession — เปิดหลังรัน migration ของตารางนี้แล้วเท่านั้น */
  liveSessions: process.env.LIVE_SESSIONS === 'true',

  databaseUrl: process.env.DATABASE_URL ?? '',
  redisUrl: process.env.REDIS_URL,

  jwtSecret: process.env.JWT_SECRET ?? 'dev-insecure-secret',
  overlayTokenTtlDays: Number(process.env.OVERLAY_TOKEN_TTL_DAYS ?? 365),

  signApiKey: process.env.SIGN_API_KEY || undefined,

  /** Google Cloud Text-to-Speech (อ่านแชทออกเสียงเป็น mp3) — ไม่ตั้ง = ปิด */
  googleTtsKey: process.env.GOOGLE_TTS_API_KEY || undefined,

  billingProvider: (process.env.BILLING_PROVIDER ?? 'none') as 'none' | 'stripe' | 'omise',
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    priceProMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
  },
  omise: {
    secretKey: process.env.OMISE_SECRET_KEY,
    publicKey: process.env.OMISE_PUBLIC_KEY,
  },

  /** EasySlip (ตรวจสลิปโดเนทอัตโนมัติ) — ไม่ตั้ง = วีเจกดยืนยันโดเนทเองในแดชบอร์ด */
  easyslipKey: process.env.EASYSLIP_API_KEY || undefined,

  /** อีเมลแอดมิน (คั่นด้วย ,) — เข้าหน้าหลังบ้าน /dashboard/admin/ */
  adminEmails: (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),

  publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? 'http://localhost:8080').replace(/\/+$/, ''),

  /** โฟลเดอร์ไฟล์ static ของ Dashboard (Next.js static export) — ไม่มีก็ข้าม */
  dashboardDir: process.env.DASHBOARD_DIR,
};

export type AppConfig = typeof config;
