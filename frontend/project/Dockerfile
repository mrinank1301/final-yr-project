# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
# lucide-react@0.294 peer is React 16/17/18 only; project uses React 19. Allow install.
RUN npm ci --legacy-peer-deps

COPY . .
# Prevent copying local env (use build args in CI)
RUN rm -f .env .env.local .env.*.local 2>/dev/null || true

# Build-time env for API URLs (override in docker-compose with PUBLIC_URL)
ARG NEXT_PUBLIC_API_URL=
ARG NEXT_PUBLIC_PYTHON_API_URL=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_PYTHON_API_URL=$NEXT_PUBLIC_PYTHON_API_URL

RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
