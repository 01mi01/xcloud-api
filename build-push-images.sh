#!/usr/bin/env bash
# Build the service Docker images and push them to ECR (one repo per service).
# The ECS task definitions pull <account>.dkr.ecr.<region>.amazonaws.com/<svc>:latest,
# so this MUST run before (or be re-run before) deploying the ecs stack.
#
# Images are built for linux/arm64 — Fargate runs these on Graviton (the task
# defs set runtimePlatform ARM64), so builds are native + fast on Apple Silicon.
#
# Usage: ./build-push-images.sh <profile>     e.g. ./build-push-images.sh personal

set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

PROFILE="${1:-${AWS_PROFILE:-}}"
if [ -z "$PROFILE" ]; then
  echo "ERROR: no AWS profile given."
  echo "Usage: ./build-push-images.sh <profile>"
  aws configure list-profiles 2>/dev/null | sed 's/^/  - /'
  exit 1
fi
export AWS_PROFILE="$PROFILE"

command -v aws >/dev/null 2>&1    || { echo "ERROR: AWS CLI not found."; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "ERROR: Docker not found / not running."; exit 1; }
docker info >/dev/null 2>&1       || { echo "ERROR: Docker daemon not running."; exit 1; }

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
REGION="$(aws configure get region || true)"; REGION="${REGION:-${AWS_REGION:-us-east-1}}"
ECR="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com"

# Beta services (search-service excluded — enableSearch:false on beta).
# Override a subset with the SERVICES env var, e.g. SERVICES="tweet-service feed-service".
if [ -n "${SERVICES:-}" ]; then
  read -r -a SERVICES <<< "$SERVICES"
else
  SERVICES=(auth-service user-service tweet-service feed-service notification-service media-service fanout-service)
fi

echo "=========================================================="
echo "  BUILD + PUSH images → ECR"
echo "  Account : $ACCOUNT"
echo "  Region  : $REGION"
echo "  Services: ${SERVICES[*]}"
echo "=========================================================="
# deploy-beta.sh sets IMAGES_CONFIRMED=1 (it already confirmed the account).
if [ "${IMAGES_CONFIRMED:-}" != "1" ]; then
  read -r -p "Build & push to THIS account/region? (yes/no) " ANSWER
  [ "$ANSWER" = "yes" ] || { echo "Aborted."; exit 1; }
fi

echo "==> Logging in to ECR..."
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ECR"

for svc in "${SERVICES[@]}"; do
  echo ""
  echo "==> $svc"
  aws ecr describe-repositories --repository-names "$svc" --region "$REGION" >/dev/null 2>&1 \
    || aws ecr create-repository --repository-name "$svc" --region "$REGION" >/dev/null
  docker build --platform linux/arm64 -f "apps/services/$svc/Dockerfile" -t "$ECR/$svc:latest" .
  docker push "$ECR/$svc:latest"
done

echo ""
echo "Done. All images pushed as :latest. You can now (re)deploy the ecs stack."
