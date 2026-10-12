/** ธนาคารไทย (รหัสย่อ · ชื่อ · สีประจำธนาคาร) — ใช้ในหน้าโดเนท (โอนเข้าบัญชีธนาคาร) */
export const BANKS: { code: string; name: string; color: string; abbr: string }[] = [
  { code: 'kbank', abbr: 'KBank', name: 'กสิกรไทย', color: '#138f2d' },
  { code: 'scb', abbr: 'SCB', name: 'ไทยพาณิชย์', color: '#4e2e7f' },
  { code: 'bbl', abbr: 'BBL', name: 'กรุงเทพ', color: '#1e4598' },
  { code: 'ktb', abbr: 'KTB', name: 'กรุงไทย', color: '#1ba5e1' },
  { code: 'bay', abbr: 'BAY', name: 'กรุงศรีอยุธยา', color: '#fec43b' },
  { code: 'ttb', abbr: 'ttb', name: 'ทีทีบี (ttb)', color: '#0050f0' },
  { code: 'gsb', abbr: 'GSB', name: 'ออมสิน', color: '#eb198d' },
  { code: 'baac', abbr: 'BAAC', name: 'ธ.ก.ส.', color: '#4b9b1d' },
  { code: 'ghb', abbr: 'GHB', name: 'อาคารสงเคราะห์', color: '#f57d23' },
  { code: 'uob', abbr: 'UOB', name: 'ยูโอบี', color: '#0b3979' },
  { code: 'cimb', abbr: 'CIMB', name: 'ซีไอเอ็มบี ไทย', color: '#7e2f36' },
  { code: 'kkp', abbr: 'KKP', name: 'เกียรตินาคินภัทร', color: '#635985' },
  { code: 'lhb', abbr: 'LHB', name: 'แลนด์ แอนด์ เฮ้าส์', color: '#6d6e71' },
  { code: 'tisco', abbr: 'TISCO', name: 'ทิสโก้', color: '#12549f' },
  { code: 'icbc', abbr: 'ICBC', name: 'ไอซีบีซี (ไทย)', color: '#c50f1c' },
];
export const bankOf = (code?: string | null) => BANKS.find((b) => b.code === code);
/** 1234567890 → 123-4-56789-0 (รูปแบบ 10 หลักที่คนไทยคุ้น) · ยาวกว่านั้นเว้นทุก 4 หลัก */
export const fmtAccount = (d: string) => (d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 4)}-${d.slice(4, 9)}-${d.slice(9)}` : d.replace(/(\d{4})(?=\d)/g, '$1 '));
/** ป้ายวงกลมสีประจำธนาคาร + ชื่อย่อ — ใช้แทนเมื่อโหลดโลโก้ (public/banks/<code>.webp) ไม่ได้ */
export const bankBadgeStyle = (color: string) => ({ background: `radial-gradient(circle at 35% 30%, ${color}dd, ${color})`, color: color === '#fec43b' ? '#4a3200' : '#fff' });
/** โลโก้ธนาคาร (ชุด thai-banks-logo · public/banks/<code>.webp) */
export const bankLogo = (code: string) => `/banks/${code}.webp`;
