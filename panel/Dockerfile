# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

COPY . .

# Build-time env — Nuxt needs the public API base at build time for SSR
ARG NUXT_PUBLIC_API_BASE=https://iaa.eudi.slixh.com
ENV NUXT_PUBLIC_API_BASE=${NUXT_PUBLIC_API_BASE}

RUN pnpm build

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache dumb-init

WORKDIR /app

# Nuxt SSR output is self-contained in .output/
COPY --from=builder /app/.output ./

EXPOSE 3000

ENV HOST=0.0.0.0
ENV PORT=3000

CMD ["dumb-init", "node", "server/index.mjs"]
