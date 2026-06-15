#!/usr/bin/env bash
# Deploy the BETA stack to AWS (ECS Fargate + RDS + ElastiCache + SQS/SNS, no OpenSearch).
# Beta is HTTP-only and ~$0.10/hr of non-free-tier cost (NAT Gateway + Fargate) — it draws
# down your AWS credits while running. ALWAYS run ./scripts/destroy-beta.sh when you're done.
#
# Prereqs: AWS CLI configured (`aws configure`), Docker running (CDK builds service images).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"   # repo root (scripts/ lives one level down)
INFRA="$ROOT/infrastructure"

# --- 0. Pick the AWS account (named profile) -------------------------------
# Usage: ./scripts/deploy-beta.sh <profile>   e.g. ./scripts/deploy-beta.sh personal
# You have multiple AWS accounts on this machine, so a profile is REQUIRED —
# this is what stops you deploying to the wrong account.
PROFILE="${1:-${AWS_PROFILE:-}}"
if [ -z "$PROFILE" ]; then
  echo "ERROR: no AWS profile given."
  echo "Usage: ./scripts/deploy-beta.sh <profile>"
  echo "Available profiles:"
  aws configure list-profiles 2>/dev/null | sed 's/^/  - /'
  exit 1
fi
export AWS_PROFILE="$PROFILE"

# --- 1. Sanity checks ------------------------------------------------------
command -v aws >/dev/null 2>&1 || { echo "ERROR: AWS CLI not found. Install it and run 'aws configure'."; exit 1; }

if ! aws sts get-caller-identity >/dev/null 2>&1; then
  echo "ERROR: credentials for profile '$PROFILE' not configured or expired. Run 'aws configure --profile $PROFILE'."
  exit 1
fi

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
USER_ARN="$(aws sts get-caller-identity --query Arn --output text)"
REGION="$(aws configure get region || true)"
REGION="${REGION:-${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}}"
export CDK_DEFAULT_ACCOUNT="$ACCOUNT"
export CDK_DEFAULT_REGION="$REGION"

# --- 2. Confirm the target (you have multiple AWS accounts) -----------------
echo ""
echo "=========================================================="
echo "  DEPLOY  xcloud BETA"
echo "  Profile : $PROFILE"
echo "  Account : $ACCOUNT"
echo "  Identity: $USER_ARN"
echo "  Region  : $REGION"
echo "=========================================================="
echo "  This creates billable resources (NAT Gateway, Fargate,"
echo "  ALB, RDS, ElastiCache). ~\$11–15 of credits over 3 days."
echo "  Run ./scripts/destroy-beta.sh as soon as you're done."
echo "=========================================================="
read -r -p "Deploy to THIS account/region? (yes/no) " ANSWER
[ "$ANSWER" = "yes" ] || { echo "Aborted."; exit 1; }

# --- 3. Build + push service images to ECR ---------------------------------
# The ECS tasks pull pre-built images from ECR; build/push them first (linux/amd64).
echo ""
echo "==> Building and pushing service images to ECR..."
IMAGES_CONFIRMED=1 "$ROOT/scripts/build-push-images.sh" "$PROFILE"

cd "$INFRA"

# --- 4. Bootstrap CDK (once per account+region) ----------------------------
if ! aws cloudformation describe-stacks --stack-name CDKToolkit --region "$REGION" >/dev/null 2>&1; then
  echo ""
  echo "==> CDK not bootstrapped in $ACCOUNT/$REGION yet. Bootstrapping..."
  npx cdk bootstrap "aws://$ACCOUNT/$REGION"
fi

# --- 5. Deploy -------------------------------------------------------------
echo ""
echo "==> Deploying all beta stacks..."
npx cdk deploy --all --context env=beta --require-approval never

echo ""
echo "Done. Beta is live. The ALB DNS name is in the stack outputs above."
echo "REMEMBER: ./scripts/destroy-beta.sh when finished to stop the credit drain."
