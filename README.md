# xcloud-api

A Twitter/X clone built as a Node.js microservices monorepo, deployed on AWS with ECS Fargate, Cognito, SQS, Redis, and OpenSearch.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite (ESM) |
| API contract | Smithy (model-first) |
| Backend services | Node.js / Express (CJS) |
| Auth | AWS Cognito (OIDC / JWT) |
| Primary DB | PostgreSQL (RDS) |
| Tweet store | Apache Cassandra (Keyspaces) |
| Feed cache | Redis (ElastiCache) |
| Messaging | Amazon SQS |
| Search | OpenSearch |
| Media | S3 + presigned URLs |
| Infrastructure | AWS CDK (TypeScript) |
| Orchestration | Amazon ECS (Fargate) |
| CI/CD | GitHub Actions |

---

## Project Structure

```
xcloud-api/
├── package.json                  # npm workspaces root
├── tsconfig.base.json            # shared TypeScript base config
├── .env.example                  # environment variable template
│
├── apps/
│   ├── web/                      # React + Vite frontend (ESM)
│   └── services/
│       ├── auth-service/         # Cognito OIDC — register, login, JWT
│       ├── user-service/         # Profiles, follow graph (PostgreSQL)
│       ├── tweet-service/        # Tweet CRUD + SQS producer (Keyspaces)
│       ├── feed-service/         # Timeline — Redis cache + Keyspaces fallback
│       ├── fanout-service/       # SQS consumer — writes tweets to follower caches
│       ├── media-service/        # S3 presigned URL generation
│       ├── notification-service/ # WebSocket notifications via SQS
│       └── search-service/       # Full-text search via OpenSearch + SQS indexer
│
├── packages/
│   ├── shared/                   # Shared middleware, errors, utils (dual ESM/CJS)
│   ├── sdk-client/               # Smithy-generated typed HTTP client (ESM, for web)
│   └── sdk-server/               # Smithy-generated server contracts (CJS, for services)
│
├── api-model/                    # Smithy model source of truth
│   ├── smithy-build.json
│   └── model/                    # *.smithy files
│
├── infrastructure/               # AWS CDK stacks (TypeScript)
│   └── lib/stacks/               # networking, ECS, auth, database, cache, …
│
├── k8s/                          # Kubernetes manifests (reference only — superseded by ECS Fargate; see ADR-002)
│   ├── base/                     # namespace, service account
│   └── services/                 # deployment, service, HPA per microservice
│
├── docs/                         # Architecture diagrams and runbooks
└── .github/workflows/            # CI/CD pipelines
```

---

## Prerequisites

- [Node.js v20+](https://nodejs.org/)
- [AWS CLI](https://aws.amazon.com/cli/) — configured with a profile that has the necessary permissions
- [Java 17+](https://aws.amazon.com/corretto/) — required only to regenerate the Smithy SDK

---

## Local Setup

### 1. Clone and install

```bash
git clone https://github.com/01mi01/xcloud-api.git
cd xcloud-api
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
# Edit .env and fill in your Cognito pool, DB credentials, etc.
```

### 3. Start a service

Each service runs independently. Example for auth-service:

```bash
cd apps/services/auth-service
npm run dev
```

---

## Services

### auth-service — Port 3001

Handles registration, login, and JWT verification via AWS Cognito.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/v1/auth/register` | No | Register a new user |
| POST | `/v1/auth/login` | No | Login — returns JWT |
| GET | `/v1/auth/me` | Bearer | Get current user from token |

**Roles** (managed via Cognito User Pool Groups):

| Role | Description |
|------|-------------|
| `user` | Default on registration |
| `admin` | Administrative access |

#### Quick smoke tests

```powershell
# Register
Invoke-WebRequest -Uri "http://localhost:3001/v1/auth/register" `
  -Method POST -ContentType "application/json" `
  -Body '{"handle":"testuser1","email":"test1@test.com","password":"Test1234!"}' `
  -UseBasicParsing

# Login — save token
$response = Invoke-WebRequest -Uri "http://localhost:3001/v1/auth/login" `
  -Method POST -ContentType "application/json" `
  -Body '{"email":"test1@test.com","password":"Test1234!"}' -UseBasicParsing
$token = ($response.Content | ConvertFrom-Json).token

# Protected endpoint
Invoke-WebRequest -Uri "http://localhost:3001/v1/auth/me" `
  -Method GET -Headers @{Authorization="Bearer $token"} -UseBasicParsing
```

---

## SDK Generation

The API contract is defined in `api-model/model/*.smithy`. The client and server SDKs are auto-generated — never edit `packages/*/src/generated/` by hand.

```bash
# Regenerate both client and server SDKs
npm run generate
```

The `smithy-generate.yml` GitHub Actions workflow runs this automatically whenever Smithy model files are changed.

---

## CI/CD

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `ci.yml` | PR / push to `main` | Lint + test all services |
| `smithy-generate.yml` | Changes to `api-model/` | Rebuilds SDK and commits generated code |
| `deploy-beta.yml` | Manual | CDK deploy to beta environment |
| `deploy-gamma.yml` | Manual | CDK deploy to gamma environment |
| `deploy-prod.yml` | Manual | CDK deploy to production environment |

> AWS deployments require the `AWS_DEPLOY_ROLE_ARN` secret to be set in the repository settings.

---

## AWS Costs

Running the full infrastructure stack (ECS Fargate, RDS, ElastiCache, SQS, OpenSearch, Cognito) incurs real AWS costs. ECS Fargate has no cluster fee (pay per vCPU/GB-second) and SQS includes 1M requests/month free — both were chosen to reduce cost (see ADR-001 and ADR-002). The Cognito free tier covers 50,000 MAU. All other services are pay-as-you-go. Review the CDK stacks in `infrastructure/lib/stacks/` before deploying.
