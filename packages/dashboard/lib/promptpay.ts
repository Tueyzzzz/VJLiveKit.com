/**
 * สร้างข้อความ QR พร้อมเพย์ (มาตรฐาน EMVCo / Thai QR Payment) พร้อมยอดเงิน
 * id = เบอร์มือถือ 10 หลัก หรือเลขบัตรประชาชน/ผู้เสียภาษี 13 หลัก
 */
const f = (tag: string, value: string) => tag + String(value.length).padStart(2, '0') + value;

function crc16(s: string): string {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let k = 0; k < 8; k++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function promptPayPayload(id: string, amount?: number): string {
  const digits = id.replace(/[^0-9]/g, '');
  const target = digits.length >= 13 ? f('02', digits) : f('01', ('0066' + digits.replace(/^0/, '')).padStart(13, '0'));
  let s = f('00', '01') + f('01', amount ? '12' : '11')
    + f('29', f('00', 'A000000677010111') + target)
    + f('53', '764') + (amount ? f('54', amount.toFixed(2)) : '') + f('58', 'TH');
  s += '6304';
  return s + crc16(s);
}
