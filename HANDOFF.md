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
- Dashboard: **Next.js 16 (static export) + Tailwind 4** — Fastify เสิร์ฟที่ `/` (ไม่ต้องมี Node server แยก)
- Billing จริง: **Stripe** (Checkout + Customer Portal + webhooks)

## 3) โครงสร้าง
```
packages/server/   # API + Socket.IO + ingest (TS)
  src/ config db tiktok realtime auth billing widgets actions app.ts index.ts
  prisma/schema.prisma  (+ seed.ts)
  src/plans/  # นิยามแพลน Free/Pro + entitlements (gating)
  prisma/migrations/  # migration (prisma migrate deploy ตอนสตาร์ท container)
packages/dashboard/        # Next.js (static export -> out/) หน้าเว็บ+Dashboard
  app/ (หน้าแรก+pricing, login, register, dashboard/{widgets,actions,billing}, billing/{success,cancel})
packages/overlay/public/   # หน้า OBS (static)
  coinjar.html alerts.html goal.html chat.html tts.html fx.html follower.html topgifters.html
  js/overlay-client.js  js/tts.js  favicon.svg
Dockerfile  docker-compose.prod.yml  deploy/Caddyfile  deploy/bootstrap.sh
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
- CI/CD: ci.yml (typecheck+build + build Docker image + smoke test + push GHCR บน main) + deploy.yml (SSH -> bootstrap.sh)
- **[รอบ 2]** Prisma migration แรก (เดิมไม่มี -> prod จะไม่มีตาราง), แพลน sync อัตโนมัติตอนสตาร์ท (ensurePlans)
- **[รอบ 2]** Dashboard ครบ: สมัคร/ล็อกอิน, ตั้งชื่อ TikTok, สร้าง/เพิกถอนลิงก์ overlay, CRUD กฎ Actions, หน้าแพลน/อัปเกรด/จัดการสมาชิก/ประวัติจ่ายเงิน
- **[รอบ 2]** Stripe จริง + gating: Free = 5 วิดเจ็ต/3 กฎ/2 ลิงก์, Pro = ครบ 8 วิดเจ็ต/100 กฎ/20 ลิงก์ (ตรวจทั้ง API และตอน overlay ต่อ socket)
- **[รอบ 2]** วิดเจ็ตใหม่: follower (ผู้ติดตามล่าสุด), topgifters; fx รองรับ `{user}` + ไม่ต้องกดปุ่มเสียงใน OBS
- **[รอบ 2]** แก้บั๊ก realtime: ต่อ TikTok ไม่ติด (ยังไม่ไลฟ์) เคยทำ process ล่ม -> ตอนนี้ retry ทุก 30 วิ, ปิดห้องเมื่อไม่มีคนดู, Actions แยกตามเจ้าของ token, overlay token เพิกถอนได้จริง
- **[รอบ 2]** rate limit login/register, JWT_SECRET ต้อง >= 32 ตัวใน prod

## 5) Infra & การตัดสินใจ
- **Server:** Vultr `vhf-1c-1gb` (High Frequency), Ubuntu 26.04 LTS, **Tokyo**, IP `45.77.26.217` (จะ resize ขยายทีหลัง)
- ต้องมี **swap 2GB** บนเครื่อง 1GB (อยู่ใน DEPLOY.md)
- ⚠️ **รหัส root เคยถูกพิมพ์ในแชท → ต้องเปลี่ยนรหัส/ใช้ SSH key** (อย่าใช้รหัสเดิม)
- **Payment provider: ยังไม่เลือก** (โค้ดทำเป็น abstraction เลือกภายหลังได้ — เริ่ม Stripe)
- ต้องมี **SIGN_API_KEY** (EulerStream) ถึงจะต่อ TikTok จริง (เดโมไม่ต้อง)

## 6) ยังไม่ทำ / ถัดไป (TODO)
- [ ] **(ผู้ใช้ทำ)** DNS Dynadot A `@`/`www` -> 45.77.26.217, เปลี่ยนรหัส root, ใส่ secrets + `DEPLOY_ENABLED=true`, merge เข้า main แล้ว Run Deploy — ดู DEPLOY.md
- [ ] **(ผู้ใช้ทำ)** Stripe: keys + webhook endpoint + เปิด Customer Portal + `BILLING_PROVIDER=stripe`
- [ ] หน้าตั้งค่าวิดเจ็ตแบบมี preview ใน Dashboard (ตอนนี้ปรับผ่านพารามิเตอร์ URL; API `/api/widgets/:type/config` มีแล้วแต่ overlay ยังไม่อ่าน)
- [ ] ลืมรหัสผ่าน / ยืนยันอีเมล (ต้องมีผู้ให้บริการส่งอีเมล)
- [ ] Omise/PromptPay (Stripe subscription ไม่รองรับ PromptPay)
- [ ] เทสต์อัตโนมัติ (ตอนนี้ทดสอบ e2e ด้วยมือ + smoke test ใน CI)
- [ ] (ออปชัน) อัปเกรด overlay เป็น PixiJS/WebGL
- [ ] (สเกล) Redis adapter สำหรับหลาย instance

## 7) รัน dev เร็ว ๆ
```bash
npm install
cp .env.example .env            # DEMO_MODE=true เล่นได้เลย
cp .env packages/server/.env    # ให้ prisma CLI เห็น DATABASE_URL
docker compose up -d            # Postgres + Redis
npm run prisma:generate && npm run prisma:migrate
npm run build --workspace @vjlivekit/dashboard   # (ครั้งแรก) ให้ server เสิร์ฟ dashboard ที่ /
npm run dev                     # http://localhost:8080
# หรือแก้ dashboard แบบ hot reload: npm run dev:dashboard (พอร์ต 3000, ตั้ง NEXT_PUBLIC_API_BASE)
# overlay: /overlay/coinjar.html?username=test
```
Deploy production: ดู **DEPLOY.md**

## 8) ยืนยันคุณภาพล่าสุด (5 ต.ค. 2026: typecheck ✅ build ✅ CI+Docker smoke test ✅ image อยู่บน GHCR ✅ — ยังไม่ deploy)
typecheck ✅ · build ✅ · overlay ทั้ง 6 + favicon เสิร์ฟ 200 ✅ · CI เขียว ✅

---

## 9) 📋 Prompt สำหรับวางในแชทใหม่ (คัดลอกไปใช้ได้เลย)

> ทำงานต่อโปรเจกต์ **VJLiveKit** — repo `Tueyzzzz/VJLiveKit.com` branch `main` (ถ้าอยู่ในเครื่อง: `git pull origin main` ก่อน)
> แพลตฟอร์มวิดเจ็ต TikTok LIVE สไตล์ TikFinity แบบ SaaS (สมาชิก Free/Pro + Stripe) โดเมน vjlivekit.com
> **อ่าน `HANDOFF.md` และ `DEPLOY.md` ให้จบก่อนลงมือ** แล้วสรุปสถานะให้ฉันฟังสั้น ๆ
>
> สถานะล่าสุด (5 ต.ค. 2026): โค้ดครบแล้วและอยู่ใน main — server, Dashboard (Next.js static export เสิร์ฟจาก Fastify), Stripe จริง + gating ตามแพลน, overlay 8 ตัว, migration แรก
> CI เขียวและ push image ขึ้น `ghcr.io/tueyzzzz/vjlivekit.com:latest` แล้ว แต่ **ยังไม่เคย deploy ขึ้นเครื่องจริง**
>
> Infra: Vultr vhf-1c-1gb Tokyo IP `45.77.26.217` (Ubuntu, ยังเปล่า), DNS ที่ Dynadot
> Deploy ทำผ่าน GitHub Actions `deploy.yml` ซึ่ง SSH เข้าไปรัน `deploy/bootstrap.sh` (ลง swap/Docker/ufw, สร้าง `.env` สุ่มรหัสเอง, pull image, up) — **รันซ้ำได้ปลอดภัย**
>
> งานที่ต้องทำต่อ ตามลำดับ:
> 1. เช็กว่าตั้ง GitHub Secrets `VULTR_HOST`, `VULTR_PASSWORD` (หรือ `VULTR_SSH_KEY`) และ Variable `DEPLOY_ENABLED=true` แล้วหรือยัง ถ้ายัง บอกฉันว่าต้องกดตรงไหน
> 2. สั่ง deploy (Actions → Deploy → Run workflow) แล้วตามดูจนเสร็จ ถ้าล้มให้อ่าน log แล้วแก้
>    - ถ้าเครื่องนี้ SSH เข้า `root@45.77.26.217` ได้ จะรัน bootstrap เองก็ได้: คัดลอก `docker-compose.prod.yml`, `deploy/Caddyfile`, `deploy/bootstrap.sh` ไปที่ `/opt/vjlivekit` แล้วรัน
>      `APP_IMAGE=ghcr.io/tueyzzzz/vjlivekit.com:latest DOMAIN=vjlivekit.com bash /opt/vjlivekit/deploy/bootstrap.sh`
>      (image เป็น private ต้อง `docker login ghcr.io` ด้วย GitHub token ที่มีสิทธิ์ `read:packages` ก่อน หรือตั้ง package เป็น public)
> 3. เช็กว่า DNS ของ `vjlivekit.com` และ `www` ชี้ `45.77.26.217` แล้วหรือยัง (`nslookup vjlivekit.com`) ถ้ายัง บอกขั้นตอนที่ Dynadot ให้ฉันทำ
> 4. ยืนยันว่า `https://vjlivekit.com/healthz` ได้ `{"ok":true}` แล้วลองสมัคร → ตั้งชื่อ TikTok → สร้างลิงก์ overlay
> 5. ตั้ง Stripe ตามหัวข้อ "เปิดรับเงินด้วย Stripe" ใน DEPLOY.md (เมื่อฉันพร้อม)
>
> ข้อควรระวัง:
> - **รหัส root ของ Vultr หลุดในแชทไปแล้ว** ต้องเปลี่ยนก่อนใส่ใน Secrets ห้ามพิมพ์รหัสลงในแชท ไฟล์ หรือ commit
> - push เข้า `main` = deploy อัตโนมัติ (เมื่อ `DEPLOY_ENABLED=true`) ทดสอบให้ผ่านก่อน: `npm run typecheck && npm run build`
> - ห้ามแก้ไฟล์ใน `packages/server/prisma/migrations/` เอง ให้ใช้ `prisma migrate dev`
> - repo `APWEBV2` เป็นคนละโปรเจกต์ (.NET) ห้ามเอาโค้ด VJLiveKit ไปลงที่นั่น
> - ตอบเป็นภาษาไทย

---

## 10) API endpoints (ปัจจุบัน)
```
GET    /healthz                       # health check
POST   /api/auth/register             # สมัคร -> {token,user}
POST   /api/auth/login                # ล็อกอิน -> {token,user}
GET    /api/auth/me                   # ข้อมูลผู้ใช้ + entitlements (Bearer token)
PATCH  /api/auth/me                   # แก้ displayName / tiktokUsername
GET    /api/overlay-tokens            # ลิงก์ที่ใช้อยู่ + URL ทุกวิดเจ็ต (locked ตามแพลน)
POST   /api/overlay-tokens            # สร้างลิงก์ชุดใหม่ (จำกัดตามแพลน)
DELETE /api/overlay-tokens/:id        # เพิกถอน
GET    /api/widgets/:type/config      # อ่าน config widget
PUT    /api/widgets/:type/config      # บันทึก config widget
GET    /api/actions                   # list กฎ Actions
POST   /api/actions                   # สร้างกฎ
PUT    /api/actions/:id               # แก้กฎ
DELETE /api/actions/:id               # ลบกฎ
GET    /api/billing/plans             # แพลน (สาธารณะ)
POST   /api/billing/checkout          # -> {redirectUrl} Stripe Checkout
POST   /api/billing/portal            # -> {redirectUrl} Stripe Customer Portal
GET    /api/billing/payments          # ประวัติการชำระเงิน
POST   /api/billing/webhook           # webhook จาก Stripe (ตรวจลายเซ็น)
# Socket.IO: query { token, widget } (prod) หรือ { username } (demo) — overlay-client.js ส่งให้เอง
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
/overlay/fx.html        (ขับเคลื่อนด้วย Actions & Events — ข้อความใช้ {user} ได้)  [Pro]
/overlay/follower.html  ?label=... &showCount=0
/overlay/topgifters.html ?max=5 &label=...                                        [Pro]
# tts = Pro
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
- Claude Code แบบ **Cloud** (ไอคอนเมฆหน้าชื่อแชท) SSH เข้า Vultr ไม่ได้ (พอร์ต 22 ถูกบล็อก) และตั้ง GitHub Secrets / DNS ให้ไม่ได้ → deploy ผ่าน CI/CD (deploy.yml)
- ถ้าอยากให้ Claude ทำบนเครื่องเตย: เปิด PowerShell ในโฟลเดอร์โปรเจกต์แล้วพิมพ์ `claude` (โหมด Local) — เครื่องนั้นอาจ SSH เข้า Vultr ได้เอง
- git history: branch `main` (คอมมิตไล่: scaffold → overlays → rebrand/actions → deploy/CICD → handoff)
