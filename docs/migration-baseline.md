# Migration Baseline — pre-cloud-migration state

> Regression oracle captured **before** the monorepo/cloud restructure on branch
> `feature/cloud-migration-saml` (at commit `0984b18`). After the migration, local
> behavior MUST still match this. The migration only **moves** service code and adds
> `NODE_ENV`-gated *production* paths (SQS/SNS, Keyspaces, OpenSearch, Cognito) that do
> **not** activate locally — so local behavior is expected to be unchanged.

## How to capture/confirm live (run on a machine with Docker Desktop)

```bash
docker compose up -d           # postgres, cassandra, redis, kafka(+init), elasticsearch
docker compose ps              # wait ~60s until healthy
# one terminal per service (from x-api/<svc>/): npm install && npm run dev
```
Smoke test per `README.md` "Prueba end-to-end" (register → login → follow → tweet →
feed → search → like → notifications).

## Expected services (from audit at baseline)

| Service | Port | HTTP | `/health` | Messaging (local) | Store |
|---|---|---|---|---|---|
| auth-service | 3000 | yes | yes | none | PostgreSQL `auth_users` |
| user-service | 3001 | yes | yes | none | PostgreSQL `users`,`follows` |
| tweet-service | 3002 | yes | yes | Kafka **producer** (`tweet.created`,`tweet.liked`) | Cassandra |
| feed-service | 3003 | yes | yes | none (axios hydration) | Redis + Cassandra |
| fanout-service | — | **no (worker)** | **no** | Kafka **consumer** (`tweet.created`) | Redis + PostgreSQL |
| notification-service | 3004 | yes | yes | Kafka **consumer** (`tweet.liked`,`user.followed`) + WebSocket | PostgreSQL `notifications` |
| search-service | 3005 | yes (public) | yes | Kafka **consumer** (`tweet.created`) | Elasticsearch 8.x |

All services: TypeScript → CommonJS, load the **root `.env`** via `../../../.env`.

## Expected smoke-test outcomes (the things that must still work)

1. `POST /v1/auth/register` + `POST /v1/auth/login` return a JWT; registering also creates the `users` row atomically.
2. `POST /v1/users/:userId/follow` (Bearer) establishes a follow edge.
3. `POST /v1/tweets` (Bearer) creates a tweet AND logs `Published tweet.created` (tweet-service) → `Fan-out tweet ... to N followers` (fanout) → `Indexing tweet ...` (search).
4. `GET /v1/feed` (Bearer) returns the followee's tweet.
5. `GET /v1/search?q=...&type=tweets` returns the indexed tweet.
6. `POST /v1/tweets/:id/like` (Bearer) → notification-service records a notification; `GET /v1/notifications` (Bearer) returns it.
7. Web SPA (`apps/web`, port 5173) proxies `/api/v1/<service>/*` and exercises the above.

## Known state / caveats at baseline
- `auth`, `user`, `tweet` have **no Dockerfile** yet; `feed`,`fanout`,`notification`,`search` do.
- `verifyToken` JWT middleware is **duplicated** across 5 services (to be consolidated into `packages/shared`).
- Auth uses **local JWT + bcrypt** (Cognito SDK present but unused).
- Local toolchain verified here: Node `v24.13.0`, OpenJDK `23` (Smithy needs ≥17). Docker required for the live stack.
