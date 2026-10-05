/** นับการเชื่อมต่อ TikTok ต่อวัน (แต่ละครั้งใช้คำขอ EulerStream ~1–2 ครั้ง) — ให้แอดมินดูโควตา */
export const connStats = {
  day: new Date().toISOString().slice(0, 10),
  attempts: 0,
  success: 0,
  failed: 0,
  bump(kind: 'attempt' | 'success' | 'failed'): void {
    const d = new Date().toISOString().slice(0, 10);
    if (d !== this.day) { this.day = d; this.attempts = 0; this.success = 0; this.failed = 0; }
    if (kind === 'attempt') this.attempts++; else if (kind === 'success') this.success++; else this.failed++;
  },
};
