# 🔁 VJLiveKit — Handoff / เอกสารส่งต่องาน

เอกสารนี้สรุป "ทุกอย่าง" ของโปรเจกต์ เพื่อส่งต่อให้แชทใหม่ / คนใหม่ / เซสชันใหม่ ทำงานต่อได้ทันที

---

## 1) โปรเจกต์นี้คืออะไร
**VJLiveKit** — ชุดเครื่องมือ & overlay สำหรับ **TikTok LIVE** (สไตล์ TikFinity / vj-studio)
ทำเป็น **SaaS**: มีระบบสมาชิก + ชำระเงิน (subscription) + วิดเจ็ตวาง OBS
- โดเมน: **vjlivekit.com** (จดที่ Dynadot)
- Repo: **github.com/Tueyzzzz/VJLiveKit.com** (branch `main`)
- สโลแกน: *"ชุดเครื่องมือไลฟ์ครบ จบในที่เดียว"*

## 2) Tech stack (เก่ง/ใหม่/ไว/สวย)
- ภาษา: **TypeScript** ทั้งระบบ · Monorepo (npm workspaces)
- Backend: **Fastify 5 + Socket.IO + tiktok-live-connector**
- DB: **PostgreSQL + Prisma** · Cache/scale: **Redis** (เพิ่มตอนสเกล)
- Auth: JWT + scrypt · Payment: **BillingProvider สลับได้** (Stripe stub)
- Overlay: **vanilla JS + Canvas** (เบา เหมาะ OBS)
- Deploy: **Docker + Caddy (HTTPS อัตโนมัติ)** บน Vultr
- CI/CD: **GitHub Actions** (ci.yml + deploy.yml)
- Dashboard (ยังไม่ทำ): วางแผนใช้ Next.js + Tailwind + shadcn

## 3) โครงสร้าง
```
packages/server/   # API + Socket.IO + ingest (TS)
  src/ config db tiktok realtime auth billing widgets actions app.ts index.ts
  prisma/schema.prisma  (+ seed.ts)
packages/overlay/public/   # หน้า OBS (static)
  coinjar.html alerts.html goal.html chat.html tts.html fx.html
  js/overlay-client.js  js/tts.js  favicon.svg
Dockerfile  docker-compose.prod.yml  deploy/Caddyfile
.github/workflows/ ci.yml deploy.yml
DEPLOY.md  README.md  .env.example  .env.prod.example
legacy/            # เดโมเวอร์ชันแรก (อ้างอิง)
```

## 4) ทำเสร็จแล้ว ✅
- Server core: ต่อ TikTok จริง/เดโม, relay หลายห้อง (RoomHub), graceful shutdown
- Auth (register/login/me), middleware requireUser
- Prisma schema: User, Account, Session, Plan, Subscription, Payment, WidgetConfig, OverlayToken, **ActionRule**
- **Actions & Events engine**: ruleMatches/evaluate + ยิง 'action' (cache 30s) + CRUD `/api/actions`
- Overlay 6 ตัว: coinjar (Canvas physics), alerts, goal, chat, tts (อ่านเสียง), fx (เล่น sound/image/video/text)
- Billing abstraction + Stripe stub + webhook sync
- Rebrand → VJLiveKit + logo.svg + favicon
- Deploy (Docker+Caddy) + DEPLOY.md
- CI/CD: ci.yml (เขียว ✅) + deploy.yml (auto-deploy, เปิดด้วย DEPLOY_ENABLED)

## 5) Infra & การตัดสินใจ
- **Server:** Vultr `vhf-1c-1gb` (High Frequency), Ubuntu 26.04 LTS, **Tokyo**, IP `45.77.26.217` (จะ resize ขยายทีหลัง)
- ต้องมี **swap 2GB** บนเครื่อง 1GB (อยู่ใน DEPLOY.md)
- ⚠️ **รหัส root เคยถูกพิมพ์ในแชท → ต้องเปลี่ยนรหัส/ใช้ SSH key** (อย่าใช้รหัสเดิม)
- **Payment provider: ยังไม่เลือก** (โค้ดทำเป็น abstraction เลือกภายหลังได้ — เริ่ม Stripe)
- ต้องมี **SIGN_API_KEY** (EulerStream) ถึงจะต่อ TikTok จริง (เดโมไม่ต้อง)

## 6) ยังไม่ทำ / ถัดไป (TODO)
- [ ] Deploy ขึ้นเครื่องจริงครั้งแรก (ตั้ง DNS Dynadot → `docker compose up`)
- [ ] เปิด auto-deploy: ใส่ secrets `VULTR_HOST/USER/SSH_KEY` + variable `DEPLOY_ENABLED=true`
- [ ] **Dashboard** (Next.js): login, ตั้งกฎ Actions, จัดการแพลน, คัดลอก URL widget
- [ ] **Stripe/Omise จริง** + หน้า pricing + gating ฟีเจอร์ตามแพลน
- [ ] วิดเจ็ตเสริม: Top Gifters, Latest Follower
- [ ] (ออปชัน) อัปเกรด overlay เป็น PixiJS/WebGL
- [ ] (สเกล) Redis adapter สำหรับหลาย instance

## 7) รัน dev เร็ว ๆ
```bash
npm install
cp .env.example .env            # DEMO_MODE=true เล่นได้เลย
docker compose up -d            # Postgres + Redis
npm run prisma:generate && npm run prisma:migrate
npm run dev                     # http://localhost:8080
# overlay: /overlay/coinjar.html?username=test
```
Deploy production: ดู **DEPLOY.md**

## 8) ยืนยันคุณภาพล่าสุด
typecheck ✅ · build ✅ · overlay ทั้ง 6 + favicon เสิร์ฟ 200 ✅ · CI เขียว ✅

---

## 9) 📋 Prompt สำหรับวางในแชทใหม่ (คัดลอกไปใช้ได้เลย)

> ช่วยทำงานต่อกับโปรเจกต์ **VJLiveKit** — repo `Tueyzzzz/VJLiveKit.com` (branch main)
> มันคือแพลตฟอร์มวิดเจ็ต TikTok LIVE สไตล์ TikFinity (SaaS: สมาชิก+subscription)
> Stack: TypeScript, Fastify, Socket.IO, tiktok-live-connector, PostgreSQL+Prisma, Redis, Docker+Caddy, GitHub Actions. Overlay = vanilla JS + Canvas. Monorepo (packages/server, packages/overlay).
> อ่าน `HANDOFF.md` และ `DEPLOY.md` ใน repo เพื่อเข้าใจสถานะทั้งหมด
> ทำเสร็จแล้ว: server core, auth, Actions&Events engine, overlay 6 ตัว, billing abstraction, rebrand, deploy files, CI/CD (เขียว)
> Infra: Vultr vhf-1c-1gb Tokyo IP 45.77.26.217, โดเมน vjlivekit.com (Dynadot)
> งานถัดไปที่อยากทำ: **[ใส่สิ่งที่อยากทำ เช่น Dashboard / Stripe / deploy ครั้งแรก]**
> หมายเหตุ: push ขึ้น repo ได้ (GitHub App ติดตั้งแล้ว) แต่ SSH เข้าเครื่อง Vultr ไม่ได้ (รันเอง/ผ่าน CI-CD)

---

## 10) API endpoints (ปัจจุบัน)
```
GET    /healthz                       # health check
POST   /api/auth/register             # สมัคร -> {token,user}
POST   /api/auth/login                # ล็อกอิน -> {token,user}
GET    /api/auth/me                   # ข้อมูลผู้ใช้ (Bearer token)
POST   /api/overlay-tokens            # สร้าง token + คืน URL overlay ทุกตัว
GET    /api/widgets/:type/config      # อ่าน config widget
PUT    /api/widgets/:type/config      # บันทึก config widget
GET    /api/actions                   # list กฎ Actions
POST   /api/actions                   # สร้างกฎ
PUT    /api/actions/:id               # แก้กฎ
DELETE /api/actions/:id               # ลบกฎ
POST   /api/billing/checkout          # เริ่มจ่ายเงิน (ตาม provider)
POST   /api/billing/webhook           # webhook จาก gateway
# Socket.IO: client ต่อด้วย query ?t=<jwt> (prod) หรือ ?username= (demo)
#   events: tiktok-event, stats, status, state, action
# Static overlay: /overlay/<name>.html
```

## 11) Overlay URLs & พารามิเตอร์
ทุกหน้า: `?t=<overlay-jwt>` (prod) หรือ `?username=<ชื่อ>` (demo, ต้อง DEMO_MODE=true) หรือ `?demo=1` (เดโมในเบราว์เซอร์ล้วน)
```
/overlay/coinjar.html   ?goal=10000
/overlay/alerts.html
/overlay/goal.html      ?type=like|follow|share|diamond|gift  &target=10000  &label=...
/overlay/chat.html      ?max=8
/overlay/tts.html       ?lang=th-TH &rate=1 &pitch=1 &readChat=1 &readGift=1 &minGift=1
/overlay/fx.html        (ขับเคลื่อนด้วย Actions & Events)
```

## 12) ลิงก์เดโม (artifacts — พรีวิวเร็ว ไม่ต้องรันเซิร์ฟเวอร์)
- Coin Jar (เวอร์ชันแรก): https://claude.ai/artifact/RWGMxiS2peiyRDidgVrAcd
- Widget Studio (4 วิดเจ็ตรวม): https://claude.ai/artifact/MztWgRm4zgpQocLrYFGdAu
- Coin Jar Canvas (ฟิสิกส์จริง): https://claude.ai/artifact/P2SsjkSV56Wg3E3WSe6MJY
> เป็นเดโม standalone (ของจริงในโค้ดต่อ Socket.IO)

## 13) เว็บอ้างอิง (ต้นแบบ)
- TikFinity: https://tikfinity.zerody.one/  (ศึกษาแล้ว)
- vj-studio coinjar: https://pmjx4e.vj-studio.com/widget/coinjar  (แกะจาก .mhtml แล้ว)
- app.xn--82c5dxb3b.com/home  (ยังไม่ได้ศึกษา — ส่ง .mhtml มาถ้าอยากให้แกะฟีเจอร์เพิ่ม)

## 14) เรื่องที่ยังค้าง / รอตัดสินใจ
- ⏳ เลือก **payment provider** (Stripe หรือ Omise/Opn) — โค้ดรองรับสลับได้แล้ว
- ⏳ ศึกษาเว็บ app.xn--82c5dxb3b.com เพิ่ม (รอ .mhtml)
- ⏳ แบรนด์คิท: โลโก้มี SVG แล้ว, ยังไม่มี favicon.ico/โลโก้ความละเอียดสูง/สโลแกนไฟนอล
- ⏳ หน้า pricing + กำหนดราคาแพลน (ตัวอย่าง Pro 149฿/เดือน ใน seed.ts)

## 15) env vars สำคัญ (ดูเต็มใน .env.example / .env.prod.example)
```
PORT DEMO_MODE DATABASE_URL REDIS_URL JWT_SECRET OVERLAY_TOKEN_TTL_DAYS
SIGN_API_KEY  BILLING_PROVIDER  STRIPE_*  OMISE_*  PUBLIC_BASE_URL  DOMAIN
```

## 16) หมายเหตุสภาพแวดล้อม/ข้อจำกัด
- GitHub App ติดตั้งแล้ว → push ขึ้น repo ได้
- Claude Code (คลาวด์) **SSH เข้าเครื่อง Vultr ไม่ได้** → deploy ด้วยตนเอง หรือผ่าน CI/CD (deploy.yml)
- git history: branch `main` (คอมมิตไล่: scaffold → overlays → rebrand/actions → deploy/CICD → handoff)
