FROM node:24-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@11.10.0 --activate

WORKDIR /app

# ---------------------------------------------------------------------------
# Full dependencies (dev + prod) — used for building and for the migrator image.
# ---------------------------------------------------------------------------
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# ---------------------------------------------------------------------------
# Production-only dependencies — used for the slim runtime image.
# ---------------------------------------------------------------------------
FROM base AS prod-deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# ---------------------------------------------------------------------------
# Build the application and generate the Prisma client.
# ---------------------------------------------------------------------------
FROM base AS build

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm prisma:generate
RUN pnpm build

# ---------------------------------------------------------------------------
# Migrator image — carries the Prisma CLI + schema + migrations only.
# The one-shot `migrate` service runs `prisma migrate deploy` from this image.
# ---------------------------------------------------------------------------
FROM base AS migrator

ENV NODE_ENV=production

RUN apk add --no-cache tini

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts

USER node

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["pnpm", "prisma", "migrate", "deploy", "--schema=prisma/schema.prisma"]

# ---------------------------------------------------------------------------
# Slim production runtime — prod deps + generated client + compiled app only.
# ---------------------------------------------------------------------------
FROM base AS production

ENV NODE_ENV=production

RUN apk add --no-cache tini wget

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=prod-deps /app/node_modules ./node_modules
# Overlay the generated Prisma client (produced during build) onto prod deps.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/health/ready || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/app/docker-entrypoint.sh"]
