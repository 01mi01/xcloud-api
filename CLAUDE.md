# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**X(dot)com** — a Twitter/X clone built as a microservices system for the *Arquitectura en la Nube y Microservicios* course (Maestría Full Stack Development, UCB 2026). It is a **cloud-ready npm-workspaces monorepo**: services run locally on Docker (Kafka/Redis/Cassandra/Elasticsearch) and deploy to AWS via CDK (ECS Fargate + RDS + ElastiCache + SQS/SNS + OpenSearch).

The user-facing README (`README.md`) is the authoritative setup/usage doc — keep it in sync when changing ports, endpoints, env vars, or topics.

## Repository layout

Monorepo with a **root `package.json` (npm workspaces)**: `apps/web`, `apps/services/*`, `packages/*`, `infrastructure`.

```
xcloud-api/
├── package.json / tsconfig.base.json   # workspaces root
├── docker-compose.yml                  # local infra: Postgres, Cassandra, Redis, Kafka, ES (+init)
├── .env.example                        # copy to .env (root); ALL services read the ROOT .env
├── db/                                 # init.sql (PostgreSQL) + cassandra-init.cql
├── api-model/                          # Smithy model + Smithy CLI (→ OpenAPI). `brew install smithy-cli`
├── apps/
│   ├── web/                            # React 19 + Vite SPA (ESM)
│   └── services/                       # 8 backend services (TypeScript, CommonJS)
├── packages/
│   ├── shared/                         # @xcloud/shared — dual CJS/ESM; build before services
│   ├── sdk-client/                     # Smithy-generated TS client (gitignored output; `npm run generate`). Wired into apps/web.
│   ├── sdk-server/                     # Smithy-generated server SDK/SSDK, CJS (gitignored output; `npm run generate`). Full-SSDK pilot in user-service; contract types in tweet/feed.
├── infrastructure/                     # AWS CDK (stacks/, constructs/, config/)
├── k8s/                                # reference only (ADR-002 chose ECS over EKS)
└── docs/                               # ADRs, runbooks, migration-baseline.md
```

## Services & data stores

`apps/services/*` — all TypeScript on Express 5, CommonJS, each reads the root `.env`.

| Service | Port (env var) | Store | Messaging |
|---|---|---|---|
| auth | 3000 (`AUTH_PORT`) | PostgreSQL `auth_users` | — (JWT+bcrypt; Cognito gated by NODE_ENV) |
| user | 3001 (`USER_PORT`) | PostgreSQL `users`,`follows` | publishes `user.followed` |
| tweet | 3002 (`TWEET_PORT`) | Cassandra/Keyspaces | publishes `tweet.created`, `tweet.liked` |
| feed | 3003 (`FEED_PORT`) | Redis + Cassandra | — (HTTP hydration) |
| notification | 3004 (`NOTIFICATION_PORT`) | PostgreSQL `notifications` | consumes `tweet.liked`, `user.followed` |
| search | 3005 (`SEARCH_PORT`) | Elasticsearch / OpenSearch | consumes `tweet.created` |
| media | 3006 (`MEDIA_PORT`) | S3 (prod) | — (stub: `/health` + 503) |
| fanout | worker; `/health` 3007 (`FANOUT_PORT`) | Redis + PostgreSQL | consumes `tweet.created` |

## Hybrid messaging (the key architectural decision)

Producers/consumers go through **`@xcloud/shared`** (`packages/shared/src/messaging/`), which switches transport by `NODE_ENV`:
- **local dev → Kafka** (kafkajs; topics `tweet.created`, `tweet.liked`, `tweet.retweeted`, `user.followed`, `user.created`, `user.updated`, auto-created by `kafka-init`).
- **production → SQS/SNS.** `tweet.created` fans out to **two** consumers (fanout + search) and `tweet.retweeted` to **two** (fanout + notification), each via an **SNS topic → 2 SQS queues**; `tweet.liked`/`user.followed`/`user.created`/`user.updated` are 1:1 SQS queues.

Use `createPublisher({clientId})` / `createConsumer({clientId, groupId})`. Prod env vars (set by CDK, matched in shared): `TWEET_CREATED_TOPIC_ARN`, `TWEET_RETWEETED_TOPIC_ARN`, `FANOUT_QUEUE_URL`, `TWEET_INDEX_QUEUE_URL`, `FANOUT_RETWEET_QUEUE_URL`, `NOTIFY_RETWEET_QUEUE_URL`, `LIKE_EVENT_QUEUE_URL`, `FOLLOW_EVENT_QUEUE_URL`, `USER_CREATED_QUEUE_URL`, `USER_UPDATED_QUEUE_URL`. Do **not** reintroduce direct `kafkajs` in services — route through `@xcloud/shared`. **A producer added to a service whose tests don't mock it will open a real Kafka connection in unit tests (slow + open handle) — `jest.mock` the producer (see auth/user/tweet test files).**

## Service conventions

Layered: `src/{index.ts, app.ts, config/, routes/, controllers/, services/, repositories/, events|consumers/}`.
- `index.ts` loads the **root `.env`** via `path.resolve(__dirname, "../../../../.env")` (4 up from `src/`); config/consumer files use 5 up. There is **no** per-service `.env`.
- Shared auth: routes import `verifyToken` from `@xcloud/shared` (the 5 old local copies were consolidated). Error handler, logger, pagination, jwt utils also live there.
- API routes are `/v1/<resource>`. The web SPA proxies `/api/v1/<service>/*` → `http://localhost:<port>/v1/<service>/*` (`apps/web/vite.config.ts`).
- `dev` uses `ts-node-dev --transpile-only` (**no type-checking**) — always run `tsc`/`npm run build` to catch type errors before committing.

## Common commands

```bash
npm install                              # root: installs all workspaces
npm run build -w packages/shared         # MUST build shared before services
npm run build --workspaces --if-present  # build everything (services + web + infra)
npm test  --workspaces --if-present      # all Jest suites

# a service (from apps/services/<svc>/)
npm run dev      # ts-node-dev hot reload     npm test    # jest --runInBand

docker compose up -d                     # local infra (+auto topics/keyspace)
./start-dev.sh                           # all 8 services + web SPA in one terminal (logs → logs/<svc>.log)
cd apps/web && npm run dev               # SPA on :5173 (if not using start-dev.sh)

cd api-model && smithy build             # Smithy → OpenAPI (Smithy CLI; deps via smithy-build.json maven block)
cd infrastructure && npx cdk synth --context env=beta   # CDK templates (no deploy)
```

## Notes & gotchas

- **Local stays on Kafka** (host port **9094**, `PLAINTEXT_HOST`); `.env` uses `KAFKA_BROKERS=localhost:9094`. Don't break the local Kafka path when touching messaging — only the prod (SQS/SNS) branch is `NODE_ENV`-gated.
- **`packages/shared` must be built first** — services resolve `@xcloud/shared` via the workspace symlink to its built `dist/`.
- **CDK is pinned to `aws-cdk-lib`/`aws-cdk` 2.150.0** — newer 2.x unbundled `@aws-cdk/cloud-assembly-schema` and breaks module resolution under workspaces. Don't bump without re-verifying `cdk synth`.
- **Beta is HTTP-only** (ALB :80, no ACM); the listener + SG ingress rules are declared in `EcsStack` (not the gateway/db/cache stacks) to avoid cross-stack dependency cycles. `enableSearch:false` on beta skips OpenSearch + search-service (~$136/mo target).
- `SERVICE_PORTS` in `infrastructure/lib/config/constants.ts` must match each service's default `*_PORT` (health-check correctness).
- `packages/sdk-client` is **generated** from the Smithy model (`npm run generate`, needs `brew install smithy-cli`) and **wired into `apps/web`** (tweets/users/feed; see `apps/web/src/api/twitter-client.ts`). Its `src/`+`dist-*` are gitignored — don't hand-edit; re-generate. Codegen is pinned to **0.31.1** and built with `tsc --noCheck` (see `docs/sdk-generation.md` for the why).
- `packages/sdk-server` is the **generated Smithy server SDK** (same pipeline; CJS build, gitignored output). **user-service** serves its 4 modeled operations through generated SSDK handlers (`apps/services/user-service/src/smithy/` — Express adapter + operation impls); tweet/feed controllers use generated `*ServerInput` **types only** (devDependency). The SSDK runtime `@aws-smithy/server-common` is alpha, pinned exactly. For modeled user-service routes, change the model and regenerate — don't hand-write Express handlers around the SSDK.
- **Jest quirks (don't "clean up"):** fanout/feed test scripts use `--forceExit` (their suites open a real Redis connection at import time via Jest automock and never exit otherwise — this used to hang `npm test --workspaces` silently); auth-service's `jest` block transpiles `uuid` (`uuid@14` is ESM-only) via `transformIgnorePatterns` + `allowJs`; infrastructure's `jest` block is scoped to `roots: ["<rootDir>/test"]` so stale compiled copies under `cdk.out/.ts-output/` aren't picked up.
- Course/local-dev project — `.env` secrets (`JWT_SECRET`) are dev-only placeholders.
