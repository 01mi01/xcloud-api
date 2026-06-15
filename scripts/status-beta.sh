#!/usr/bin/env bash
# Quick "am I still being charged?" check for the BETA env. READ-ONLY — only
# describe/list calls, changes nothing. Flags the always-on billable resources
# (NAT Gateway, Fargate tasks, RDS, ALB, ElastiCache) that a failed/forgotten
# teardown leaves behind.
#
# Usage: ./scripts/status-beta.sh <profile>   e.g. ./scripts/status-beta.sh personal

set -uo pipefail

PROFILE="${1:-${AWS_PROFILE:-}}"
if [ -z "$PROFILE" ]; then
  echo "ERROR: no AWS profile given."
  echo "Usage: ./scripts/status-beta.sh <profile>"
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
REGION="$(aws configure get region || true)"
REGION="${REGION:-${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}}"

echo ""
echo "=========================================================="
echo "  STATUS  xcloud BETA   (read-only)"
echo "  Profile : $PROFILE"
echo "  Account : $ACCOUNT"
echo "  Region  : $REGION"
echo "=========================================================="

billable=0

# Helper: count rows of text output (0 when empty/None)
count() { local out; out="$(cat)"; [ -z "$out" ] || [ "$out" = "None" ] && echo 0 || echo "$out" | wc -l | tr -d ' '; }

# --- CloudFormation stacks (the primary signal) ----------------------------
echo ""
echo "-- CloudFormation stacks (xcloud-beta-*) --"
STACKS="$(aws cloudformation list-stacks --region "$REGION" \
  --query "StackSummaries[?starts_with(StackName, 'xcloud-beta') && StackStatus != 'DELETE_COMPLETE'].[StackName,StackStatus]" \
  --output text 2>/dev/null)"
if [ -z "$STACKS" ]; then
  echo "   (none) — nothing deployed."
else
  echo "$STACKS" | sed 's/^/   /'
  billable=1
fi

# --- NAT Gateways (the classic forgotten cost, ~\$0.045/hr each) ------------
NAT="$(aws ec2 describe-nat-gateways --region "$REGION" \
  --filter Name=state,Values=available \
  --query "NatGateways[].NatGatewayId" --output text 2>/dev/null | count)"
echo ""
echo "-- NAT Gateways (available): $NAT"
[ "$NAT" -gt 0 ] && { echo "   ⚠️  ~\$0.045/hr EACH — biggest always-on cost."; billable=1; }

# --- ECS Fargate running tasks --------------------------------------------
TASKS=0
for CL in $(aws ecs list-clusters --region "$REGION" --query "clusterArns[]" --output text 2>/dev/null); do
  case "$CL" in *xcloud*)
    N="$(aws ecs list-tasks --region "$REGION" --cluster "$CL" --desired-status RUNNING --query "taskArns" --output text 2>/dev/null | count)"
    TASKS=$((TASKS + N)) ;;
  esac
done
echo ""
echo "-- ECS Fargate running tasks (xcloud cluster): $TASKS"
[ "$TASKS" -gt 0 ] && billable=1

# --- RDS instances ---------------------------------------------------------
RDS="$(aws rds describe-db-instances --region "$REGION" \
  --query "DBInstances[].DBInstanceIdentifier" --output text 2>/dev/null | count)"
echo ""
echo "-- RDS instances: $RDS   (t3.micro is free-tier-eligible 12 mo)"
[ "$RDS" -gt 0 ] && billable=1

# --- Application Load Balancers --------------------------------------------
ALB="$(aws elbv2 describe-load-balancers --region "$REGION" \
  --query "LoadBalancers[].LoadBalancerArn" --output text 2>/dev/null | count)"
echo ""
echo "-- Load balancers (ALB): $ALB"
[ "$ALB" -gt 0 ] && billable=1

# --- ElastiCache clusters --------------------------------------------------
EC="$(aws elasticache describe-cache-clusters --region "$REGION" \
  --query "CacheClusters[].CacheClusterId" --output text 2>/dev/null | count)"
echo ""
echo "-- ElastiCache clusters: $EC   (t3.micro is free-tier-eligible 12 mo)"
[ "$EC" -gt 0 ] && billable=1

# --- Verdict ---------------------------------------------------------------
echo ""
echo "=========================================================="
if [ "$billable" -eq 0 ]; then
  echo "  ✅ CLEAN — no beta resources found. Not being charged."
else
  echo "  ⚠️  RESOURCES LIVE — credits are draining."
  echo "     Run ./scripts/destroy-beta.sh $PROFILE to tear down."
fi
echo "=========================================================="
