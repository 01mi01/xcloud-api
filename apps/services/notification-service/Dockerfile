# syntax=docker/dockerfile:1
# Build from the REPO ROOT:  docker build -f apps/services/notification-service/Dockerfile -t notification-service .
# (workspace build — needs root manifests + @xcloud/shared)

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/services/notification-service ./apps/services/notification-service
RUN npm install --workspace=packages/shared --workspace=apps/services/notification-service --include-workspace-root
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/services/notification-service
# Some deps (e.g. uuid) don't hoist to the root node_modules due to version
# conflicts elsewhere in the monorepo; ensure the service-local node_modules exists.
RUN mkdir -p apps/services/notification-service/node_modules

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
# Service-local node_modules holds non-hoisted deps (uuid, etc.) — required at runtime.
COPY --from=builder /app/apps/services/notification-service/node_modules ./apps/services/notification-service/node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/services/notification-service/dist ./apps/services/notification-service/dist
COPY --from=builder /app/apps/services/notification-service/package.json ./apps/services/notification-service/package.json
EXPOSE 3004
CMD ["node", "apps/services/notification-service/dist/index.js"]
