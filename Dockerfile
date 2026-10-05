# ---------- build stage: compile server + build dashboard (static) ----------
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/server/package.json ./packages/server/
COPY packages/overlay/package.json ./packages/overlay/
COPY packages/dashboard/package.json ./packages/dashboard/
RUN npm ci
COPY packages ./packages
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate --schema packages/server/prisma/schema.prisma \
 && npm run build

# ---------- deps stage: production dependencies of the server only ----------
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/server/package.json ./packages/server/
COPY packages/overlay/package.json ./packages/overlay/
COPY packages/dashboard/package.json ./packages/dashboard/
COPY packages/server/prisma ./packages/server/prisma
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN npm ci --omit=dev --workspace @vjlivekit/server --include-workspace-root=false \
 && npx prisma generate --schema packages/server/prisma/schema.prisma \
 && npm cache clean --force

# ---------- runtime stage ----------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    OVERLAY_DIR=/app/packages/overlay/public \
    DASHBOARD_DIR=/app/packages/dashboard/out
# prisma ต้องใช้ openssl
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/server/package.json ./packages/server/package.json
COPY --from=build /app/packages/server/dist ./packages/server/dist
COPY --from=build /app/packages/server/prisma ./packages/server/prisma
COPY --from=build /app/packages/overlay/public ./packages/overlay/public
COPY --from=build /app/packages/dashboard/out ./packages/dashboard/out
WORKDIR /app/packages/server
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# รัน migrate ก่อนเสมอ แล้วค่อยสตาร์ท
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
