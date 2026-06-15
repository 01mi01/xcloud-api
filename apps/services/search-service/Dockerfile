# syntax=docker/dockerfile:1
# Build from the REPO ROOT:  docker build -f apps/services/search-service/Dockerfile -t search-service .
# (workspace build — needs root manifests + @xcloud/shared)

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/services/search-service ./apps/services/search-service
RUN npm install --workspace=packages/shared --workspace=apps/services/search-service --include-workspace-root
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/services/search-service

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/services/search-service/dist ./apps/services/search-service/dist
COPY --from=builder /app/apps/services/search-service/package.json ./apps/services/search-service/package.json
COPY --from=builder /app/apps/services/search-service/node_modules ./apps/services/search-service/node_modules
EXPOSE 3005
CMD ["node", "apps/services/search-service/dist/index.js"]
