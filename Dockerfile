# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Install dependencies first (layer cache)
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# Copy source
COPY tsconfig.json nest-cli.json ./
COPY prisma/ ./prisma/
COPY prisma.config.ts ./
COPY src/ ./src/

# prisma generate only needs a valid URL format, not a real DB
ENV DATABASE_URL="file:/tmp/build.db"
RUN npx prisma generate

# Build — fail loudly if dist/main.js is not produced
RUN pnpm build && test -f dist/main.js || (echo "ERROR: dist/main.js not found after build" && exit 1)

# Prune dev dependencies
RUN pnpm prune --prod

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy built app and prod node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY package.json ./

# Data directory for SQLite — mount a volume here in production
RUN mkdir -p /app/data

# Certs directory — mount read-only volume with rp-signing.key + access-certificate.crt
RUN mkdir -p /app/certs

EXPOSE 3000

# Run schema push on startup, then start the app
CMD ["sh", "-c", "npx prisma db push && dumb-init node dist/main.js"]
