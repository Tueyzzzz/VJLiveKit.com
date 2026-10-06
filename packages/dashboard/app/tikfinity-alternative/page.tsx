import type { Metadata } from 'next';
import { AltPage } from '@/components/AltPage';

const TITLE = 'ทางเลือก TikFinity ภาษาไทย — วิดเจ็ตไลฟ์ TikTok สวยแบบเกม';
const DESC = 'กำลังหาโปรแกรมแบบ TikFinity ที่ใช้ภาษาไทย? VJLiveKit คือวิดเจ็ตไลฟ์ TikTok สำหรับ OBS และ TikTok LIVE Studio เมนูไทยทั้งหมด ของขวัญตกลงโหล ตู้ปลา ต้นไม้ รถลาก Top Gifters ลีก TikTok ไพ่ทาโร่ ใช้ฟรีเดือนแรก';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: '/tikfinity-alternative/' },
  openGraph: { title: TITLE, description: DESC, url: '/tikfinity-alternative/', images: [{ url: '/og.png', width: 1200, height: 630 }] },
};

export default function Page() {
  return <AltPage name="TikFinity" intro="ถ้าคุณกำลังหาโปรแกรมแนว TikFinity สำหรับไลฟ์ TikTok — แจ้งเตือนของขวัญ อันดับคนส่งกิฟต์ เป้าหมาย และลูกเล่นบนจอ — VJLiveKit ทำงานแบบเดียวกันผ่านลิงก์วิดเจ็ตที่วางใน OBS หรือ TikTok LIVE Studio แต่ออกแบบมาสำหรับสตรีมเมอร์ไทยโดยเฉพาะ" />;
}
