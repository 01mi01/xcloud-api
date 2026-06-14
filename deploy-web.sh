#!/usr/bin/env bash
# Build the web SPA and publish it to the CloudFront-backed S3 bucket created by
# the cdn stack (xcloud-<env>-cdn). Reads the bucket name + distribution id from
# the stack outputs, so there's nothing to paste.
#
#   1. npm run build -w apps/web      (skip with SKIP_BUILD=1)
#   2. aws s3 sync apps/web/dist → s3://<WebBucketName> --delete
#   3. aws cloudfront create-invalidation --paths "/*"
#
# Usage: ./deploy-web.sh <profile> [env]     e.g. ./deploy-web.sh personal beta
#
# NOTE: this does NOT deploy infrastructure — run `cdk deploy xcloud-<env>-cdn`
# first if the cdn stack doesn't exist yet. After that, this script is the whole
# loop for UI changes (no cdk needed).

set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

PROFILE="${1:-${AWS_PROFILE:-}}"
ENV="${2:-beta}"
if [ -z "$PROFILE" ]; then
  echo "ERROR: no AWS profile given."
  echo "Usage: ./deploy-web.sh <profile> [env]"
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
