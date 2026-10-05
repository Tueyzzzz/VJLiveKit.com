import { ensurePlans } from '../src/plans/index.js';
import { disconnectDb } from '../src/db/prisma.js';

/** สร้าง/อัปเดตแพลนเริ่มต้น (Free / Pro) — เซิร์ฟเวอร์ก็เรียก ensurePlans() เองตอนสตาร์ทอยู่แล้ว */
ensurePlans()
  .then(() => console.log('seeded plans: free, pro'))
  .finally(() => disconnectDb());
