#!/usr/bin/env bash
<<<<<<< HEAD
# Build the web SPA and publish it to the CloudFront-backed S3 bucket created by
# the cdn stack (xcloud-<env>-cdn). Reads the bucket name + distribution id from
# the stack outputs, so there's nothing to paste.
#
#   1. npm run build -w apps/web      (skip with SKIP_BUILD=1)
#   2. aws s3 sync apps/web/dist → s3://<WebBucketName> --delete
#   3. aws cloudfront create-invalidation --paths "/*"
#
# Usage: ./scripts/deploy-web.sh <profile> [env]     e.g. ./scripts/deploy-web.sh personal beta
#
# NOTE: this does NOT deploy infrastructure — run `cdk deploy xcloud-<env>-cdn`
# first if the cdn stack doesn't exist yet. After that, this script is the whole
# loop for UI changes (no cdk needed).

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"   # repo root (scripts/ lives one level down)
cd "$ROOT"

PROFILE="${1:-${AWS_PROFILE:-}}"
ENV="${2:-beta}"
if [ -z "$PROFILE" ]; then
  echo "ERROR: no AWS profile given."
  echo "Usage: ./scripts/deploy-web.sh <profile> [env]"
  aws configure list-profiles 2>/dev/null | sed 's/^/  - /'
  exit 1
fi
export AWS_PROFILE="$PROFILE"
export AWS_PAGER=""   # never drop into the less pager

command -v aws >/dev/null 2>&1 || { echo "ERROR: AWS CLI not found."; exit 1; }

REGION="$(aws configure get region || true)"; REGION="${REGION:-${AWS_REGION:-us-east-1}}"
STACK="xcloud-${ENV}-cdn"

echo "=========================================================="
echo "  PUBLISH web SPA → $STACK"
echo "  Profile : $PROFILE"
echo "  Region  : $REGION"
echo "=========================================================="

# Pull the outputs the cdn stack exports.
get_output() {
  aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}
BUCKET="$(get_output WebBucketName)"
DIST_ID="$(get_output DistributionId)"
DOMAIN="$(get_output DistributionDomain)"

if [ -z "$BUCKET" ] || [ "$BUCKET" = "None" ]; then
  echo "ERROR: could not read WebBucketName from stack '$STACK'."
  echo "Deploy the cdn stack first: cd infrastructure && npx cdk deploy $STACK --context env=$ENV"
  exit 1
fi
echo "  Bucket  : $BUCKET"
echo "  Dist    : $DIST_ID"
echo ""

# 1. build (unless told to skip)
if [ "${SKIP_BUILD:-}" = "1" ]; then
  echo "==> SKIP_BUILD=1 — using existing apps/web/dist"
else
  echo "==> Building web SPA..."
  npm run build -w apps/web
fi
[ -f apps/web/dist/index.html ] || { echo "ERROR: apps/web/dist/index.html missing — build failed?"; exit 1; }

# 2. sync to S3 (--delete prunes files no longer in the build)
echo "==> Syncing apps/web/dist → s3://$BUCKET ..."
aws s3 sync apps/web/dist "s3://$BUCKET" --delete --region "$REGION"

# 3. invalidate CloudFront so viewers get the new files immediately
echo "==> Invalidating CloudFront ($DIST_ID)..."
INVALIDATION_ID="$(aws cloudfront create-invalidation --distribution-id "$DIST_ID" \
  --paths "/*" --region "$REGION" --query "Invalidation.Id" --output text)"

echo ""
echo "Done. Invalidation $INVALIDATION_ID created."
echo "Open: $DOMAIN"
=======
# Deploy the React SPA to S3 and invalidate CloudFront.
# Usage: ./scripts/deploy-web.sh <env>
#   env: beta | gamma | prod  (default: beta)
#
# Prerequisites:
#   - AWS CLI configured (aws configure)
#   - CDK already deployed (cdk deploy --all --context env=<env>)

set -euo pipefail

ENV="${1:-beta}"
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REGION="${AWS_DEFAULT_REGION:-us-east-1}"

WEB_BUCKET="xcloud-web-${ENV}-${ACCOUNT}"
DIST_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?contains(Origins.Items[].DomainName, '${WEB_BUCKET}')].Id" \
  --output text)

echo "=== Building React app ==="
cd apps/web
VITE_API_BASE_URL="/api" npm run build
cd ../..

echo "=== Syncing dist/ to s3://${WEB_BUCKET} ==="
# Long-lived cache for hashed assets (JS/CSS bundles have content hash in filename)
aws s3 sync apps/web/dist/ "s3://${WEB_BUCKET}" \
  --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "index.html"

# index.html must never be cached — always fetch fresh
aws s3 cp apps/web/dist/index.html "s3://${WEB_BUCKET}/index.html" \
  --cache-control "no-cache,no-store,must-revalidate" \
  --content-type "text/html"

echo "=== Invalidating CloudFront (distribution: ${DIST_ID}) ==="
aws cloudfront create-invalidation \
  --distribution-id "${DIST_ID}" \
  --paths "/*"

echo ""
echo "Done. App available at:"
aws cloudfront list-distributions \
  --query "DistributionList.Items[?Id=='${DIST_ID}'].DomainName" \
  --output text | awk '{print "https://" $1}'
>>>>>>> origin/main
