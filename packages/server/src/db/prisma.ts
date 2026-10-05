import { PrismaClient } from '@prisma/client';

/** Prisma client ตัวเดียวทั้งแอป (singleton) */
export const prisma = new PrismaClient();

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}
