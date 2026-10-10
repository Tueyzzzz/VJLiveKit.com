import { LayoutDashboard, LayoutTemplate, Zap, CreditCard, Gift, BookOpen, Wallet, ScrollText, Lightbulb, Volume2, Grid3x3, Speech, MessageCircle } from 'lucide-react';

/** เมนูหลักของแดชบอร์ด — ใช้ทั้งเมนูข้าง และการ์ดใหญ่หน้าภาพรวม (img = รูป VJ ใน /menu/<img>.webp) */
export const NAV = [
  { href: '/dashboard/', label: 'ภาพรวม', img: 'overview', desc: 'ภาพรวมบัญชีและกฎที่ตั้งไว้', icon: LayoutDashboard },
  { href: '/dashboard/widgets/', label: 'โอเวอร์เลย์', img: 'overlay', desc: 'วิดเจ็ตบนจอไลฟ์ สร้างลิงก์ใส่ OBS / TikTok Studio', icon: LayoutTemplate },
  { href: '/dashboard/actions/', label: 'Actions & Events', img: 'actions', desc: 'ได้ของขวัญ → เล่นเสียง เอฟเฟกต์ ป้ายไฟ', icon: Zap },
  { href: '/dashboard/sounds/', label: 'เสียงแจ้งเตือน', img: 'sounds', desc: 'เสียงดังที่เว็บนี้ ไม่ต้องใส่ลิงก์', icon: Volume2 },
  { href: '/dashboard/beatpad/', label: 'Beat Pad (กดเสียง)', img: 'beatpad', desc: 'แผงปุ่มเสียงมีม กดเล่นระหว่างไลฟ์', icon: Grid3x3 },
  { href: '/dashboard/tts/', label: 'อ่านแชทออกเสียง (TTS)', img: 'tts', desc: 'อ่านแชทและของขวัญให้ฟังอัตโนมัติ', icon: Speech, soon: true }, // รอเปิดเสียงไทย Google — เทาไว้ก่อน (แอดมินยังเข้าได้)
  { href: '/dashboard/widgets/settings/?type=fxmenu', label: 'เมนูของขวัญ', img: 'fxmenu', desc: 'บอกผู้ชมว่าส่งอะไรได้อะไร', icon: ScrollText },
  { href: '/dashboard/widgets/settings/?type=sign', label: 'ป้ายไฟ LED', img: 'sign', desc: 'ป้ายไฟข้อความวิ่งบนจอ', icon: Lightbulb },
  { href: '/dashboard/donate/', label: 'โดเนทขึ้นจอ', img: 'donate', desc: 'รับโดเนทผ่านพร้อมเพย์ ขึ้นจอทันที', icon: Wallet, soon: true }, // กำลังพัฒนา — เทาไว้ก่อน
  { href: '/dashboard/billing/', label: 'แพลน & การชำระเงิน', img: 'billing', desc: 'ดูแพลน สมัคร Pro', icon: CreditCard },
  { href: '/dashboard/referral/', label: 'แนะนำเพื่อน รับฟรี', img: 'referral', desc: 'ชวนเพื่อนมาใช้ รับใช้ฟรี', icon: Gift },
  { href: '/dashboard/guide/', label: 'คู่มือการใช้งาน', img: 'guide', desc: 'วิธีใช้งานทีละขั้น', icon: BookOpen },
];
