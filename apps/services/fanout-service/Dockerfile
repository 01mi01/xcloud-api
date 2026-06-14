# syntax=docker/dockerfile:1
# Build from the REPO ROOT:  docker build -f apps/services/fanout-service/Dockerfile -t fanout-service .
# (workspace build — needs root manifests + @xcloud/shared)

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/services/fanout-service ./apps/services/fanout-service
RUN npm install --workspace=packages/shared --workspace=apps/services/fanout-service --include-workspace-root
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/services/fanout-service
# Ensure service-local node_modules exists (holds non-hoisted deps like uuid).
RUN mkdir -p apps/services/fanout-service/node_modules

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/services/fanout-service/node_modules ./apps/services/fanout-service/node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/services/fanout-service/dist ./apps/services/fanout-service/dist
COPY --from=builder /app/apps/services/fanout-service/package.json ./apps/services/fanout-service/package.json
EXPOSE 3007
CMD ["node", "apps/services/fanout-service/dist/index.js"]
