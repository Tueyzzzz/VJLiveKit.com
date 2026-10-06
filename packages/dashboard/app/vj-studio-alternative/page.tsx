import type { Metadata } from 'next';
import { AltPage } from '@/components/AltPage';

const TITLE = 'ทางเลือก วีเจ.com / VJ Studio — วิดเจ็ตไลฟ์ TikTok ภาษาไทย';
const DESC = 'กำลังหาเว็บแบบ วีเจ.com หรือ VJ Studio? VJLiveKit วิดเจ็ตไลฟ์ TikTok ภาษาไทย กราฟิก 3D แบบเกม โหลของขวัญ Coin Jar ตู้ปลา ต้นไม้ รถลาก ลีก TikTok ไพ่ทาโร่ ใช้กับ OBS และ TikTok LIVE Studio ใช้ฟรีเดือนแรก';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: '/vj-studio-alternative/' },
  openGraph: { title: TITLE, description: DESC, url: '/vj-studio-alternative/', images: [{ url: '/og.png', width: 1200, height: 630 }] },
};

export default function Page() {
  return <AltPage name="วีเจ.com (VJ Studio)" intro="ถ้าคุณกำลังหาเว็บวิดเจ็ตไลฟ์ TikTok แบบ วีเจ.com — ของขวัญตกลงโหล Coin Jar อันดับคนส่งกิฟต์ และลูกเล่นบนจอ — ลองดู VJLiveKit อีกตัวเลือกสำหรับวีเจไทย มีธีมกราฟิก 3D ให้เลือกหลายสไตล์ ใช้ลิงก์เดียววางใน OBS หรือ TikTok LIVE Studio ได้ทันที" />;
}
