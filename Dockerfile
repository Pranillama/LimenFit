# Multi-stage production image for LimenFit (Next.js + pnpm).
#
# Trade-off: this image copies the full .next output and node_modules rather
# than using Next.js standalone mode (output: 'standalone' in next.config.ts).
# Standalone would produce a smaller runtime image but requires an app-code
# change, which is out of scope for T16.  To opt in later: add
#   output: 'standalone'
# to next.config.ts, then replace the runner COPY lines with the standalone
# server.js pattern from the Next.js Docker docs.
#
# IMPORTANT — build-time vs runtime env vars:
#
#   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and
#   NEXT_PUBLIC_SITE_URL are inlined into client-side JavaScript bundles by
#   Next.js at build time (NEXT_PUBLIC_* vars are statically replaced during
#   `next build`).  Supplying different values at `docker run` time has no
#   effect on the browser bundle.  You MUST pass the real public values as
#   --build-arg at image build time:
#
#     docker build \
#       --build-arg NEXT_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co \
#       --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
#       --build-arg NEXT_PUBLIC_SITE_URL=https://your-domain.com \
#       -t limenfit .
#
#   SUPABASE_SERVICE_ROLE_KEY is server-side only (never inlined into client
#   bundles).  Supply it at run time only — never bake a real service-role key
#   into a build layer:
#
#     docker run --env SUPABASE_SERVICE_ROLE_KEY=your-key -p 3000:3000 limenfit

# ── 1. base ──────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# ── 2. deps ──────────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ── 3. builder ───────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are inlined into client bundles at build time — real
# values are required here; docker run overrides have no effect on the browser.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

# SUPABASE_SERVICE_ROLE_KEY is server-side only — placeholder satisfies
# lib/env.ts Zod check during next build; real value is injected at docker run.
ARG SUPABASE_SERVICE_ROLE_KEY=docker-build-placeholder
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY

RUN pnpm build

# ── 4. runner ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user for security.
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts

USER nextjs

EXPOSE 3000

CMD ["pnpm", "start"]
