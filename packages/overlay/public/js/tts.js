/**
 * tts.js — อ่านแชท/กิฟต์ออกเสียง "แบบสิริ" ด้วย Web Speech API
 * ใช้คู่กับ overlay-client.js
 *
 * ตั้งค่าได้ผ่าน URL:
 *   ?lang=th-TH        ภาษา/เสียง (เช่น th-TH, en-US)
 *   ?rate=1            ความเร็ว (0.5–2)
 *   ?pitch=1           ระดับเสียง (0–2)
 *   ?readChat=1        อ่านแชท (1/0)
 *   ?readGift=1        อ่านกิฟต์ (1/0)
 *   ?minGift=1         อ่านกิฟต์เมื่อมูลค่า >= ค่านี้ (เพชร)
 *   ?tmplChat={name} พูดว่า {text}
 *   ?tmplGift={name} ส่ง {gift}
 *   ?voice=th-TH-Neural2-C   เสียงของ Google Cloud TTS (ใช้เมื่อเซิร์ฟเวอร์เปิด TTS ไว้ — เล่นใน OBS ได้)
 *                            ไม่มี/ใช้ไม่ได้ → ถอยไปใช้ Web Speech ของเบราว์เซอร์
 */
window.TTS = (function () {
  const synth = window.speechSynthesis;
  const P = (k, def) => { const v = new URLSearchParams(location.search).get(k); return v == null ? def : v; };

  const cfg = {
    lang: P('lang', 'th-TH'),
    rate: parseFloat(P('rate', '1')),
    pitch: parseFloat(P('pitch', '1')),
    readChat: P('readChat', '1') === '1',
    readGift: P('readGift', '1') === '1',
    minGift: parseInt(P('minGift', '1'), 10),
    tmplChat: P('tmplChat', '{name} พูดว่า {text}'),
    tmplGift: P('tmplGift', '{name} ส่ง {gift}'),
    maxLen: 180,
    voice: P('voice', 'th-TH-Neural2-C'),
  };

  // เสียงจากเซิร์ฟเวอร์ (Google Cloud TTS) — ต้องมี overlay token
  const token = P('t', '');
  let serverTts = false;
  if (token) fetch('/api/tts/status').then((r) => r.json()).then((s) => { serverTts = !!(s && s.enabled); }).catch(() => {});
  const audio = new Audio();

  let voice = null;
  function pickVoice() {
    const voices = synth.getVoices();
    voice = voices.find((v) => v.lang === cfg.lang)
         || voices.find((v) => v.lang && v.lang.startsWith(cfg.lang.split('-')[0]))
         || voices[0] || null;
  }
  pickVoice();
  if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = pickVoice;

  // คิวพูดทีละข้อความ กันเสียงทับกัน
  const queue = [];
  let speaking = false;
  function done() { speaking = false; next(); }
  function speakBrowser(text) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = cfg.lang; u.rate = cfg.rate; u.pitch = cfg.pitch; if (voice) u.voice = voice;
    u.onend = u.onerror = done;
    synth.speak(u);
  }
  function next() {
    if (speaking || !queue.length) return;
    const text = queue.shift();
    speaking = true;
    if (!serverTts) return speakBrowser(text);
    const q = new URLSearchParams({ t: token, text, voice: cfg.voice, rate: String(cfg.rate), pitch: String((cfg.pitch - 1) * 10) });
    let failed = false;
    const fail = () => { if (failed) return; failed = true; audio.onerror = null; speakBrowser(text); }; // เซิร์ฟเวอร์ล้ม → ใช้เสียงเบราว์เซอร์แทน
    audio.onended = done;
    audio.onerror = fail;
    audio.src = '/api/tts?' + q.toString();
    audio.play().catch(fail);
  }
  let onSay = null;
  function say(text) {
    if (!text) return;
    text = String(text).slice(0, cfg.maxLen);
    if (onSay) try { onSay(text); } catch (_) { /* ignore */ }
    queue.push(text);
    if (queue.length > 12) queue.splice(0, queue.length - 12); // กันคิวล้นตอนคนเยอะ
    next();
  }
  const tmpl = (s, map) => s.replace(/\{(\w+)\}/g, (_, k) => map[k] ?? '');

  return {
    cfg,
    say,
    isSpeaking: () => speaking,
    set onSay(fn) { onSay = fn; },
    /** ต่อกับอีเวนต์จาก Overlay */
    attach(Overlay) {
      Overlay.on('event', (e) => {
        const name = e.user ? (e.user.nickname || e.user.uniqueId) : '';
        if (e.type === 'chat' && cfg.readChat) say(tmpl(cfg.tmplChat, { name, text: e.comment || '' }));
        else if (e.type === 'gift' && cfg.readGift && !e.streaking) {
          const value = e.totalValue || (e.diamondCount || 0) * (e.repeatCount || 1);
          if (value >= cfg.minGift) say(tmpl(cfg.tmplGift, { name, gift: e.giftName || 'ของขวัญ' }));
        }
      });
    },
    /** เบราว์เซอร์ต้องมี interaction ก่อนถึงจะพูดได้ — เรียกตอนผู้ใช้กดปุ่ม */
    unlock() { try { synth.resume(); audio.play().catch(() => {}); } catch (_) {} },
  };
})();
