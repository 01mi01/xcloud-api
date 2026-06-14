# Runbook — Deploy & bootstrap BETA on AWS

End-to-end flow to stand up the **beta** environment, make the data layer
functional, test, and tear it down. Targets the `personal` AWS profile.

> ✅ **Deployed and working end-to-end** (us-east-2, account `personal`): auth,
> tweets (create/get/like/retweet/reply), profiles, follows, feed, media, and the
> React SPA on CloudFront. Getting there surfaced several **Amazon Keyspaces
> incompatibilities** that the local self-managed Cassandra never shows — all
> fixed and documented under "Keyspaces gotchas" below. The **local** stack
> (`docker compose up -d` + `./start-dev.sh`) is still the fastest venue for
> feature work; redeploy to verify cloud-specific behaviour.

## What beta includes / excludes
- **Includes:** auth, user, tweet, feed, fanout, notification, media (8 services
  minus search), ALB (HTTP :80), RDS PostgreSQL, ElastiCache Redis, Amazon
  Keyspaces, SQS/SNS, S3, and the **SPA on CloudFront + S3** (the `cdn` stack).
- **Excludes:** OpenSearch + **search-service** (`enableSearch:false` to save
  ~$25/mo) — so **user/tweet search won't work in beta**. To enable it: flip
  `enableSearch:true` in `infrastructure/lib/config/environments.ts` and redeploy
  the `search` + `ecs` stacks (the code is all there). Note search only indexes
  events that arrive *after* it's live — no backfill of existing data.

## Prerequisites
- AWS CLI configured with the `personal` profile (`aws configure --profile personal`).
- Docker running (CDK builds the service container images locally).
- The profile's account has permissions for ECS/RDS/Keyspaces/etc. (admin is fine).

## 1. Deploy the infrastructure
```bash
./deploy-beta.sh personal
```
Bootstraps CDK if needed, **builds + pushes the service images to ECR**
(`build-push-images.sh`, linux/arm64 for Graviton), then
`cdk deploy --all --context env=beta`. Prints the ALB DNS name in the outputs.

**Rebuilding one service after a fix** (don't rebuild all 7):
```bash
IMAGES_CONFIRMED=1 SERVICES="tweet-service" ./build-push-images.sh personal
# then force ECS to pull the new :latest image
SVC=$(aws ecs list-services --cluster xcloud-beta --profile personal --region us-east-2 \
  --query "serviceArns[?contains(@,'TweetService')]" --output text | awk -F/ '{print $NF}')
aws ecs update-service --cluster xcloud-beta --service "$SVC" \
  --force-new-deployment --profile personal --region us-east-2 --no-cli-pager
```
`SERVICES` accepts a space-separated subset; omit it to build all seven.

## 2. Bootstrap the data schema
- **PostgreSQL (RDS):** nothing to do — the PG services create their tables on
  startup (`ensurePostgresSchema` in `@xcloud/shared`), because RDS is in private
  subnets and unreachable from a laptop.
- **Amazon Keyspaces (Cassandra):** create from your machine (public endpoint,
  TLS + SigV4):
  ```bash
  ./bootstrap-beta.sh personal
  ```
  This runs `apps/services/tweet-service/scripts/bootstrap-keyspaces.ts`, creating
  the `xcloud` keyspace + tables and polling until they're `ACTIVE` (Keyspaces DDL
  is async — give it a couple of minutes).

> tweet-service sets `keyspace: xcloud` at client construction, so until the
> keyspace exists it will **crash-loop** (ECS restarts it). It recovers once the
> bootstrap completes — run the bootstrap right after deploy.

## 3. Deploy the web SPA (CloudFront)
The `cdn` stack creates a private S3 bucket + CloudFront distribution. CloudFront
serves the SPA at `/` (from S3) and routes `/api/*` to the **ALB** as a second
origin (a CloudFront Function strips the `/api` prefix). This keeps the SPA's API
calls same-origin — no CORS, and no mixed-content despite the ALB being HTTP-only
while CloudFront is HTTPS.

The SPA files are uploaded **via the CLI**, not CDK's `BucketDeployment` (its
custom-resource Lambda bundles an awscli whose Python-union syntax crashes on
CDK 2.150's runtime under this pinned/workspace setup). One command does it all:
```bash
./deploy-web.sh personal      # build apps/web → s3 sync → CloudFront invalidation
```
It reads `WebBucketName` / `DistributionId` / `DistributionDomain` from the `cdn`
stack outputs. Open the printed `https://<id>.cloudfront.net`. First-time
distribution rollout takes ~5–15 min (`aws cloudfront get-distribution --id <id>
--query Distribution.Status` → `Deployed`). For later UI changes just re-run
`./deploy-web.sh personal` (no `cdk` needed).

> Build the SPA with the **default** API base (`/api`) — i.e. plain
> `npm run build -w apps/web`, which `deploy-web.sh` does. `VITE_API_TARGET` is
> only for the **dev** proxy (running the SPA locally against the ALB); it has no
> effect on a production build.

## 4. Test
Hit the ALB DNS directly (HTTP :80) or the CloudFront URL. Smoke test: register →
login → post a tweet → like/retweet/reply → feed. (Search will 404/not exist in
beta.) Feed is empty until accounts follow each other — fanout pushes a tweet into
the timelines of the author's **followers** (you won't see your own posts in your
*home* feed; they show on your *profile* — that's real X behaviour).

## 5. Watch cost / tear down
```bash
./status-beta.sh personal     # read-only: what's running, am I being charged?
./destroy-beta.sh personal    # delete everything (cdn + all stacks)
./status-beta.sh personal     # confirm CLEAN
```
Beta runs ~$0.15–0.20/hr of non-free-tier resources (NAT + Fargate + ALB) — from
credits, ~$0 out of pocket. **Destroy when done** so it stops draining credits.

## Amazon Keyspaces gotchas (found & fixed during the first deploy)
Local self-managed Cassandra accepts these; **Keyspaces rejects them**, each with
HTTP-opaque error code 8704. All fixed in `tweet-service` (and `feed-service`'s
own Cassandra client), gated to `NODE_ENV==='production'` so local stays as-is:
- **LOGGED batches not supported** → pass `{ logged: false }` to every
  `client.batch(...)` (our batches span two tables/partitions, so UNLOGGED is
  correct anyway). See `tweet-service/src/repositories/tweet.repository.ts`.
- **`LOCAL_ONE` consistency rejected for writes** (driver default) → set the
  client's default `queryOptions: { consistency: localQuorum }`. Keyspaces only
  allows `LOCAL_QUORUM` writes; reads accept it too.
- **`SELECT COUNT(*)` not supported** (`countRows is not yet supported`) → count
  rows client-side (`result.rowLength`), with a `0` fallback so a display count
  can never 500 a read. (`countReplies`.)
- **Async DDL** → the bootstrap polls `system_schema_mcs.*` until tables are
  `ACTIVE`; `SingleRegionStrategy` (Keyspaces rejects `SimpleStrategy`).
- **TLS:** trusts Node's CA bundle (Amazon Trust Services) but the driver
  connects to resolved IPs, so we skip the IP↔hostname check
  (`sslOptions.checkServerIdentity: () => undefined`) — the CA chain is still
  validated. SigV4 auth via `aws-sigv4-auth-cassandra-plugin` (task IAM role
  in-cluster; your AWS creds for the bootstrap).

## RDS PostgreSQL — SSL required
`rds.force_ssl=1`, so **every** PG client (auth/user/notification/feed/fanout)
sets `ssl: { rejectUnauthorized: false }` in prod (CA not in Node's bundle;
encrypt-but-don't-verify is the course-demo tradeoff). Without it you get
`no pg_hba.conf entry … no encryption`. Schema is created on service startup
(`ensurePostgresSchema`) because RDS is in private subnets.

## SNS/SQS — standard topics reject FIFO params
The producers pass `MessageGroupId`/`MessageDeduplicationId` (for FIFO), but the
CDK topics/queues are **standard**, which reject `MessageDeduplicationId`. The
prod publisher (`@xcloud/shared` `sqs.ts`) now only sends those params when the
target ARN/URL ends with `.fifo`. Without the guard, `tweet.created` never
publishes → fanout never runs → feed stays empty.

## CloudFront / SPA notes
- API routed through CloudFront (`/api/*` → ALB origin) to dodge CORS +
  mixed-content; a CloudFront **Function** strips the `/api` prefix. Only `403`
  is remapped to `index.html` (SPA deep links); `404` is left alone so real API
  404s pass through as JSON.
- Upload is **CLI** (`deploy-web.sh`), not `BucketDeployment` — see step 3.
- **WebSocket** (`/api/v1/notifications/ws`) rides the same `/api/*` behaviour.
  If live notifications drop every ~60s, raise the ALB `idleTimeout` or add a
  client heartbeat (ALB closes idle WS connections at 60s by default).

## Other things to watch
- **RDS ad-hoc SQL:** private subnets — use SSM port-forwarding or a bastion for
  `psql`; the services handle their own schema.
- **search-service (gamma/prod):** OpenSearch client has no SigV4 signing wired —
  needs it before connecting to a real OpenSearch domain.
- **Redis:** ElastiCache has no transit encryption here, so the plain client
  works; enable `tls:{}` in the redis config if you turn encryption on.
- **`@aws-cdk/asset-awscli-v1`:** pinned in `infrastructure` because CDK 2.150
  doesn't hoist it under workspaces (same family as the CDK version pin). Only
  matters if you reintroduce a construct that needs the awscli layer.
