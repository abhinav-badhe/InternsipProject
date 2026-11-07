# ==============================================================================
# Omnichannel Grocery Platform — Production Multi-Stage Dockerfile
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build stage (Installs dependencies and compiles TypeScript)
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install build essentials for alpine
RUN apk add --no-cache libc6-compat

# Enable Corepack and pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependency manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json ./
COPY packages/ packages/
COPY services/ services/
COPY workers/ workers/
COPY scripts/ scripts/
COPY database/ database/

# Install workspace dependencies
RUN pnpm install --frozen-lockfile

# Compile all TypeScript packages and microservices
RUN pnpm -r run build

# ------------------------------------------------------------------------------
# Stage 2: Production Runtime image
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Enable Corepack and pnpm for runtime
RUN corepack enable && corepack prepare pnpm@latest --activate

ENV NODE_ENV=production
ENV PORT=3000

# Copy workspace assets from builder stage
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services ./services
COPY --from=builder /app/workers ./workers
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/database ./database

# Create non-root user and assign permissions
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 grocery && \
    chown -R grocery:nodejs /app

USER grocery

# API Gateway entrypoint
EXPOSE 3000

# Container Healthcheck (Monitors API Gateway Liveness)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health/live || exit 1

# Start unified microservices backend orchestrator
CMD ["node", "scripts/start-backend.mjs"]

