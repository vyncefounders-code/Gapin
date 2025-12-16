# ------------------------------------------------------
# 1. BUILD STAGE
# ------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace root files (package.json etc.)
COPY package*.json ./
COPY tsconfig*.json ./

# Copy only the gateway package
COPY packages/gateway ./packages/gateway


# Install dependencies (only production + workspace)
RUN npm install --workspaces --include-workspace-root

# Build TypeScript
RUN npm run build --workspace=@gapin/gateway


# ------------------------------------------------------
# 2. RUNTIME STAGE (small, secure)
# ------------------------------------------------------
FROM node:20-alpine AS runner

# Create non‑root user
RUN addgroup -S gapin && adduser -S gapin -G gapin

WORKDIR /app

# Copy built gateway output
COPY --from=builder /app/packages/gateway/dist ./dist
# Copy node_modules for gateway only
COPY --from=builder /app/node_modules ./node_modules

USER gapin

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Healthcheck for Kubernetes / Docker
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
