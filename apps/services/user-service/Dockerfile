# syntax=docker/dockerfile:1
# Build from the REPO ROOT:  docker build -f apps/services/user-service/Dockerfile -t user-service .
# (workspace build — needs root manifests + @xcloud/shared)

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/services/user-service ./apps/services/user-service
RUN npm install --workspace=packages/shared --workspace=apps/services/user-service --include-workspace-root
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/services/user-service

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/services/user-service/dist ./apps/services/user-service/dist
COPY --from=builder /app/apps/services/user-service/package.json ./apps/services/user-service/package.json
EXPOSE 3001
CMD ["node", "apps/services/user-service/dist/index.js"]
