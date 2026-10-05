import 'dotenv/config';

/** ตั้งค่ากลางของเซิร์ฟเวอร์ อ่านจาก environment variables */
export const config = {
  port: Number(process.env.PORT ?? 8080),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  demoMode: process.env.DEMO_MODE === 'true',

  databaseUrl: process.env.DATABASE_URL ?? '',
  redisUrl: process.env.REDIS_URL,

  jwtSecret: process.env.JWT_SECRET ?? 'dev-insecure-secret',
  overlayTokenTtlDays: Number(process.env.OVERLAY_TOKEN_TTL_DAYS ?? 365),

  signApiKey: process.env.SIGN_API_KEY || undefined,

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

  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:8080',
};

export type AppConfig = typeof config;
