# syntax=docker/dockerfile:1
# Build from the REPO ROOT:  docker build -f apps/services/media-service/Dockerfile -t media-service .
# (workspace build — needs root manifests + @xcloud/shared)

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/services/media-service ./apps/services/media-service
RUN npm install --workspace=packages/shared --workspace=apps/services/media-service --include-workspace-root
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/services/media-service
# Ensure service-local node_modules exists (holds non-hoisted deps like uuid).
RUN mkdir -p apps/services/media-service/node_modules

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/services/media-service/node_modules ./apps/services/media-service/node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/services/media-service/dist ./apps/services/media-service/dist
COPY --from=builder /app/apps/services/media-service/package.json ./apps/services/media-service/package.json
EXPOSE 3006
CMD ["node", "apps/services/media-service/dist/index.js"]
