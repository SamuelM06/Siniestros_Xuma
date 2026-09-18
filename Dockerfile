# Multi-stage Dockerfile optimizado para Coolify y Astro 7 (SSR Node)
FROM node:22-alpine AS base
WORKDIR /app

# 1. Instalar dependencias
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# 2. Compilar la aplicación
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
RUN npm run build

# 3. Contenedor de producción ligero
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

# Usuario de sistema seguro sin privilegios de root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 astro

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder --chown=astro:nodejs /app/dist ./dist
COPY --from=builder --chown=astro:nodejs /app/public ./public

USER astro

EXPOSE 4321

CMD ["node", "./dist/server/entry.mjs"]
