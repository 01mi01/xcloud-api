# syntax=docker/dockerfile:1
# Build from the REPO ROOT:  docker build -f apps/services/feed-service/Dockerfile -t feed-service .
# (workspace build — needs root manifests + @xcloud/shared)

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/sdk-server ./packages/sdk-server
COPY apps/services/feed-service ./apps/services/feed-service
RUN npm install --workspace=packages/shared --workspace=packages/sdk-server --workspace=apps/services/feed-service --include-workspace-root
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/sdk-server
RUN npm run build --workspace=apps/services/feed-service

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/sdk-server/dist-cjs ./packages/sdk-server/dist-cjs
COPY --from=builder /app/packages/sdk-server/dist-types ./packages/sdk-server/dist-types
COPY --from=builder /app/packages/sdk-server/package.json ./packages/sdk-server/package.json
COPY --from=builder /app/apps/services/feed-service/dist ./apps/services/feed-service/dist
COPY --from=builder /app/apps/services/feed-service/package.json ./apps/services/feed-service/package.json
COPY --from=builder /app/apps/services/feed-service/node_modules ./apps/services/feed-service/node_modules
EXPOSE 3003
CMD ["node", "apps/services/feed-service/dist/index.js"]
