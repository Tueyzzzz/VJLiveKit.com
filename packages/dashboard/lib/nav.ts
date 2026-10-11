import { Swords, LayoutDashboard, LayoutTemplate, Zap, CreditCard, Gift, BookOpen, Wallet, ScrollText, Lightbulb, Volume2, Grid3x3, Speech, MessageCircle, Smile, Medal, Trophy, TrendingUp } from 'lucide-react';

/** เมนูหลักของแดชบอร์ด (section = หัวข้อหมวดในเมนูข้าง ให้หาง่าย) — ใช้ทั้งเมนูข้าง และการ์ดใหญ่หน้าภาพรวม (img = รูป VJ ใน /menu/<img>.webp) */
export const NAV = [
  { section: '', href: '/dashboard/', label: 'ภาพรวม', img: 'overview', desc: 'ภาพรวมบัญชีและกฎที่ตั้งไว้', icon: LayoutDashboard },
  { section: 'บนจอไลฟ์', href: '/dashboard/widgets/', label: 'โอเวอร์เลย์', img: 'overlay', desc: 'วิดเจ็ตบนจอไลฟ์ สร้างลิงก์ใส่ OBS / TikTok Studio', icon: LayoutTemplate },
  { section: 'บนจอไลฟ์', href: '/dashboard/widgets/settings/?type=mascot', label: 'ตัวแทนวีเจ', img: 'mascot', desc: 'ตัวละครเดิน เต้น รับของขวัญบนจอ เลือกได้หลายสิบแบบ', icon: Smile },
  { section: 'บนจอไลฟ์', href: '/dashboard/widgets/?g=rank', label: 'อันดับผู้ชม', img: 'rank', desc: 'อันดับคนส่งของขวัญ คนกดหัวใจ กรอบ MVP', icon: Medal },
  { section: 'บนจอไลฟ์', href: '/dashboard/widgets/?g=goal', label: 'เป้าหมายและลีก', img: 'goal', desc: 'เป้าของขวัญ ลีก และตัวนับเวลา', icon: Trophy },
  { section: 'บนจอไลฟ์', href: '/dashboard/widgets/settings/?type=fxmenu', label: 'เมนูของขวัญ', img: 'fxmenu', desc: 'บอกผู้ชมว่าส่งอะไรได้อะไร', icon: ScrollText },
  { section: 'บนจอไลฟ์', href: '/dashboard/widgets/settings/?type=sign', label: 'ป้ายไฟ LED', img: 'sign', desc: 'ป้ายไฟข้อความวิ่งบนจอ', icon: Lightbulb },
  { section: 'ของขวัญ → เอฟเฟกต์', href: '/dashboard/actions/', label: 'Actions & Events', img: 'actions', desc: 'ได้ของขวัญ → เล่นเสียง เอฟเฟกต์ ป้ายไฟ', icon: Zap },
  { section: 'ของขวัญ → เอฟเฟกต์', href: '/dashboard/pk/', label: 'PK Battle', img: 'pk', desc: 'เริ่ม PK · ชนะ/แพ้ · การ์ดนวม สายฟ้า → เอฟเฟกต์บนจอ', icon: Swords },
  { section: 'เสียง', href: '/dashboard/sounds/', label: 'เสียงแจ้งเตือน', img: 'sounds', desc: 'เสียงดังที่เว็บนี้ ไม่ต้องใส่ลิงก์', icon: Volume2 },
  { section: 'เสียง', href: '/dashboard/beatpad/', label: 'Beat Pad (กดเสียง)', img: 'beatpad', desc: 'แผงปุ่มเสียงมีม กดเล่นระหว่างไลฟ์', icon: Grid3x3 },
  { section: 'เสียง', href: '/dashboard/tts/', label: 'อ่านแชทออกเสียง (TTS)', img: 'tts', desc: 'อ่านแชทและของขวัญให้ฟังอัตโนมัติ', icon: Speech, soon: true }, // รอเปิดเสียงไทย Google — เทาไว้ก่อน (แอดมินยังเข้าได้)
  { section: 'บัญชีและช่วยเหลือ', href: '/dashboard/donate/', label: 'โดเนทขึ้นจอ', img: 'donate', desc: 'รับโดเนทผ่านพร้อมเพย์ ขึ้นจอทันที', icon: Wallet, soon: true }, // กำลังพัฒนา — เทาไว้ก่อน
  { section: 'บัญชีและช่วยเหลือ', href: '/dashboard/billing/', label: 'แพลน & การชำระเงิน', img: 'billing', desc: 'ดูแพลน สมัคร Pro', icon: CreditCard },
  { section: 'บัญชีและช่วยเหลือ', href: '/dashboard/referral/', label: 'แนะนำเพื่อน รับฟรี', img: 'referral', desc: 'ชวนเพื่อนมาใช้ รับใช้ฟรี', icon: Gift },
  { section: 'บัญชีและช่วยเหลือ', href: '/dashboard/guide/', label: 'คู่มือการใช้งาน', img: 'guide', desc: 'วิธีใช้งานทีละขั้น', icon: BookOpen },
];
