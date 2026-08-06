FROM node:25-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@11.10.0 --activate

WORKDIR /app

# -----------------------------------------------------------------------------
# Install all dependencies (including dev dependencies)
# -----------------------------------------------------------------------------
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Build application
# -----------------------------------------------------------------------------
FROM deps AS build

COPY . .

RUN pnpm prisma:generate
RUN pnpm build

# Remove dev dependencies for the runtime image.
RUN pnpm prune --prod

# -----------------------------------------------------------------------------
# Migrator image
# -----------------------------------------------------------------------------
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

# -----------------------------------------------------------------------------
# Production image
# -----------------------------------------------------------------------------
FROM node:25-alpine AS production

ENV NODE_ENV=production

RUN apk add --no-cache tini wget

WORKDIR /app

COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-lock.yaml ./
COPY --from=build /app/pnpm-workspace.yaml ./

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

# The runtime only runs `node dist/main.js` (see docker-entrypoint.sh), so the
# bundled package managers are dead weight. Their vendored deps (corepack ships
# undici/tar, npm ships tar/brace-expansion) are what Trivy flags in this image,
# even though none appear in our own lockfile. Remove them to keep the runtime
# clean and shrink the attack surface.
RUN rm -rf \
      /usr/local/lib/node_modules/npm \
      /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm \
      /usr/local/bin/npx \
      /usr/local/bin/corepack \
      /pnpm

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/health/ready || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["./docker-entrypoint.sh"]