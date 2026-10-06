import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/Logo';

const TITLE = 'ทางเลือก TikFinity ภาษาไทย — วิดเจ็ตไลฟ์ TikTok สวยแบบเกม';
const DESC = 'กำลังหาโปรแกรมแบบ TikFinity ที่ใช้ภาษาไทย? VJLiveKit คือวิดเจ็ตไลฟ์ TikTok สำหรับ OBS และ TikTok LIVE Studio เมนูไทยทั้งหมด ของขวัญตกลงโหล ตู้ปลา ต้นไม้ รถลาก Top Gifters ลีก TikTok ไพ่ทาโร่ ใช้ฟรีเดือนแรก';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: '/tikfinity-alternative/' },
  openGraph: { title: TITLE, description: DESC, url: '/tikfinity-alternative/', images: [{ url: '/og.png', width: 1200, height: 630 }] },
};

const POINTS: [string, string][] = [
  ['🇹🇭 ภาษาไทยทั้งระบบ', 'เมนู หน้าตั้งค่า คู่มือ และข้อความบนจอเป็นภาษาไทย ตั้งค่าเองได้ง่าย ไม่ต้องแปล'],
  ['🎁 ของขวัญเป็นกราฟิกแบบเกม', 'ของขวัญจริงตกลงโหล ตู้ปลา ลูกแก้วหิมะ โดมอวกาศ บานเป็นดอกบนต้นไม้ หรือผูกลากท้ายรถ — ของแพงชิ้นใหญ่ตามราคา'],
  ['🎨 แบบให้เลือกเยอะ 3 สไตล์', 'พาสเทลน่ารัก · สายเท่เกมมิ่ง (VJ ผู้ชาย) · สายนักร้อง เปลี่ยนสีได้ด้วยการจิ้ม'],
  ['🏆 ลีก TikTok & Top Gifters', 'โดมปลดล็อกลีก B1 → A1 นับเพชรจริง · อันดับคนส่งของขวัญ/คนกดไลค์ จำไว้ไม่หายแม้รีเฟรช'],
  ['🔮 ไพ่ทาโร่และ Actions', 'ได้กิฟต์ → สุ่มไพ่ 1/3/7 ใบพร้อมคำทำนาย หรือเล่นเสียง รูป วิดีโอ ข้อความ อัตโนมัติ'],
  ['📱 ไลฟ์แนวตั้งได้', 'ใช้กับ OBS และ TikTok LIVE Studio ทั้งจอแนวนอนและแนวตั้ง แก้แบบแล้วจอเปลี่ยนเองไม่ต้องรีเฟรช'],
];

/** หน้าเปรียบเทียบสำหรับคนที่ค้นหาโปรแกรมแบบ TikFinity (พูดถึงเฉพาะความสามารถของ VJLiveKit) */
export default function TikfinityAlternative() {
  return (
    <div>
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <Logo />
        <Link href="/register/" className="rounded-xl bg-pink px-4 py-2 text-sm font-medium text-white">ใช้ฟรีเดือนแรก</Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-20">
        <h1 className="mt-6 font-display text-3xl leading-snug sm:text-4xl">ทางเลือก TikFinity ภาษาไทย<br /><span className="text-gradient">VJLiveKit วิดเจ็ตไลฟ์ TikTok สวยแบบเกม</span></h1>
        <p className="mt-4 text-muted">
          ถ้าคุณกำลังหาโปรแกรมแนว TikFinity สำหรับไลฟ์ TikTok — แจ้งเตือนของขวัญ อันดับคนส่งกิฟต์ เป้าหมาย และลูกเล่นบนจอ —
          VJLiveKit ทำงานแบบเดียวกันผ่านลิงก์วิดเจ็ตที่วางใน OBS หรือ TikTok LIVE Studio แต่ออกแบบมาสำหรับสตรีมเมอร์ไทยโดยเฉพาะ
        </p>

        <h2 className="mt-10 text-xl font-semibold">ทำไมสตรีมเมอร์ไทยเลือก VJLiveKit</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {POINTS.map(([t, d]) => (
            <div key={t} className="rounded-xl border border-line bg-white p-4">
              <h3 className="font-medium">{t}</h3>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-10 text-xl font-semibold">เริ่มใช้ใน 3 ขั้นตอน</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
          <li>สมัครสมาชิก (ใช้ฟรีทุกฟีเจอร์เดือนแรก ไม่ต้องใส่บัตร)</li>
          <li>ใส่ชื่อ TikTok ของคุณ แล้วกดสร้างลิงก์วิดเจ็ต</li>
          <li>คัดลอกลิงก์ไปใส่ใน OBS (Browser Source) หรือ TikTok LIVE Studio — ขึ้นไลฟ์ได้เลย</li>
        </ol>

        <h2 className="mt-10 text-xl font-semibold">ราคา</h2>
        <p className="mt-2 text-sm">ใช้ฟรีเดือนแรก จากนั้นแพลน Pro <b>199 บาท/เดือน</b> · แนะนำเพื่อนครบ 10 คน รับ Pro ฟรี 1 เดือน</p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/register/" className="rounded-xl bg-pink px-6 py-3 font-medium text-white">สมัครใช้ฟรีเดือนแรก</Link>
          <Link href="/" className="rounded-xl border border-line bg-white px-6 py-3 font-medium">ดูวิดเจ็ตทั้งหมด</Link>
        </div>

        <p className="mt-12 text-xs text-muted">
          TikFinity และ TikTok เป็นเครื่องหมายการค้าของเจ้าของแต่ละราย VJLiveKit เป็นบริการอิสระ ไม่มีส่วนเกี่ยวข้องกับ TikFinity หรือ TikTok
        </p>
      </main>
    </div>
  );
}
