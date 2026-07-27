FROM node:24-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM base AS build

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm prisma:generate
RUN pnpm build

# Keep all dependencies including prisma CLI (needed for migrate deploy at runtime).
# Prisma CLI is in devDependencies but required at runtime for migrations.
# For a smaller image, consider a separate migration step/job instead.

FROM base AS production

ENV NODE_ENV=production

RUN apk add --no-cache tini

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

USER node

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/app/docker-entrypoint.sh"]
