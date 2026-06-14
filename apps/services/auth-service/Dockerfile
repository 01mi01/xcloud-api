# syntax=docker/dockerfile:1
# Build from the REPO ROOT:  docker build -f apps/services/auth-service/Dockerfile -t auth-service .
# (workspace build — needs root manifests + @xcloud/shared)

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/services/auth-service ./apps/services/auth-service
RUN npm install --workspace=packages/shared --workspace=apps/services/auth-service --include-workspace-root
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/services/auth-service
# Ensure service-local node_modules exists (holds non-hoisted deps like uuid).
RUN mkdir -p apps/services/auth-service/node_modules

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/services/auth-service/node_modules ./apps/services/auth-service/node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/services/auth-service/dist ./apps/services/auth-service/dist
COPY --from=builder /app/apps/services/auth-service/package.json ./apps/services/auth-service/package.json
EXPOSE 3000
CMD ["node", "apps/services/auth-service/dist/index.js"]
