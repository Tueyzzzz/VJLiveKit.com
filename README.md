<p align="center">
  <img src="assets/logo.svg" alt="VJLiveKit" width="340" />
</p>

# VJLiveKit 🎀

**ชุดเครื่องมือ & overlay สำหรับ TikTok LIVE** — coinjar, แจ้งเตือนกิฟต์, แถบเป้าหมาย, แชทสด, อ่านแชทออกเสียง (TTS), Actions & Events
พร้อม **ระบบสมาชิก + ชำระเงิน (subscription)** สำหรับทำเป็นผลิตภัณฑ์จริง

> *VJLiveKit — ชุดเครื่องมือไลฟ์ครบ จบในที่เดียว*
> งานพัฒนาอิสระ ไม่เกี่ยวข้องกับ TikTok, TikFinity หรือ vj-studio อย่างเป็นทางการ

---

## 🧰 Tech stack (เก่ง + ใหม่ + ไว + สวย)

| ชั้น | เทคโนโลยี | ทำไม |
|---|---|---|
| ภาษา | **TypeScript** (end-to-end) | type-safe ทั้งระบบ |
| Backend | **Node.js 20 + Fastify 5** | เว็บเฟรมเวิร์กที่เร็วที่สุดตัวหนึ่ง |
| Realtime | **Socket.IO** | ส่งอีเวนต์ไลฟ์ realtime (+ Redis adapter ตอนสเกล) |
| ไลฟ์ TikTok | **tiktok-live-connector** | อ่าน chat/gift/like/follow/share |
| ฐานข้อมูล | **PostgreSQL + Prisma** | เก็บสมาชิก/แพลน/การชำระเงิน/ตั้งค่า |
| Cache/Scale | **Redis** | เพิ่มตอนรันหลาย instance / rate-limit / คิวงาน |
| Auth | **JWT + scrypt** (พร้อมต่อ OAuth) | เข้าสู่ระบบ/สมาชิก |
| Payment | **Billing provider (สลับได้)** | เริ่ม Stripe, เพิ่ม Omise/Opn ได้ |
| Overlay | **Vanilla JS + Canvas** | เบา ลื่น เหมาะ OBS (อัปเกรดเป็น PixiJS/WebGL ได้) |
| Validation | **Zod** | ตรวจ input |
| CI/CD | **GitHub Actions + Docker** | build/test/deploy อัตโนมัติ |

> แนะนำต่อยอด "สวยโคตร": Dashboard ทำด้วย **Next.js + TailwindCSS + shadcn/ui + Framer Motion**, overlay อัปเป็น **PixiJS (WebGL)** สำหรับอนิเมชันหนัก ๆ, จัด monorepo ด้วย **pnpm + Turborepo**

---

## 📁 โครงสร้าง (monorepo)
```
tikfinity/
├── docker-compose.yml        # Postgres + Redis สำหรับ dev
├── .github/workflows/ci.yml
├── packages/
│   ├── server/               # @tikfinity/server (API + Socket.IO + ingest)
│   │   ├── prisma/schema.prisma
│   │   └── src/
│   │       ├── config/  db/  tiktok/  realtime/
│   │       ├── auth/    billing/  widgets/
│   │       ├── app.ts   index.ts
│   └── overlay/              # @tikfinity/overlay (หน้า OBS static)
│       └── public/ coinjar.html + js/{overlay-client,tts}.js
└── legacy/                   # เวอร์ชันเดโมเดิม (อ้างอิง)
```

## 🚀 เริ่มใช้งาน (dev)
```bash
# 1) ติดตั้ง
npm install

# 2) เตรียม env
cp .env.example .env            # แก้ค่าตามต้องการ (DEMO_MODE=true เล่นได้เลย)

# 3) ฐานข้อมูล + redis (ต้องมี Docker)
docker compose up -d
npm run prisma:generate
npm run prisma:migrate          # สร้างตาราง
# (ทางเลือก) seed แพลน free/pro:
#   npx tsx packages/server/prisma/seed.ts

# 4) รันเซิร์ฟเวอร์
npm run dev
```
เปิด overlay เดโม: `http://localhost:8080/overlay/coinjar.html?username=test` (ต้องตั้ง DEMO_MODE=true)

## 🔌 การเชื่อมต่อจริง
1. ผู้ใช้สมัคร/ล็อกอิน (`/api/auth/*`) ตั้ง `tiktokUsername`
2. ขอ overlay token (`POST /api/overlay-tokens`) → ได้ URL เช่น `/overlay/coinjar.html?t=<jwt>`
3. เอา URL ไปวางเป็น **Browser Source** ใน OBS
4. เซิร์ฟเวอร์เชื่อม TikTok ผ่าน `tiktok-live-connector` แล้วส่งอีเวนต์เข้า overlay ผ่าน Socket.IO

> ต้องมี **sign server** (EulerStream) — ตั้ง `SIGN_API_KEY` ใน `.env` (ขอฟรีได้)

## 💳 ระบบชำระเงิน
- ออกแบบเป็น `BillingProvider` สลับได้ (`src/billing/provider.ts`)
- เริ่มด้วย Stripe (stub ที่ `stripe.ts` — เติม logic เมื่อเลือก)
- ตั้ง `BILLING_PROVIDER=stripe|omise|none` ใน `.env`
- webhook: `POST /api/billing/webhook` → sync subscription/payment ลง DB

## 🗺 Roadmap
- [x] M2 ต้นแบบ Coinjar (Canvas)
- [x] M1/M3/M4 โครง: server core, auth/สมาชิก, billing abstraction
- [ ] เติม logic Stripe/Omise จริง + หน้า pricing
- [ ] Dashboard (Next.js) ตั้งค่า/คัดลอก URL/จัดการแพลน
- [ ] วิดเจ็ตครบ: alerts / goal / chat / **TTS (อ่านแชทออกเสียง)**
- [ ] Redis adapter + deploy (Render/Railway/Fly.io)

## License
MIT
