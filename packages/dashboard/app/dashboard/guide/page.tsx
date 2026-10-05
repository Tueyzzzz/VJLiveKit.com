'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Card, PageHeader } from '@/components/ui';

/** หัวข้อพับ/กางได้ */
function Item({ title, children, open }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-xl border border-line bg-white open:shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium">
        {title}<span className="text-muted transition group-open:rotate-90">›</span>
      </summary>
      <div className="space-y-2 border-t border-line px-4 py-3 text-sm leading-relaxed text-ink/90">{children}</div>
    </details>
  );
}
const Step = ({ n, children }: { n: number; children: ReactNode }) => (
  <div className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-pink text-xs font-bold text-white">{n}</span><div>{children}</div></div>
);
const L = ({ href, children }: { href: string; children: ReactNode }) => <Link href={href} className="font-medium text-pink underline">{children}</Link>;

export default function GuidePage() {
  return (
    <div>
      <PageHeader title="คู่มือการใช้งาน" description="ตั้งค่าครั้งเดียว ใช้ได้ทุกไลฟ์ — กดหัวข้อเพื่ออ่าน" />

      <Card className="mb-6">
        <h2 className="mb-3 font-medium">🚀 เริ่มใช้งานใน 3 ขั้นตอน</h2>
        <div className="space-y-3 text-sm">
          <Step n={1}>ไปที่ <L href="/dashboard/">ภาพรวม</L> ใส่ <b>ชื่อ TikTok</b> ของคุณ (ไม่ต้องใส่ @) แล้วกดบันทึก</Step>
          <Step n={2}>ไปที่ <L href="/dashboard/widgets/">วิดเจ็ต & ลิงก์ OBS</L> กด <b>“สร้างลิงก์ชุดใหม่”</b> ครั้งเดียว</Step>
          <Step n={3}>เลือกวิดเจ็ตที่ชอบ กด <b>คัดลอก</b> แล้วนำลิงก์ไปใส่ใน OBS หรือ TikTok LIVE Studio — ขึ้นไลฟ์ได้เลย วิดเจ็ตจะเชื่อมกับไลฟ์ให้เอง</Step>
        </div>
      </Card>

      <div className="space-y-3">
        <h2 className="mt-2 text-sm font-semibold text-violet">ใส่วิดเจ็ตในโปรแกรมไลฟ์</h2>
        <Item title="🖥️ ใส่ใน OBS Studio" open>
          <Step n={1}>ที่ช่อง <b>Sources</b> กด <b>+</b> → เลือก <b>Browser</b> → ตั้งชื่อ → OK</Step>
          <Step n={2}>วางลิงก์ที่คัดลอกมาในช่อง <b>URL</b> · ตั้ง <b>Width 1920</b> / <b>Height 1080</b> (ไลฟ์แนวตั้งใช้ 1080 × 1920)</Step>
          <Step n={3}>กด OK แล้วจัดตำแหน่ง/ขนาดบนจอได้ตามต้องการ</Step>
          <p className="text-muted">เคล็ดลับ: ถ้าวิดเจ็ตยังเป็นแบบเก่า คลิกขวาที่ Source → <b>Refresh</b> (ปกติระบบอัปเดตให้เอง)</p>
        </Item>
        <Item title="📱 ใส่ใน TikTok LIVE Studio">
          <p>เพิ่มแหล่งที่มา (Source) แบบ <b>ลิงก์/เว็บ (Link)</b> แล้ววางลิงก์วิดเจ็ต ตั้งขนาดให้เท่าจอไลฟ์ (แนวนอน 1920 × 1080 หรือแนวตั้ง 1080 × 1920)</p>
          <p className="text-muted">ชื่อเมนูอาจต่างกันเล็กน้อยตามเวอร์ชันของแอป</p>
        </Item>
        <Item title="📐 ไลฟ์แนวตั้ง (มือถือ)">
          <p>ตั้งขนาด Source เป็น <b>1080 × 1920</b> วิดเจ็ตจะจัดวางให้เหมาะกับจอแนวตั้งเอง (เช่น ไพ่ทาโร่ 7 ใบจัดเป็น 2-3-2) ใช้ “เลื่อนแนวนอน/แนวตั้ง” และ “ขนาด” ในหน้าตั้งค่าปรับตำแหน่งเพิ่มได้</p>
        </Item>

        <h2 className="mt-5 text-sm font-semibold text-violet">ตั้งค่าวิดเจ็ต</h2>
        <Item title="🎨 เปลี่ยนแบบ / สี / ขนาด">
          <p>ในหน้าวิดเจ็ต กดปุ่ม ⚙️ ของวิดเจ็ตนั้น → เลือกแบบจากการ์ดรูป (แยกหมวด 🌸 พาสเทล · 🎮 สายเท่ · 🎤 สายนักร้อง) → ปรับสี/ขนาด/ตำแหน่ง → <b>บันทึก</b></p>
          <p>จอใน OBS/TikTok Studio <b>เปลี่ยนตามเองภายในไม่กี่วินาที</b> ไม่ต้องเปลี่ยนลิงก์ ไม่ต้องรีเฟรช</p>
          <p className="text-muted">หน้าตั้งค่ามีลิงก์ของวิดเจ็ตนั้นพร้อมปุ่มคัดลอกอยู่ด้านบนด้วย</p>
        </Item>
        <Item title="🎁 วิดเจ็ตสะสมของขวัญ (โหล ตู้ปลา ต้นไม้ รถลาก ฯลฯ)">
          <p>ของขวัญจริงที่ผู้ชมส่งจะตกลงในโหล/ตู้/ลูกแก้ว, บานเป็นดอกบนต้นไม้, หรือถูกผูกลากท้ายรถ — <b>ของแพงชิ้นใหญ่ตามราคา</b> และมีออร่าเรืองแสง</p>
          <p>ระบบ <b>จำกองของขวัญไว้</b> รีเฟรช/ปิดเปิด OBS แล้วไม่หาย · อยากเริ่มใหม่ กดปุ่ม “ล้าง…” ในหน้าตั้งค่า</p>
          <p>ของขวัญเล็กลง = กองได้มากขึ้น · ตั้ง “ความสูงกองสูงสุด” ได้ ไม่ให้ท่วมจอ</p>
        </Item>
        <Item title="🏆 ลีก TikTok / แถบเป้าหมาย / นาฬิกา">
          <p><b>ลีก:</b> ตั้งลีก ระดับ และ “คะแนนที่มีอยู่แล้ว” ตามที่เห็นในแอป TikTok ก่อนไลฟ์ — ระหว่างไลฟ์ระบบบวกเพชรจากของขวัญจริงให้อัตโนมัติ (TikTok ไม่เปิดให้ดึงค่าลีกโดยตรง)</p>
          <p><b>แถบเป้าหมาย:</b> เลือกนับจากไลค์ / ผู้ติดตาม / แชร์ / เพชร / จำนวนของขวัญ</p>
          <p><b>นาฬิกา (Subathon):</b> ผู้ชมเติมเวลาด้วยของขวัญ/ไลค์/ติดตาม/แชร์ ตามที่ตั้งไว้</p>
        </Item>

        <h2 className="mt-5 text-sm font-semibold text-violet">Actions & ลูกเล่น</h2>
        <Item title="⚡ ตั้งกฎอัตโนมัติ (ได้กิฟต์ → เล่นเสียง/รูป/ข้อความ)">
          <Step n={1}>ใส่วิดเจ็ต <b>Actions & Events (FX)</b> ใน OBS ก่อน (เป็นจอที่แสดงผลของกฎทั้งหมด)</Step>
          <Step n={2}>ไปที่ <L href="/dashboard/actions/">Actions & Events</L> → เพิ่มกฎ → เลือก “เมื่อ” (เช่น ได้รับกิฟต์) และเลือกกิฟต์จากรูป</Step>
          <Step n={3}>เลือก “ให้ทำ”: เล่นเสียง / แสดงรูปหรือ GIF / เล่นวิดีโอ (ใส่ลิงก์ไฟล์ https://) / แสดงข้อความ · ใช้ <code>{'{user}'}</code> แทนชื่อคนส่ง</Step>
          <p className="text-muted">ถ้าเสียงไม่ดัง: คลิกปุ่ม “เปิดเสียง FX” บนจอวิดเจ็ตครั้งเดียว (บางโปรแกรมบล็อกเสียงอัตโนมัติ)</p>
        </Item>
        <Item title="🔮 สุ่มไพ่ทาโร่">
          <p>ในกฎ เลือก “ให้ทำ” = <b>สุ่มไพ่ทาโร่</b> แล้วเลือกจำนวนไพ่</p>
          <ul className="ml-5 list-disc">
            <li><b>1 ใบ</b> — คำทำนายเดียว</li>
            <li><b>3 ใบ</b> — อดีต · ปัจจุบัน · อนาคต</li>
            <li><b>7 ใบ</b> — ดูดวงเต็มชุด (จอแนวนอนเรียงโค้ง จอแนวตั้งเรียง 2-3-2)</li>
          </ul>
          <p>ไพ่จะพลิกเปิดทีละใบพร้อมชื่อคนส่งและคำทำนาย ถ้ามีหลายคนส่งพร้อมกันจะต่อคิวให้</p>
        </Item>

        <h2 className="mt-5 text-sm font-semibold text-violet">บัญชี & แพลน</h2>
        <Item title="💎 ทดลองฟรี / แพลน Pro">
          <p>สมัครใหม่ <b>ใช้ฟรีทุกฟีเจอร์ 30 วัน</b> หลังจากนั้นสมัคร Pro เพื่อใช้ทุกวิดเจ็ตต่อ ดูรายละเอียดที่ <L href="/dashboard/billing/">แพลน & การชำระเงิน</L></p>
          <p>ลิงก์ในโปรแกรมไลฟ์ใช้ได้ตามสิทธิ์ของบัญชี — ต่ออายุแล้วลิงก์เดิมกลับมาใช้ได้เอง ไม่ต้องเปลี่ยน</p>
        </Item>
        <Item title="🎁 แนะนำเพื่อน รับ Pro ฟรี">
          <p>ที่เมนู <L href="/dashboard/referral/">แนะนำเพื่อน รับฟรี</L> คัดลอกลิงก์ส่งให้เพื่อน · เพื่อนสมัครและตั้งชื่อ TikTok ครบ <b>ทุก 10 คน ได้ Pro ฟรี 1 เดือน</b> สะสมได้ไม่จำกัด</p>
        </Item>
        <Item title="🔒 ความปลอดภัยของลิงก์">
          <p>ลิงก์วิดเจ็ตเป็นของบัญชีคุณ <b>อย่าแชร์ให้คนอื่น</b> · ถ้าหลุด ไปที่หน้าวิดเจ็ต กด <b>“เพิกถอน”</b> ชุดนั้น แล้วสร้างชุดใหม่</p>
          <p>เปลี่ยนรหัสผ่านได้ที่หน้า <L href="/dashboard/">ภาพรวม</L></p>
        </Item>

        <h2 className="mt-5 text-sm font-semibold text-violet">คำถามที่พบบ่อย</h2>
        <Item title="❓ วิดเจ็ตขึ้นว่า “ยังเชื่อมต่อไม่ได้ (ยังไม่ได้ไลฟ์?)”">
          <p>ปกติเมื่อยังไม่เริ่มไลฟ์ ระบบจะลองเชื่อมใหม่ให้เองเรื่อย ๆ — พอขึ้นไลฟ์ไม่กี่วินาทีจะต่อได้เอง ถ้าขึ้นไลฟ์แล้วยังไม่ได้ ตรวจว่าชื่อ TikTok ในหน้าภาพรวมถูกต้อง</p>
        </Item>
        <Item title="❓ ลงไลฟ์แล้วขึ้นใหม่ ต้องเปลี่ยนลิงก์ไหม">
          <p>ไม่ต้อง ลิงก์เดิมใช้ได้ตลอด ระบบจะจับไลฟ์ใหม่ให้เอง · อันดับคนส่งของขวัญจะเริ่มนับใหม่ตามไลฟ์ ส่วนกองของขวัญยังอยู่ (กด “ล้าง” ถ้าอยากเริ่มใหม่)</p>
        </Item>
        <Item title="❓ ของขวัญ/อันดับหายตอนระบบอัปเดต?">
          <p>ไม่หาย — ระบบบันทึกกองของขวัญและอันดับ Top Gifters ไว้ และโหลดคืนอัตโนมัติเมื่ออัปเดตกลางไลฟ์</p>
        </Item>
        <Item title="❓ ตั้งค่าแล้วการ์ดตัวอย่างไม่เปลี่ยน">
          <p>กด <b>Ctrl + F5</b> ที่หน้าเว็บหนึ่งครั้งเพื่อล้างหน้าเก่า · จอใน OBS เปลี่ยนตามการตั้งค่าอยู่แล้ว</p>
        </Item>
      </div>
    </div>
  );
}
