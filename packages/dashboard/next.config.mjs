/** Dashboard เป็น static export (out/) ให้ Fastify เสิร์ฟ — ไม่ต้องมี Node server แยก (เบาสำหรับเครื่อง 1GB) */
// รหัสเวอร์ชันต่อการ build — หน้าเว็บที่เปิดค้างไว้เทียบกับเซิร์ฟเวอร์ แล้วโหลดเวอร์ชันใหม่เอง (ไม่ต้องกด F5)
// เก็บใน env ให้ worker ของ next build (โหลด config ซ้ำ) ได้ค่าเดียวกัน
const BUILD_ID = (process.env.VJL_BUILD_ID ||= Date.now().toString(36));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  generateBuildId: async () => BUILD_ID,
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default nextConfig;
