/** Dashboard เป็น static export (out/) ให้ Fastify เสิร์ฟ — ไม่ต้องมี Node server แยก (เบาสำหรับเครื่อง 1GB) */
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default nextConfig;
