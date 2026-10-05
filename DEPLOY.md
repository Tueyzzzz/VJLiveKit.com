# 🚀 Deploy VJLiveKit (Vultr + Docker + Caddy HTTPS)

คู่มือนำ VJLiveKit ขึ้นเซิร์ฟเวอร์จริง ใช้ Docker Compose + Caddy (ออก HTTPS ให้อัตโนมัติ)

---

## ขั้นที่ 1 — ตั้ง DNS ที่ Dynadot (ชี้โดเมนมาที่เครื่อง)
1. เข้า Dynadot → **My Domains** → `vjlivekit.com` → **DNS Settings**
2. เลือกใช้ **Dynadot DNS** (หรือ DNS Hosting) แล้วเพิ่ม 2 records:

| Type | Host / Subdomain | Value (IP) |
|------|------------------|------------|
| A | (เว้นว่าง หรือ `@`) | `45.77.26.217` |
| A | `www` | `45.77.26.217` |

3. บันทึก แล้วรอ DNS propagate (ปกติ 5–30 นาที)
   เช็กได้: `nslookup vjlivekit.com` ต้องได้ IP `45.77.26.217`

> ⚠️ ต้องให้ DNS ชี้มาก่อน Caddy ถึงจะขอใบรับรอง HTTPS สำเร็จ

---

## ขั้นที่ 2 — เตรียมเครื่อง (SSH เข้า Vultr)
```bash
ssh root@45.77.26.217
passwd                     # ⚠️ เปลี่ยนรหัส root ใหม่ทันที (อันเก่าหลุดแล้ว)
```
ถ้ายังไม่มี Docker/swap (ไม่ได้ใช้ Startup Script) ให้รัน:
```bash
# swap 2GB (จำเป็นบนเครื่อง 1GB)
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
# docker + git + firewall
curl -fsSL https://get.docker.com | sh
apt-get install -y git ufw
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

---

## ขั้นที่ 3 — ดึงโค้ด
repo เป็น private → ใช้ Personal Access Token (github.com/settings/tokens) ตอน clone:
```bash
cd /opt
git clone https://github.com/Tueyzzzz/VJLiveKit.com.git vjlivekit
cd vjlivekit
# Username: Tueyzzzz, Password: <วาง Personal Access Token>
```

---

## ขั้นที่ 4 — ตั้งค่า .env
```bash
cp .env.prod.example .env
nano .env
```
แก้อย่างน้อย 3 ค่า:
- `POSTGRES_PASSWORD` + `DATABASE_URL` → ใช้รหัสเดียวกัน (ยาว ๆ)
- `JWT_SECRET` → สุ่มด้วย `openssl rand -hex 32`
- (อยากทดสอบ overlay ก่อนต่อไลฟ์จริง ตั้ง `DEMO_MODE=true`)

> ต่อ TikTok จริงต้องใส่ `SIGN_API_KEY` (ขอฟรีที่ eulerstream.com)

---

## ขั้นที่ 5 — รัน!
```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f app   # ดู log (Ctrl+C ออก)
```
Caddy จะขอ HTTPS ให้อัตโนมัติ (รอสักครู่หลัง DNS ชี้ถูก)

### ✅ เช็กว่าขึ้นแล้ว
- https://vjlivekit.com/healthz → `{"ok":true}`
- https://vjlivekit.com/overlay/coinjar.html?username=test (ถ้า DEMO_MODE=true)

---

## อัปเดตเวอร์ชันใหม่ (ครั้งถัดไป)
```bash
cd /opt/vjlivekit
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## คำสั่งที่ใช้บ่อย
```bash
docker compose -f docker-compose.prod.yml ps        # สถานะ
docker compose -f docker-compose.prod.yml logs -f   # ดู log
docker compose -f docker-compose.prod.yml down      # หยุด
```

---

## หมายเหตุเครื่อง 1GB RAM
- ต้องมี **swap** (ขั้นที่ 2) ไม่งั้น build/migrate อาจ OOM
- ถ้า build บนเครื่องช้า/หนัก → พิจารณา build image ผ่าน GitHub Actions แล้ว pull ลงมา
- มีคนใช้เยอะขึ้น → กด **resize** เป็น `vhf-1c-2gb` บน Vultr ได้เลย

---

## ⚙️ CI/CD อัตโนมัติ (GitHub Actions)
Workflow 2 ตัว:
- **CI** (`ci.yml`) — ทุก push/PR: ติดตั้ง, prisma generate, typecheck, build
- **Deploy** (`deploy.yml`) — เมื่อ CI ผ่านบน `main`: SSH ไป Vultr แล้ว `git pull` + `docker compose up -d --build`

### เปิดใช้งาน auto-deploy (ทำครั้งเดียว)
1. **เพิ่ม SSH deploy key** บนเครื่อง (ให้ GitHub Actions ใช้ล็อกอิน):
   ```bash
   # บนเครื่อง Vultr: อนุญาต public key ของ Actions
   # (ง่ายสุด: ใช้ private key ตัวที่คุณ SSH อยู่แล้ว เอา private key ไปใส่เป็น secret)
   ```
2. ที่ GitHub repo → **Settings → Secrets and variables → Actions**:
   - **Secrets** → เพิ่ม:
     - `VULTR_HOST` = `45.77.26.217`
     - `VULTR_USER` = `root`
     - `VULTR_SSH_KEY` = เนื้อหา **private key** (เช่น `~/.ssh/id_ed25519` ทั้งไฟล์)
   - **Variables** → เพิ่ม `DEPLOY_ENABLED` = `true`  ← สวิตช์เปิด deploy
3. ให้ `git pull` บนเครื่องทำงานแบบไม่ถาม: ครั้งแรกตั้ง credential ให้จำ
   ```bash
   cd /opt/vjlivekit && git config credential.helper store && git pull   # ใส่ PAT ครั้งเดียว
   ```
   (หรือใช้ GitHub **Deploy Key** แบบ read-only จะปลอดภัยกว่า)

เสร็จแล้ว ทุกครั้งที่ push ขึ้น `main` และ CI เขียว → เครื่องจะอัปเดตเองอัตโนมัติ 🎉

> 💡 เครื่อง 1GB: การ build บนเครื่องอาจช้า/กินแรม — ถ้าเริ่มมีปัญหา ค่อยเปลี่ยนไปใช้ **build image บน GitHub Actions แล้ว push ขึ้น GHCR** ให้เครื่องแค่ `docker compose pull` (เบากว่ามาก) — บอกผมได้เมื่อถึงจุดนั้น
