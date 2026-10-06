/**
 * สร้างข้อมูล QR พร้อมเพย์ (มาตรฐาน EMVCo ของ ธปท.) — สแกนได้ทุกแอปธนาคาร
 * id: เบอร์มือถือ 10 หลัก · เลขบัตรประชาชน/เลขผู้เสียภาษี 13 หลัก · e-Wallet 15 หลัก
 */
const f = (id: string, v: string) => id + String(v.length).padStart(2, '0') + v;

function crc16(s: string): string {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function promptPayPayload(id: string, amount?: number): string {
  const d = id.replace(/\D/g, '');
  let target: string;
  if (d.length >= 15) target = f('03', d.slice(0, 15));                                   // e-Wallet
  else if (d.length === 13) target = f('02', d);                                            // บัตรประชาชน / ผู้เสียภาษี
  else target = f('01', ('0000000000000' + d.replace(/^0/, '66')).slice(-13));             // มือถือ 0812345678 → 0066812345678
  const amt = amount && amount > 0 ? f('54', amount.toFixed(2)) : '';
  const body = f('00', '01') + f('01', amt ? '12' : '11') + f('29', f('00', 'A000000677010111') + target) + f('58', 'TH') + f('53', '764') + amt + '6304';
  return body + crc16(body);
}

export function maskPromptPay(id: string): string {
  const d = id.replace(/\D/g, '');
  return d.length === 10 ? `${d.slice(0, 3)}-xxx-${d.slice(6)}` : d.replace(/^(\d{3})\d+(\d{4})$/, '$1-xxxx-$2');
}
