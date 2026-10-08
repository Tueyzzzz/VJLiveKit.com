/**
 * มาสคอตสั่งทำ (หน้าลูกค้าเอง) — ผูกกับ userId: บัญชีนั้นเลือกใช้ได้คนเดียว (แอดมินเห็นทั้งหมด)
 * รูปอยู่ที่ overlay/public/mascot/<code>/1..17.webp + thumb.webp · ต้นฉบับใน docs/mascots/custom/<code>/
 * เพิ่มลูกค้าใหม่: ใส่ { userId: [{ code, name, at }] } ด้านล่าง (code ขึ้นต้นด้วย C)
 */
export interface CustomMascot { code: string; name: string; at: string }
export const CUSTOM_MASCOTS: Record<string, CustomMascot[]> = {
  "cmuzcnqzc0020117159xccnhz": [
    {
      "code": "Cplai",
      "name": "มาสคอตของฉัน (plai)",
      "at": "2026-10-09"
    }
  ]
};
