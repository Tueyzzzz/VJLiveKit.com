#!/usr/bin/env bash
# VJLiveKit — ติดตั้ง/อัปเดตบนเซิร์ฟเวอร์ (Ubuntu) แบบ idempotent: รันซ้ำกี่ครั้งก็ปลอดภัย
# GitHub Actions (deploy.yml) เป็นคนเรียกไฟล์นี้ผ่าน SSH พร้อม env:
#   APP_IMAGE, GHCR_USER, GHCR_TOKEN, DOMAIN, (ออปชัน) DEMO_MODE SIGN_API_KEY BILLING_PROVIDER STRIPE_*
# รันเองบนเครื่องก็ได้: sudo APP_IMAGE=ghcr.io/<owner>/<repo>:latest DOMAIN=vjlivekit.com bash deploy/bootstrap.sh
set -euo pipefail

APP_DIR=/opt/vjlivekit
DOMAIN="${DOMAIN:-vjlivekit.com}"
: "${APP_IMAGE:?ต้องระบุ APP_IMAGE}"
log() { echo "==> $*"; }

[ "$(id -u)" -eq 0 ] || { echo "ต้องรันด้วย root (หรือ sudo)"; exit 1; }
export DEBIAN_FRONTEND=noninteractive

# ---------- 1) swap 2GB (จำเป็นบนเครื่อง RAM 1GB) ----------
if ! swapon --show | grep -q .; then
  log "สร้าง swap 2GB"
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ---------- 2) Docker ----------
if ! command -v docker >/dev/null 2>&1; then
  log "ติดตั้ง Docker"
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker >/dev/null 2>&1 || true

# ---------- 3) Firewall: เปิด SSH/80/443 ----------
if command -v ufw >/dev/null 2>&1 || apt-get install -y ufw >/dev/null 2>&1; then
  ufw allow OpenSSH >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; ufw allow 443/udp >/dev/null
  ufw --force enable >/dev/null
fi

# ---------- 4) .env (สร้างครั้งแรกพร้อมรหัสสุ่ม — ครั้งต่อไปไม่ทับของเดิม) ----------
mkdir -p "$APP_DIR"
cd "$APP_DIR"
if [ ! -f .env ]; then
  log "สร้าง .env ใหม่ (สุ่ม POSTGRES_PASSWORD / JWT_SECRET)"
  PGPASS=$(openssl rand -hex 24)
  cat > .env <<ENV
# สร้างอัตโนมัติโดย deploy/bootstrap.sh — แก้ได้ (deploy ครั้งต่อไปจะไม่ทับค่าที่มีอยู่ ยกเว้นค่าที่ส่งมาจาก GitHub Secrets)
NODE_ENV=production
PORT=8080
DOMAIN=${DOMAIN}
PUBLIC_BASE_URL=https://${DOMAIN}
DEMO_MODE=false
POSTGRES_USER=vjlivekit
POSTGRES_PASSWORD=${PGPASS}
POSTGRES_DB=vjlivekit
DATABASE_URL=postgresql://vjlivekit:${PGPASS}@postgres:5432/vjlivekit?schema=public
JWT_SECRET=$(openssl rand -hex 32)
OVERLAY_TOKEN_TTL_DAYS=365
SIGN_API_KEY=
BILLING_PROVIDER=none
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO_MONTHLY=
ENV
  chmod 600 .env
fi

# ตั้งค่า KEY=VALUE ใน .env (แทนที่ถ้ามี / เพิ่มถ้าไม่มี) — ใช้กับค่าที่ส่งมาจาก GitHub Secrets/Variables
set_env() {
  local key="$1" val="$2"
  [ -n "$val" ] || return 0
  local tmp; tmp=$(mktemp)
  grep -v "^${key}=" .env > "$tmp" || true
  printf '%s=%s\n' "$key" "$val" >> "$tmp"
  cat "$tmp" > .env && rm -f "$tmp"
}
set_env DOMAIN "$DOMAIN"
set_env PUBLIC_BASE_URL "https://${DOMAIN}"
set_env APP_IMAGE "$APP_IMAGE"
set_env DEMO_MODE "${DEMO_MODE:-}"
set_env SIGN_API_KEY "${SIGN_API_KEY:-}"
set_env BILLING_PROVIDER "${BILLING_PROVIDER:-}"
set_env STRIPE_SECRET_KEY "${STRIPE_SECRET_KEY:-}"
set_env STRIPE_WEBHOOK_SECRET "${STRIPE_WEBHOOK_SECRET:-}"
set_env STRIPE_PRICE_PRO_MONTHLY "${STRIPE_PRICE_PRO_MONTHLY:-}"

# ---------- 5) ดึง image ใหม่แล้วรัน ----------
if [ -n "${GHCR_TOKEN:-}" ]; then
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:-github}" --password-stdin >/dev/null
fi
log "ดึง image ${APP_IMAGE}"
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --remove-orphans
docker logout ghcr.io >/dev/null 2>&1 || true
docker image prune -f >/dev/null

# ---------- 6) รอให้แอปพร้อม ----------
log "รอแอปพร้อม..."
for _ in $(seq 1 40); do
  if docker compose -f docker-compose.prod.yml exec -T app node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    log "✅ แอปทำงานแล้ว — https://${DOMAIN}"
    docker compose -f docker-compose.prod.yml ps
    exit 0
  fi
  sleep 3
done
echo "❌ แอปไม่ขึ้นภายในเวลาที่กำหนด — log ล่าสุด:"
docker compose -f docker-compose.prod.yml logs --tail 80 app
exit 1
