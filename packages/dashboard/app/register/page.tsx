import type { Metadata } from 'next';
import { AuthForm } from '@/components/AuthForm';

export const metadata: Metadata = { title: 'สมัครใช้ฟรีเดือนแรก', description: 'สมัคร VJLiveKit ใช้วิดเจ็ตไลฟ์ TikTok ทุกฟีเจอร์ฟรี 30 วัน ไม่ต้องใส่บัตร', alternates: { canonical: '/register/' } };

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
