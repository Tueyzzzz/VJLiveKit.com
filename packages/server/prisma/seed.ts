import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** สร้างแพลนเริ่มต้น: Free / Pro */
async function main(): Promise<void> {
  await prisma.plan.upsert({
    where: { code: 'free' },
    update: {},
    create: {
      code: 'free', name: 'Free', priceCents: 0, currency: 'thb',
      features: { widgets: ['coinjar'], noWatermark: false, tts: false, maxTokens: 1 },
    },
  });
  await prisma.plan.upsert({
    where: { code: 'pro' },
    update: {},
    create: {
      code: 'pro', name: 'Pro', priceCents: 14900, currency: 'thb', // 149 บาท/เดือน (ตัวอย่าง)
      features: { widgets: ['coinjar', 'alerts', 'goal', 'chat', 'tts'], noWatermark: true, tts: true, maxTokens: 20 },
    },
  });
  console.log('seeded plans: free, pro');
}

main().finally(() => prisma.$disconnect());
