#!/usr/bin/env bash
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
