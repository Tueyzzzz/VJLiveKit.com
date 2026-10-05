# 🚀 Deploy VJLiveKit (Vultr + Docker + Caddy HTTPS) — ผ่าน GitHub Actions

ระบบ deploy ทำงานแบบนี้:

```
push ขึ้น main ─► CI: typecheck + build ─► build Docker image + smoke test ─► push image ขึ้น GHCR
                                                                            │
                         Deploy workflow (SSH เข้า Vultr) ◄─────────────────┘
                         └─ deploy/bootstrap.sh: swap, Docker, firewall, .env (สุ่มรหัส), pull image, up -d
```

เครื่อง 1GB ไม่ต้อง build อะไรเลย แค่ดึง image สำเร็จรูปมารัน และ **ไม่ต้อง SSH เข้าไปตั้งค่าเอง** เพราะ bootstrap ติดตั้งให้หมด

---

## ✅ สิ่งที่ต้องทำเอง (ครั้งเดียว)

### 1) ตั้ง DNS ที่ Dynadot
Dynadot → **My Domains** → `vjlivekit.com` → **DNS Settings** → เลือก **Dynadot DNS** แล้วเพิ่ม:

| Type | Host | Value |
|------|------|-------|
| A | (เว้นว่าง / `@`) | `45.77.26.217` |
| A | `www` | `45.77.26.217` |

ลบ record เก่าที่ชี้ไปที่อื่น (เช่น parking / forwarding) ออก แล้วรอ 5–30 นาที
เช็ก: `nslookup vjlivekit.com` ต้องได้ `45.77.26.217`

> ⚠️ ต้องให้ DNS ชี้ถูกก่อน Caddy ถึงจะออกใบรับรอง HTTPS ได้ (ถ้า deploy ก่อน DNS พร้อม ไม่เป็นไร Caddy จะลองใหม่เอง)

### 2) เปลี่ยนรหัส root บน Vultr
รหัสเดิมหลุดในแชทแล้ว → Vultr panel → เครื่อง → **Settings → Reset root password** หรือ View Console แล้วพิมพ์ `passwd`

### 3) ใส่ Secrets / Variables ที่ GitHub
repo → **Settings → Secrets and variables → Actions**

**Secrets** (แท็บ Secrets → New repository secret):

| ชื่อ | ค่า | จำเป็น |
|------|-----|--------|
| `VULTR_HOST` | `45.77.26.217` | ✅ |
| `VULTR_PASSWORD` | รหัส root **ใหม่** | ✅ (หรือใช้ `VULTR_SSH_KEY` แทน — ปลอดภัยกว่า) |
| `VULTR_SSH_KEY` | private key ทั้งไฟล์ (ถ้าใช้ key) | ทางเลือก |
| `VULTR_USER` | ไม่ใส่ = `root` | – |
| `SIGN_API_KEY` | key จาก eulerstream.com (ต่อไลฟ์จริง) | แนะนำ |
| `GOOGLE_TTS_API_KEY` | API key Google Cloud (เปิด Cloud Text-to-Speech API) — อ่านแชทออกเสียงใน OBS | แนะนำ |
| `STRIPE_SECRET_KEY` | `sk_live_…` / `sk_test_…` | ตอนเปิดรับเงิน |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | ตอนเปิดรับเงิน |

**Variables** (แท็บ Variables):

- `ADMIN_EMAILS` — อีเมลแอดมิน คั่นด้วย `,` (เข้าหน้าหลังบ้าน `/dashboard/admin/`)


| ชื่อ | ค่า |
|------|-----|
| `DEPLOY_ENABLED` | `true` ← สวิตช์เปิด deploy |
| `DOMAIN` | `vjlivekit.com` (ไม่ใส่ก็ได้) |
| `DEMO_MODE` | `true` = อีเวนต์ปลอมไว้ทดสอบ, `false` = ไลฟ์จริง |
| `BILLING_PROVIDER` | `stripe` เมื่อพร้อมรับเงิน (ไม่ใส่ = ปิดระบบจ่ายเงิน) |
| `STRIPE_PRICE_PRO_MONTHLY` | (ออปชัน) price id — ไม่ใส่จะใช้ราคา 149฿ จากโค้ด |

### 4) กด Deploy
- **Actions → Deploy → Run workflow** (ครั้งแรก) — หรือ merge/push เข้า `main` แล้วจะ deploy เองหลัง CI เขียว
- ครั้งแรกใช้ ~3–5 นาที (ติดตั้ง Docker + swap)

### ✅ เช็กว่าขึ้นแล้ว
- https://vjlivekit.com/healthz → `{"ok":true}`
- https://vjlivekit.com → หน้าแรก + สมัครสมาชิก → Dashboard

> ⚠️ ถ้า Deploy ล้มที่ขั้น "Bootstrap" เพราะ pull image ไม่ได้ (`manifest unknown`) แปลว่ายังไม่เคยมี CI รันบน `main` หลัง merge โค้ดชุดนี้ — push/merge เข้า main ก่อน 1 ครั้ง

---

## 💳 เปิดรับเงินด้วย Stripe
1. สมัคร/เข้า https://dashboard.stripe.com → เปิดบัญชีไทย (รองรับ THB)
2. **Developers → API keys** → คัดลอก Secret key → ใส่ secret `STRIPE_SECRET_KEY`
3. **Developers → Webhooks → Add endpoint**
   - URL: `https://vjlivekit.com/api/billing/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
   - คัดลอก Signing secret (`whsec_…`) → ใส่ secret `STRIPE_WEBHOOK_SECRET`
4. **Settings → Billing → Customer portal** → กด Activate (ให้ผู้ใช้ยกเลิก/เปลี่ยนบัตรเองได้)
5. ตั้ง variable `BILLING_PROVIDER=stripe` แล้ว Run workflow Deploy อีกครั้ง

ทดสอบด้วย test key ก่อน: บัตร `4242 4242 4242 4242` วันหมดอายุอนาคต CVC อะไรก็ได้

---

## 🛠️ ดูแลเครื่อง (ถ้า SSH เข้าได้)
```bash
cd /opt/vjlivekit
docker compose -f docker-compose.prod.yml ps          # สถานะ
docker compose -f docker-compose.prod.yml logs -f app # log แอป
nano .env && docker compose -f docker-compose.prod.yml up -d   # แก้ค่าแล้วรีสตาร์ท
# สำรองฐานข้อมูล
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U vjlivekit vjlivekit | gzip > backup-$(date +%F).sql.gz
```
ไฟล์ `.env` บนเครื่องถูกสร้างครั้งแรกพร้อม `POSTGRES_PASSWORD`/`JWT_SECRET` แบบสุ่ม — deploy ครั้งต่อไปจะไม่ทับ (ยกเว้นค่าที่ส่งมาจาก GitHub Secrets/Variables)

## หมายเหตุเครื่อง 1GB RAM
- bootstrap สร้าง swap 2GB ให้อัตโนมัติ, จำกัด heap Node 384MB, Postgres `shared_buffers=64MB`
- ยังไม่รัน Redis (โค้ด v1 ยังไม่ใช้) — ประหยัด RAM
- คนใช้เยอะขึ้น → Vultr **resize** เป็น `vhf-1c-2gb` ได้เลย ไม่ต้องแก้อะไร
