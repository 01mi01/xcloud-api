#!/usr/bin/env bash
# Tear down the BETA stack — stops ALL billable resources (NAT Gateway, Fargate,
# ALB, RDS, ElastiCache). Run this the moment you finish your demo so credits
# stop draining. Beta has deletionProtection=false, so everything deletes cleanly.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
INFRA="$ROOT/infrastructure"

# Usage: ./destroy-beta.sh <profile>   e.g. ./destroy-beta.sh personal
# Profile is REQUIRED so you tear down in the same account you deployed to.
PROFILE="${1:-${AWS_PROFILE:-}}"
if [ -z "$PROFILE" ]; then
  echo "ERROR: no AWS profile given."
  echo "Usage: ./destroy-beta.sh <profile>"
  echo "Available profiles:"
  aws configure list-profiles 2>/dev/null | sed 's/^/  - /'
  exit 1
fi
export AWS_PROFILE="$PROFILE"

command -v aws >/dev/null 2>&1 || { echo "ERROR: AWS CLI not found."; exit 1; }

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

echo ""
echo "=========================================================="
echo "  DESTROY  xcloud BETA"
echo "  Profile : $PROFILE"
echo "  Account : $ACCOUNT"
echo "  Identity: $USER_ARN"
echo "  Region  : $REGION"
echo "=========================================================="
echo "  This DELETES all beta resources in this account/region."
echo "=========================================================="
read -r -p "Destroy beta in THIS account/region? (yes/no) " ANSWER
[ "$ANSWER" = "yes" ] || { echo "Aborted."; exit 1; }

cd "$INFRA"

echo ""
echo "==> Destroying all beta stacks..."
npx cdk destroy --all --context env=beta --force

echo ""
echo "Done. All beta resources deleted. Credit drain stopped."
echo "Tip: confirm nothing lingers in the AWS console (EC2 > NAT Gateways, RDS, ECS)."
