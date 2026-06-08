# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**X(dot)com** — a Twitter/X clone built as a microservices system for the *Arquitectura en la Nube y Microservicios* course (Maestría Full Stack Development, UCB 2026). Async communication via Kafka, caching in Redis, full-text search in Elasticsearch. Each Docker container maps to an AWS-managed equivalent (RDS, Keyspaces, ElastiCache, MSK, OpenSearch).

The user-facing README (`README.md`) is the authoritative, detailed setup/usage doc — keep it in sync when changing ports, endpoints, env vars, or topics.

## Repository layout

Monorepo with **no root `package.json`** — each service and app is installed/run independently.

```
xcloud-api/
├── docker-compose.yml          # PostgreSQL, Cassandra, Redis, Kafka (KRaft), Elasticsearch + init containers
├── .env.example                # copy to .env (root); all services read the ROOT .env
├── db/
│   ├── init.sql                # PostgreSQL schema
│   └── cassandra-init.cql      # Cassandra schema
├── apps/web/                   # React 19 + Vite SPA (TypeScript)
├── packages/                   # Smithy-generated SDKs (sdk-client, sdk-server) — generated code, do not hand-edit
└── x-api/
    ├── model/                  # Smithy API definitions (source of truth for the API contract)
    ├── build.gradle, gradlew   # Smithy build → OpenAPI / SDKs (needs Java 17+)
    ├── auth-service/           # 3000
    ├── user-service/           # 3001
    ├── tweet-service/          # 3002
    ├── feed-service/           # 3003
    ├── fanout-service/         # Kafka consumer, no HTTP port
    ├── notification-service/   # 3004
    └── search-service/         # 3005
```

## Services & data stores

| Service | Port (env var) | Store | Notes |
|---|---|---|---|
| auth | 3000 (`AUTH_PORT`) | PostgreSQL `auth_users` | JWT + bcrypt; Cognito config present (`config/cognito.config.ts`). Register also creates the `users` row atomically. |
| user | 3001 (`USER_PORT`) | PostgreSQL `users`, `follows` | profiles, follow/unfollow |
| tweet | 3002 (`TWEET_PORT`) | Cassandra `tweets`, `likes` | publishes `tweet.created`, `tweet.liked` |
| feed | 3003 (`FEED_PORT`) | Redis cache + Cassandra fallback | hydrates tweets from tweet-service |
| fanout | — (no HTTP) | Redis write + PostgreSQL read | consumes `tweet.created`, fans out to follower feeds |
| notification | 3004 (`NOTIFICATION_PORT`) | PostgreSQL `notifications` | consumes `tweet.liked`, `user.followed` |
| search | 3005 (`SEARCH_PORT`) | Elasticsearch `tweets` index | consumes `tweet.created` |

Kafka topics: `tweet.created`, `tweet.liked`, `user.followed` (auto-created by the `kafka-init` container).

## Service conventions

Every `x-api/*` service is TypeScript on Express 5 with the same layered structure:

```
src/
├── index.ts          # loads root .env via path.resolve(__dirname, "../../../.env"), starts server
├── app.ts            # Express app wiring
├── config/           # db / redis / cassandra / cognito clients
├── routes/           # *.routes.ts
├── controllers/      # *.controller.ts
├── services/         # *.service.ts (business logic)
├── repositories/     # data access
├── middleware/       # auth / validate-jwt
└── events/           # Kafka producers/consumers (where applicable)
```

- Env is loaded from the **root `.env`** (`../../../.env`), not per-service. There is no `x-api/.env` despite the README mentioning `cp .env x-api/.env` — that copy is not required for services to run.
- API routes are versioned under `/v1/<resource>`. The web SPA proxies `/api/v1/<service>/*` → `http://localhost:<port>/v1/<service>/*` via `apps/web/vite.config.ts`.
- Tests: Jest + ts-jest, files in each service's `test/` dir as `*.test.ts`, run with `jest --runInBand`.

## Common commands

Per service (run from `x-api/<service>/`):

```bash
npm install
npm run dev      # ts-node-dev, hot reload
npm run build    # tsc → dist/
npm start        # node dist/index.js
npm test         # jest --runInBand
```

Infrastructure & web:

```bash
docker compose up -d          # bring up all data stores + auto-create topics/keyspaces
docker compose ps             # check health (wait ~60s)
cd apps/web && npm run dev    # SPA on http://localhost:5173
cd apps/web && npm run lint   # eslint
```

Smithy API model (needs Java 17+):

```bash
cd x-api && ./gradlew build
```

## Notes & gotchas

- **Kafka host port is 9094** (`PLAINTEXT_HOST`). `.env` / `.env.example` correctly use `KAFKA_BROKERS=localhost:9094`. The `docker exec ... --bootstrap-server localhost:9092` commands in the README run *inside* the container, where 9092 is correct.
- Each service must be started in its own terminal; there is no orchestrator script that boots all of them.
- A local PostgreSQL on 5432 conflicts with the Docker container — stop it first.
- `packages/sdk-client` and `packages/sdk-server` are Smithy-generated; regenerate via the Gradle build rather than editing by hand.
- This is a course/local-dev project — secrets in `.env` (e.g. `JWT_SECRET`) are dev-only placeholders.
