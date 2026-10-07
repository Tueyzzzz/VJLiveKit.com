/* คลังของขวัญที่สะสมไว้ "กองเดียว" ใช้ร่วมกันทุกแบบ (โหล ตู้ปลา รถ ต้นไม้ เครื่องจักร ฯลฯ)
 * เปลี่ยนแบบวิดเจ็ตแล้วของขวัญต้องไม่หาย → ทุกแบบเขียนลงที่เดียวกัน แล้วตอนเปิดแบบไหนก็โหลดกองนี้
 * เก็บเป็น "เหตุการณ์ส่งของขวัญ" มีรหัสกันซ้ำ (เปิดหลายแบบพร้อมกัน = ไม่บันทึกซ้ำ)
 * VJLCollect.record(e, n) · VJLCollect.gifts(max) → [{u,e,d}] · VJLCollect.has()
 */
(function () {
  const q = new URLSearchParams(location.search);
  const KEY = 'vjl-collect:' + (q.get('t') || q.get('username') || 'demo').slice(-24);
  const CAP = 1500; // เก็บเหตุการณ์ล่าสุดไม่เกินนี้
  const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
  const write = (list) => { try { localStorage.setItem(KEY, JSON.stringify(list.slice(-CAP))); } catch { /* storage ปิด/เต็ม */ } };
  if (q.get('reset') === '1' && q.get('demo') !== '1') write([]);

  window.VJLCollect = {
    /** บันทึกการส่งของขวัญ 1 ครั้ง (n = จำนวนชิ้นที่วิดเจ็ตนี้แสดง) */
    record(e, n) {
      if (q.get('demo') === '1' || !e) return;
      const u = e.user || {};
      const id = [e.ts || '', u.uniqueId || u.nickname || '', e.giftId || e.giftName || '', e.repeatCount || 1].join('|');
      const list = read();
      if (list.some((x) => x.id === id)) return; // อีกแบบบันทึกไปแล้ว
      list.push({ id, u: e.giftImage || '', e: e.giftName || '', d: e.diamondCount || 0, n: Math.max(1, n || 1) });
      write(list);
    },
    /** ของขวัญทั้งกอง (คลี่จำนวนชิ้นออก) ล่าสุด max ชิ้น — รูปแบบกลาง {u: รูป, name, d: เพชร} */
    gifts(max = 400) {
      const out = [];
      for (const x of read()) for (let i = 0; i < x.n; i++) out.push({ u: x.u, name: x.e, em: x.em, d: x.d });
      return out.slice(-max);
    },
    has: () => read().length > 0,
    /** ย้ายของเก่า (ก่อนมีกองกลาง) เข้ากองกลาง — ทำครั้งเดียวตอนกองกลางยังว่าง */
    seed(list) {
      if (q.get('demo') === '1' || read().length || !list || !list.length) return;
      write(list.map((g, i) => ({ id: 'old|' + i, u: g.u || g.img || '', e: '', em: g.e || '', d: g.d || 0, n: 1 })));
    },
    clear: () => write([]),
    /** อีโมจิสำรองตอนรูปของขวัญโหลดไม่ได้ */
    emoji: (name, def) => ({ Rose: '🌹', 'Finger Heart': '🫰', Perfume: '🧴', Galaxy: '🌌', Lion: '🦁', Universe: '🪐', Heart: '❤️', TikTok: '🎵' })[name] || def,
  };
})();
