/** Dashboard เป็น static export (out/) ให้ Fastify เสิร์ฟ — ไม่ต้องมี Node server แยก (เบาสำหรับเครื่อง 1GB) */
// รหัสเวอร์ชันต่อการ build — หน้าเว็บที่เปิดค้างไว้เทียบกับเซิร์ฟเวอร์ แล้วโหลดเวอร์ชันใหม่เอง (ไม่ต้องกด F5)
// เก็บใน env ให้ worker ของ next build (โหลด config ซ้ำ) ได้ค่าเดียวกัน
const BUILD_ID = (process.env.VJL_BUILD_ID ||= Date.now().toString(36));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  generateBuildId: async () => BUILD_ID,
  // เวลา build (เวลาไทย) — แสดงเป็นเลขเวอร์ชันที่มุมเมนู เช่น 2026.10.07-1606
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID, NEXT_PUBLIC_VERSION: (process.env.VJL_VERSION ||= new Date(Date.now() + 7 * 3600_000).toISOString().replace(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d).*/, '$1.$2.$3-$4$5')) },
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default nextConfig;
