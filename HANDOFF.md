# 🔁 VJLiveKit — Handoff / เอกสารส่งต่องาน

สรุปทุกอย่างของโปรเจกต์ให้แชทใหม่ / คนใหม่ ทำงานต่อได้ทันที
**อัปเดตล่าสุด: 8 ต.ค. 2026** (main ที่ `e154ecf`, 225 commit)

---

## 1) โปรเจกต์นี้คืออะไร
**VJLiveKit** — ชุดวิดเจ็ต/overlay สำหรับ **TikTok LIVE** ใช้กับ OBS / TikTok LIVE Studio (สไตล์ TikFinity / vj-studio)
ทำเป็น **SaaS** ตลาดไทย: สมัครสมาชิก → ทดลองฟรี 30 วัน → Pro รายเดือน
- เว็บ: **https://vjlivekit.com** (DNS ที่ Dynadot) · Repo: **github.com/Tueyzzzz/VJLiveKit.com** branch `main`
- สโลแกน: *"ชุดเครื่องมือไลฟ์ครบ จบในที่เดียว"*

## 2) สถานะ: 🟢 ออนไลน์แล้ว + deploy อัตโนมัติ
- **ทุก push เข้า `main`** → CI (typecheck + build + Docker image + smoke test) → push image ขึ้น GHCR → **Deploy ขึ้นเครื่องจริงเอง** ภายใน ~2 นาที
- Deploy วิ่งผ่านมาแล้ว 223 รอบ (ล่าสุด #223 ✅ 7 ต.ค.) — Secrets, `DEPLOY_ENABLED`, DNS ตั้งครบแล้ว
- ⚠️ **ไม่มีเทสต์อัตโนมัติ** และ push = ขึ้นเว็บจริงทันที → รัน `npm run typecheck && npm run build` ให้ผ่านก่อน push ทุกครั้ง

## 3) Tech stack
- **TypeScript** ทั้งระบบ · monorepo (npm workspaces)
- Backend: **Fastify 5 + Socket.IO + tiktok-live-connector** (ต้องมี `SIGN_API_KEY` ของ EulerStream)
- DB: **PostgreSQL 16 + Prisma 5** · ข้อมูลหลังบ้านบางส่วนเป็นไฟล์ JSON (ดูข้อ 6)
- Dashboard: **Next.js 16 static export + Tailwind 4** — Fastify เสิร์ฟที่ `/` (ไม่มี Node server แยก), มี i18n (ไทยเป็นค่าเริ่มต้น + อังกฤษ)
- Overlay: **vanilla JS + Canvas** (+ รูป AI webp) เสิร์ฟที่ `/overlay/`
- Billing: **Stripe** (Checkout + Portal + webhook) · โดเนท: PromptPay + สลิป (EasySlip ออปชัน)
- TTS: Google Cloud Text-to-Speech (ออปชัน)
- Deploy: **Docker + Caddy (HTTPS อัตโนมัติ)** บน Vultr · CI/CD: GitHub Actions + GHCR

## 4) โครงสร้าง
```
packages/server/src/
  app.ts index.ts runtime.ts overlay-version.ts
  auth/       สมัคร/ล็อกอิน/เปลี่ยนรหัส, requireUser
  plans/      นิยามแพลน Free/Pro + ช่วงทดลอง + getEntitlements (gating)
  settings/   ค่าระบบที่แอดมินปรับจากหน้าเว็บ (trialDays, freeMaxRules, presenceLock ...)
  realtime/   RoomHub (ห้องไลฟ์), socket, sessions (สถิติไลฟ์), lives, connstats
  tiktok/     ต่อ TikTok, giftCatalog (รายการกิฟต์+รูปจริง), avatar
  actions/    Actions & Events engine + CRUD + ปุ่มทดสอบ + เมนูกิฟต์
  widgets/    overlay token + ตั้งค่าวิดเจ็ต
  billing/    Stripe provider + routes
  admin/      หลังบ้าน (ลูกค้า, รายงาน, ไลฟ์, แจ้งเตือน, audit, ระงับบัญชี)
  donate/ media/ (เสียงอัปโหลด, beatpad) referrals/ support/ (แชทซัพพอร์ต) tts/
packages/server/prisma/   schema.prisma + migrations/ (มีแค่ init — ดูข้อ 11)
packages/dashboard/app/   หน้าแรก+pricing, login, register, donate, guides, SEO alt pages,
                          dashboard/{widgets, widgets/settings, actions, sounds, beatpad, tts,
                          donate, referral, support, guide, billing, admin}
packages/overlay/public/  *.html (ข้อ 13) + js/ css/ themes/ mascot/ tarot/ fx/ frames/ thumbs/ ...
deploy/  Caddyfile, bootstrap.sh     .github/workflows/  ci.yml, deploy.yml
```

## 5) ฟีเจอร์ที่มีแล้ว ✅
- **วิดเจ็ต ~25 ชนิด** (`WIDGET_TYPES` ใน `plans/index.ts`):
  - สะสมกิฟต์ (`collect.html` หลายสไตล์): โหล, หมู (belly), โดมอวกาศ, ลูกแก้วหิมะ, ตู้ปลา, กระถาง/สวน, ต้นไม้หัวใจ, รถลาก — กิฟต์ใหญ่ตามมูลค่า ล้นกองที่พื้น
  - มาสคอต VJ (9 ตัวละคร × 17 ท่า, เปลี่ยนสีชุด, เต้น/รับกิฟต์), ไพ่ทาโรต์ (มี "ไพ่ประจำวัน"), เมนูกิฟต์ (fxmenu)
  - alerts, goal, chat, follower, top gifters, top likers, timer, ป้าย LED (sign), TTS, FX, donate, league (ยังพัฒนา — เห็นเฉพาะแอดมิน)
- **หน้าตั้งค่าวิดเจ็ต** มี preview และส่งค่าไปยัง overlay ที่เปิดอยู่ทันที
- **Actions & Events**: เสียงในตัว 12 เสียง, อัปโหลด/ตัดเสียงเอง (5MB), ปุ่มทดสอบ, จำกัดต่อคอมโบ
- **Beatpad**, **TTS** (Google), **โดเนท PromptPay + สลิป**, **ชวนเพื่อน**, **แชทซัพพอร์ต** (bubble ทุกหน้า), กระดิ่งแจ้งเตือน
- **หลังบ้านแอดมิน** (`ADMIN_EMAILS`): ภาพรวม, รายงาน, ลูกค้า (ให้ Pro/ถอน/รีเซ็ตรหัส/ระงับ), ไลฟ์สด + โควตา EulerStream, จำนวนไลฟ์รายวัน, ตอบซัพพอร์ต, ตั้งค่าระบบ, export CSV
- SEO: หน้าเทียบ TikFinity / vj-studio (กล่าวถึงวีเจ.com), sitemap, robots · Meta Pixel
- ความปลอดภัย: rate limit API + socket, JWT_SECRET ≥ 32 ตัว, overlay token เพิกถอนได้

## 6) ที่เก็บข้อมูล (สำคัญ)
- **PostgreSQL (Prisma):** User, Account, Session, Plan, Subscription, Payment, WidgetConfig, OverlayToken, ActionRule (+ LiveSession ที่ยังไม่มี migration)
- **ไฟล์ JSON ใน volume `appdata` (`/app/data`)** — ตั้งใจเลี่ยง migration:
  `admin.json` (ระงับบัญชี + audit), `settings.json` (ค่าระบบ), `support.json`, `notifications.json`, `lives.json`, `gifts.json`, `transrefs.json` (กันสลิปซ้ำ), `index.json`, สถิติไลฟ์ใน `data/live/` (`SNAPSHOT_DIR`), ไฟล์เสียงที่อัปโหลด
- ⚠️ **ห้ามลบ volume `appdata` / `pgdata` / `caddy_data`** — ข้อมูลลูกค้าและใบรับรอง HTTPS อยู่ในนั้น

## 7) แพลน & ราคา
| | Free | ทดลอง (trial) | Pro |
|---|---|---|---|
| ราคา | 0 | ฟรี 30 วันแรกหลังสมัคร | **199 บาท/เดือน** |
| วิดเจ็ต | coinjar, collect, alerts, goal, chat, follower | ทุกตัว | ทุกตัว |
| กฎ Actions / ลิงก์ | 3 / 2 (ปรับได้ในตั้งค่าระบบ) | 100 / 20 | 100 / 20 |
| ป้าย VJLiveKit บนจอ | มี | มี | ไม่มี |
- นิยามอยู่ใน `packages/server/src/plans/index.ts` (sync ลง DB ตอนสตาร์ท) · `FREE_UNLOCKED_FOR_TESTING = false`
- จำนวนวันทดลองแอดมินปรับได้ (`settings.trialDays`)

## 8) Deploy & Secrets
- เซิร์ฟเวอร์: Vultr `vhf-1c-1gb` Tokyo **45.77.26.217** (มี swap 2GB) · โฟลเดอร์ `/opt/vjlivekit`
- `deploy.yml` SSH เข้าไปรัน `deploy/bootstrap.sh` (idempotent: swap, Docker, ufw, `.env` สุ่มรหัสครั้งแรก, ล้างดิสก์/จำกัด journald, pull image, up, รอ Postgres)
- **Secrets:** `VULTR_HOST`, `VULTR_PASSWORD`/`VULTR_SSH_KEY`, `VULTR_USER`, `SIGN_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `GOOGLE_TTS_API_KEY`, `EASYSLIP_API_KEY`
- **Variables:** `DEPLOY_ENABLED`, `DOMAIN`, `DEMO_MODE`, `BILLING_PROVIDER`, `STRIPE_PRICE_PRO_MONTHLY`, `ADMIN_EMAILS`
- รายละเอียดทีละขั้น + Stripe + สำรองฐานข้อมูล: **DEPLOY.md**

## 9) รัน dev
```bash
npm install
cp .env.example .env && cp .env packages/server/.env   # DEMO_MODE=true เล่นได้เลย
docker compose up -d                                    # Postgres + Redis
npm run prisma:generate && npm run prisma:migrate
npm run build --workspace @vjlivekit/dashboard          # ให้ server เสิร์ฟ dashboard ที่ /
npm run dev                                             # http://localhost:8080
# แก้ dashboard แบบ hot reload: npm run dev:dashboard (พอร์ต 3000 + NEXT_PUBLIC_API_BASE)
# overlay เดโม: /overlay/collect.html?demo=1
```

## 10) กฎการทำงาน
- ตอบผู้ใช้ (เตย) เป็น **ภาษาไทย**
- **push เข้า main = ขึ้นเว็บจริง** → `npm run typecheck && npm run build` ผ่านก่อนเสมอ
- **ห้ามแก้ไฟล์ใน `prisma/migrations/` เอง** ใช้ `prisma migrate dev --name <ชื่อ>` เท่านั้น
- เพิ่มวิดเจ็ตใหม่: เพิ่มใน `WIDGET_TYPES` + ไฟล์ overlay + หน้าตั้งค่า + เช็กสิทธิ์ตามแพลน
- ห้ามใส่รหัส/คีย์ลงในโค้ด แชท หรือ commit → ใส่ใน GitHub Secrets เท่านั้น
- repo `APWEBV2` เป็นคนละโปรเจกต์ (.NET) ห้ามเอาโค้ด VJLiveKit ไปลง
- Claude แบบ **Cloud** (ไอคอนเมฆ) SSH เข้า Vultr ไม่ได้ และตั้ง Secrets/DNS ให้ไม่ได้ → ใช้ CI/CD หรือรัน `claude` บนเครื่องเตย (Local)

## 11) ยังค้าง / ความเสี่ยง (TODO)
- [ ] **ตาราง `LiveSession` อยู่ใน schema แต่ไม่มี migration** — ตอนนี้ปิดด้วย `LIVE_SESSIONS=false` (เก็บสถิติลงไฟล์แทน) ถ้าจะเปิดต้อง `prisma migrate dev --name live_session` ก่อน
- [ ] **ไม่มีเทสต์อัตโนมัติ** — อย่างน้อยควรมีเทสต์ getEntitlements, webhook Stripe, ruleMatches
- [ ] ยืนยัน Stripe ใช้งานจริง (keys + webhook endpoint + Customer Portal + `BILLING_PROVIDER=stripe`)
- [ ] ลืมรหัสผ่าน / ยืนยันอีเมล (ยังไม่มีผู้ให้บริการส่งอีเมล — ตอนนี้แอดมินรีเซ็ตให้)
- [ ] จ่าย Pro ด้วย PromptPay (Omise) — Stripe subscription ไม่รองรับ PromptPay
- [ ] widget league ยังพัฒนาอยู่
- [ ] สำรองฐานข้อมูล + volume `appdata` อัตโนมัติ (ยังไม่มี cron backup)
- [ ] รหัส root ของ Vultr เคยหลุดในแชท — ยืนยันว่าเปลี่ยนแล้ว / ย้ายไปใช้ SSH key
- [ ] (สเกล) Redis adapter สำหรับหลาย instance — ตอนนี้เป็น in-memory เครื่องเดียว

## 12) API endpoints
```
GET  /healthz  /api/version  /api/settings/public  /api/gifts  /api/live/status  /api/notifications
auth      POST register | login | password    GET/PATCH me
overlay   GET/POST /api/overlay-tokens   DELETE /api/overlay-tokens/:id
widgets   GET /api/widgets/configs   GET/PUT /api/widgets/:type/config
actions   GET/POST /api/actions  PUT/DELETE /api/actions/:id  POST /api/actions/:id/test  GET /api/actions/menu
sounds    GET/POST /api/sounds  DELETE /api/sounds/:id  GET /media/sounds/:userId/:file
beatpad   GET/PUT /api/beatpad  GET /api/beatpad/default  POST /api/beatpad/play
tts       GET /api/tts  GET /api/tts/status  POST /api/tts/say
billing   GET plans | payments   POST checkout | portal | webhook        (/api/billing/...)
donate    GET /api/donate/page  POST /api/donate/submit  GET /api/donations  POST /api/donations/:id/:act  GET /api/donations/:id/slip
referral  GET /api/referrals/me
support   GET/POST /api/support  GET /api/support/unread  GET /api/support/img/:id
tiktok    GET /api/tiktok/avatar/:username
admin     /api/admin/{overview, reports, users, users.csv, users/:id, users/:id/(grant|revoke-pro|revoke-tokens|reset-password|role|suspend),
          payments, live, lives, audit, settings, notifications, support, support/:userId(/status)}
Socket.IO: query { token, widget } (prod) หรือ { username } (demo) — events: tiktok-event, stats, status, state, action
```

## 13) Overlay
ไฟล์: `alerts chat coinjar collect donate dragcar follower fx fxmenu garden giftjar goal league mascot pile sign timer topgifters toplikers tts` (.html)
ทุกหน้า: `?t=<overlay-token>` (prod) · `?username=<ชื่อ>` (ต้อง DEMO_MODE=true) · `?demo=1` (เดโมในเบราว์เซอร์ล้วน)
ค่าส่วนใหญ่ตั้งจากหน้า **dashboard/widgets/settings** แล้วส่งถึง overlay สด ๆ (ไม่ต้องแก้ URL)

## 14) env vars (ดู `.env.example` / `.env.prod.example`)
```
PORT NODE_ENV DEMO_MODE DATABASE_URL REDIS_URL JWT_SECRET OVERLAY_TOKEN_TTL_DAYS PUBLIC_BASE_URL DOMAIN
SIGN_API_KEY  BILLING_PROVIDER STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET STRIPE_PRICE_PRO_MONTHLY
GOOGLE_TTS_API_KEY  EASYSLIP_API_KEY  ADMIN_EMAILS  LIVE_SESSIONS  SNAPSHOT_DIR  DASHBOARD_DIR  OMISE_*
```

## 15) อ้างอิง
- TikFinity: https://tikfinity.zerody.one/ · vj-studio: https://pmjx4e.vj-studio.com/widget/coinjar
- เดโม artifact รุ่นแรก: https://claude.ai/artifact/P2SsjkSV56Wg3E3WSe6MJY

---

## 16) 📋 Prompt สำหรับวางในแชทใหม่ (คัดลอกไปใช้ได้เลย)

> ทำงานต่อโปรเจกต์ **VJLiveKit** — repo `Tueyzzzz/VJLiveKit.com` branch `main` (ถ้าอยู่ในเครื่อง: `git pull origin main` ก่อน)
> แพลตฟอร์มวิดเจ็ต TikTok LIVE สไตล์ TikFinity แบบ SaaS ตลาดไทย — **ออนไลน์แล้วที่ https://vjlivekit.com**
> **อ่าน `HANDOFF.md` ให้จบก่อนลงมือ** (และ `DEPLOY.md` ถ้าเกี่ยวกับเซิร์ฟเวอร์) แล้วสรุปสถานะให้ฉันฟังสั้น ๆ
>
> สิ่งที่ต้องรู้:
> - push เข้า `main` = deploy ขึ้นเว็บจริงอัตโนมัติ ภายใน ~2 นาที → รัน `npm run typecheck && npm run build` ให้ผ่านก่อน push ทุกครั้ง
> - ข้อมูลหลักอยู่ใน Postgres (Prisma) แต่ข้อมูลหลังบ้านหลายอย่างเป็นไฟล์ JSON ใน volume `appdata` (ดูข้อ 6)
> - ห้ามแก้ `prisma/migrations/` เอง · ห้ามใส่รหัส/คีย์ในโค้ดหรือแชท · repo `APWEBV2` เป็นคนละโปรเจกต์
> - ถ้าเป็น Claude แบบ Cloud: SSH เข้า Vultr ไม่ได้ ใช้ GitHub Actions แทน
> - ตอบเป็นภาษาไทย
>
> งานที่อยากทำครั้งนี้: **[ใส่เอง — เช่น เพิ่มวิดเจ็ตใหม่ / ทำเทสต์ / เปิด Stripe จริง / แก้บั๊ก ...]**
