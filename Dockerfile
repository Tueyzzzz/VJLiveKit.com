# ---------- build stage ----------
FROM node:20-bookworm-slim AS build
WORKDIR /app
# ติดตั้ง dependencies (ใช้ cache layer)
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/server/package.json ./packages/server/
COPY packages/overlay/package.json ./packages/overlay/
RUN npm ci
# คัดลอกซอร์ส + generate prisma + build
COPY packages/server ./packages/server
COPY packages/overlay ./packages/overlay
RUN npx prisma generate --schema packages/server/prisma/schema.prisma \
 && npm run build

# ---------- runtime stage ----------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# ต้องมี openssl ให้ prisma
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/server/package.json ./packages/server/package.json
COPY --from=build /app/packages/server/dist ./packages/server/dist
COPY --from=build /app/packages/server/prisma ./packages/server/prisma
COPY --from=build /app/packages/overlay/public ./packages/overlay/public
WORKDIR /app/packages/server
EXPOSE 8080
# รัน migrate ก่อนเสมอ แล้วค่อยสตาร์ท
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
