# scripts/

Shell scripts for local development and the AWS **beta** environment lifecycle.

All paths are resolved relative to the **repo root** (each script does
`ROOT="$(cd "$(dirname "$0")/.." && pwd)"`), so you can run them from anywhere:

```bash
./scripts/deploy-beta.sh personal      # from the repo root
/abs/path/xcloud-api/scripts/deploy-web.sh personal   # or by absolute path
```

**Conventions**
- Every AWS script takes the **AWS profile as the first argument** (required) —
  this is the guardrail that stops you deploying to the wrong account. The
  account/region are derived from that profile (`aws sts get-caller-identity`,
  `aws configure get region`), defaulting to `us-east-1` if unset.
- The deploy/destroy/bootstrap scripts **ask for confirmation** before touching
  billable resources.
- Beta draws down AWS credits while it's up — **always `destroy-beta.sh` when
  done**.

Full architecture, every AWS gotcha, and the end-to-end flow live in
[`../docs/runbooks/aws-deploy.md`](../docs/runbooks/aws-deploy.md).

---

## Local development

### `start-dev.sh`
Starts all 8 microservices **and** the web SPA in one terminal (background
processes; logs → `logs/<service>.log`). `Ctrl+C` stops everything.

```bash
docker compose up -d        # local infra first (Postgres, Cassandra, Redis, Kafka, ES)
./scripts/start-dev.sh      # then the services + SPA (SPA on :5173)
tail -f logs/tweet-service.log
```

No AWS profile, no arguments. Uses local Kafka (`NODE_ENV` unset → dev transport).

---

## AWS beta lifecycle

Typical order on a fresh account: **deploy → bootstrap → deploy-web**, then
**status** to watch cost, **destroy** when finished.

```bash
./scripts/deploy-beta.sh   personal   # 1. infra + images (calls build-push-images.sh)
./scripts/bootstrap-beta.sh personal  # 2. Amazon Keyspaces schema (Postgres self-creates)
./scripts/deploy-web.sh    personal   # 3. build SPA → S3 → CloudFront invalidation
./scripts/status-beta.sh   personal   # read-only: what's running / am I being billed?
./scripts/destroy-beta.sh  personal   # tear everything down
```

### `deploy-beta.sh <profile>`
The full stand-up. Derives account/region from the profile, confirms the target,
**builds + pushes all service images** (calls `build-push-images.sh`), bootstraps
CDK if needed, then `cdk deploy --all --context env=beta`. Prints the ALB DNS in
the outputs. Re-run after infra changes.

### `build-push-images.sh <profile>`
Builds each service's Docker image (`linux/arm64` for Graviton Fargate) and
pushes it to its ECR repo as `:latest`. The ECS tasks pull these, so it must run
before/with an `ecs` deploy.
- `SERVICES="tweet-service feed-service"` — build only a subset (space-separated).
  Omit to build all 8.
- `IMAGES_CONFIRMED=1` — skip the interactive "build all?" prompt (used by
  `deploy-beta.sh`).

Rebuilding one service after a fix, then forcing ECS to pull it:
```bash
IMAGES_CONFIRMED=1 SERVICES="tweet-service" ./scripts/build-push-images.sh personal
SVC=$(aws ecs list-services --cluster xcloud-beta --profile personal --region us-east-2 \
  --query "serviceArns[?contains(@,'TweetService')]" --output text | awk -F/ '{print $NF}')
aws ecs update-service --cluster xcloud-beta --service "$SVC" \
  --force-new-deployment --profile personal --region us-east-2 --no-cli-pager
```

### `bootstrap-beta.sh <profile>`
Creates the **Amazon Keyspaces** schema from your machine (public endpoint, TLS +
SigV4) by running `bootstrap-keyspaces.ts` in tweet-service. Run **after**
`deploy-beta.sh` — tweet-service crash-loops until the keyspace exists, then
recovers. PostgreSQL needs nothing here (services create their tables on startup,
since RDS is in private subnets). Idempotent.

### `deploy-web.sh <profile> [env]`
Publishes the SPA: `npm run build -w apps/web` → `aws s3 sync` to the `cdn`
stack's bucket → CloudFront invalidation. Reads `WebBucketName` /
`DistributionId` / `DistributionDomain` from the `xcloud-<env>-cdn` stack
outputs (env defaults to `beta`). This is the whole loop for UI changes — no
`cdk` needed once the `cdn` stack exists.
- `SKIP_BUILD=1` — sync the existing `apps/web/dist` without rebuilding.

### `status-beta.sh <profile>`
**Read-only.** Lists the beta stacks and counts the always-on billable resources
(NAT Gateway, Fargate tasks, RDS, ALB, ElastiCache); prints `✅ CLEAN` or
`⚠️ RESOURCES LIVE`. Use it after `destroy-beta.sh` to confirm everything's gone.
Changes nothing.

### `destroy-beta.sh <profile>`
`cdk destroy --all` for the beta env (cdn + every stack). Beta has
`deletionProtection=false`, so it deletes cleanly. Run it the moment your demo is
done so credits stop draining. (Amazon Keyspaces tables and ECR images survive by
design — that's expected.)
