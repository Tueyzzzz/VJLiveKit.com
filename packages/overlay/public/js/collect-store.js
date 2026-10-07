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
    /** ของขวัญจริง (รูปจาก TikTok) สำหรับโหมดพรีวิว — ของถูกออกบ่อยกว่า เหมือนไลฟ์จริง */
    DEMO: [["Rose",1,"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.webp",6],["TikTok",1,"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/802a21ae29f9fae5abe3693de9f874bd~tplv-obj.webp",2],["GG",1,"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/3f02fa9594bd1495ff4e8aa5ae265eef~tplv-obj.webp",2],["Ice Cream Cone",1,"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/968820bc85e274713c795a6aef3f7c67~tplv-obj.webp",2],["Love you so much",1,"https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/fc549cf1bc61f9c8a1c97ebab68dced7.png~tplv-obj.webp",2],["Heart Me",1,"https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/composed.b326356a360b67b367c5cae58fe337b1.png~tplv-resize:258:258.webp",2],["Finger Heart",5,"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/a4c4dc437fd3a6632aba149769491f49.png~tplv-obj.webp",3],["Rosa",10,"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eb77ead5c3abb6da6034d3cf6cfeb438~tplv-obj.webp",2],["Perfume",20,"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/20b8f61246c7b6032777bb81bf4ee055~tplv-obj.webp",2],["Doughnut",30,"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/4e7ad6bdf0a1d860c538f38026d4e812~tplv-obj.webp",2],["Hat and Mustache",99,"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/2f1e4f3f5c728ffbfa35705b480fdc92~tplv-obj.webp",1],["Confetti",100,"https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/472bf660b0804bb37f616d173edb8a9d.png~tplv-obj.webp",1],["Sunglasses",199,"https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/08af67ab13a8053269bf539fd27f3873.png~tplv-obj.webp",1],["Corgi",299,"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/148eef0884fdb12058d1c6897d1e02b9~tplv-obj.webp",1],["Money Gun",500,"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/e0589e95a2b41970f0f30f6202f5fce6~tplv-obj.webp",1],["Galaxy",1000,"https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/79a02148079526539f7599150da9fd28.png~tplv-obj.webp",1],["Lion",29999,"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/4fb89af2082a290b37d704e20f4fe729~tplv-obj.webp",1]],
    demoGift() {
      const L = this.DEMO, tot = L.reduce((s, g) => s + g[3], 0); let r = Math.random() * tot, g = L[0];
      for (const x of L) { if ((r -= x[3]) < 0) { g = x; break; } }
      const names = ['somchai', 'mimi', 'บิ๊ก', 'lisa', 'ต้นน้ำ'], nm = names[Math.floor(Math.random() * names.length)];
      return { type: 'gift', user: { uniqueId: nm, nickname: nm, avatar: '' }, giftName: g[0], giftImage: g[2], diamondCount: g[1], repeatCount: g[1] >= 100 ? 1 : 1 + Math.floor(Math.random() * 3), streaking: false };
    },
    /** ?fill=N (ถ่ายภาพตัวอย่าง): ใส่ของขวัญ N ชิ้นรวดเดียวตอนเริ่ม */
    demoBurst(onGift) { const n = Math.min(150, parseInt(q.get('fill') || '0', 10) || 0); for (let i = 0; i < n; i++) setTimeout(() => onGift(this.demoGift()), i * 60); },
    clear: () => write([]),
    /** อีโมจิสำรองตอนรูปของขวัญโหลดไม่ได้ */
    emoji: (name, def) => ({ Rose: '🌹', 'Finger Heart': '🫰', Perfume: '🧴', Galaxy: '🌌', Lion: '🦁', Universe: '🪐', Heart: '❤️', TikTok: '🎵' })[name] || def,
  };
})();
