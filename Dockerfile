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
# Subruta pública (p. ej. /siniestros). No es secreto: en Coolify márcala como Buildtime y Runtime.
ARG BASE_PATH=""
ENV BASE_PATH=${BASE_PATH}
RUN npm run build

# 3. Contenedor de producción ligero
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321
ARG BASE_PATH=""
ENV BASE_PATH=${BASE_PATH}

# Usuario de sistema seguro sin privilegios de root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 astro

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/scripts ./scripts
COPY --from=builder --chown=astro:nodejs /app/dist ./dist
COPY --from=builder --chown=astro:nodejs /app/public ./public

USER astro

EXPOSE 4321

# Healthcheck sobre un estático bajo el base: "/" da 404 y las páginas dan 401 (exigen sesión).
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3   CMD wget -q --spider "http://127.0.0.1:4321${BASE_PATH}/logos/Transparente_Logo_azul_letra_azul.svg" || exit 1

CMD ["node", "./scripts/serve.mjs"]
