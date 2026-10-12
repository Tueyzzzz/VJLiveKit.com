/** ธนาคารไทย (รหัสย่อ · ชื่อ · สีประจำธนาคาร) — ใช้ในหน้าโดเนท (โอนเข้าบัญชีธนาคาร) */
export const BANKS: { code: string; name: string; color: string }[] = [
  { code: 'kbank', name: 'กสิกรไทย', color: '#138f2d' },
  { code: 'scb', name: 'ไทยพาณิชย์', color: '#4e2e7f' },
  { code: 'bbl', name: 'กรุงเทพ', color: '#1e4598' },
  { code: 'ktb', name: 'กรุงไทย', color: '#1ba5e1' },
  { code: 'bay', name: 'กรุงศรีอยุธยา', color: '#fec43b' },
  { code: 'ttb', name: 'ทีทีบี (ttb)', color: '#0050f0' },
  { code: 'gsb', name: 'ออมสิน', color: '#eb198d' },
  { code: 'baac', name: 'ธ.ก.ส.', color: '#4b9b1d' },
  { code: 'ghb', name: 'อาคารสงเคราะห์', color: '#f57d23' },
  { code: 'uob', name: 'ยูโอบี', color: '#0b3979' },
  { code: 'cimb', name: 'ซีไอเอ็มบี ไทย', color: '#7e2f36' },
  { code: 'kkp', name: 'เกียรตินาคินภัทร', color: '#635985' },
  { code: 'lhb', name: 'แลนด์ แอนด์ เฮ้าส์', color: '#6d6e71' },
  { code: 'tisco', name: 'ทิสโก้', color: '#12549f' },
  { code: 'icbc', name: 'ไอซีบีซี (ไทย)', color: '#c50f1c' },
];
export const bankOf = (code?: string | null) => BANKS.find((b) => b.code === code);
/** 1234567890 → 123-4-56789-0 (รูปแบบ 10 หลักที่คนไทยคุ้น) · ยาวกว่านั้นเว้นทุก 4 หลัก */
export const fmtAccount = (d: string) => (d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 4)}-${d.slice(4, 9)}-${d.slice(9)}` : d.replace(/(\d{4})(?=\d)/g, '$1 '));
