#!/usr/bin/env bash
# Post-deploy schema bootstrap for BETA.
#
#   PostgreSQL (RDS): nothing to do here — the services create their tables on
#     startup (ensurePostgresSchema), because RDS is in private subnets and
#     unreachable from a laptop.
#   Amazon Keyspaces (Cassandra): created here from your machine over the public
#     Keyspaces endpoint (TLS + SigV4 with your AWS creds).
#
# Usage: ./scripts/bootstrap-beta.sh <profile>      e.g. ./scripts/bootstrap-beta.sh personal
# Run AFTER ./scripts/deploy-beta.sh. Idempotent.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"   # repo root (scripts/ lives one level down)
cd "$ROOT"

PROFILE="${1:-${AWS_PROFILE:-}}"
if [ -z "$PROFILE" ]; then
  echo "ERROR: no AWS profile given."
  echo "Usage: ./scripts/bootstrap-beta.sh <profile>"
  aws configure list-profiles 2>/dev/null | sed 's/^/  - /'
  exit 1
fi
export AWS_PROFILE="$PROFILE"

command -v aws >/dev/null 2>&1 || { echo "ERROR: AWS CLI not found."; exit 1; }
if ! aws sts get-caller-identity >/dev/null 2>&1; then
  echo "ERROR: credentials for profile '$PROFILE' not configured/expired."
  exit 1
fi

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
REGION="$(aws configure get region || true)"
REGION="${REGION:-${AWS_REGION:-us-east-1}}"
export AWS_REGION="$REGION"
export CASSANDRA_KEYSPACE="${CASSANDRA_KEYSPACE:-xcloud}"

echo "=========================================================="
echo "  BOOTSTRAP  xcloud BETA — Amazon Keyspaces schema"
echo "  Profile : $PROFILE"
echo "  Account : $ACCOUNT"
echo "  Region  : $REGION"
echo "  Keyspace: $CASSANDRA_KEYSPACE"
echo "=========================================================="
read -r -p "Create the Keyspaces schema in THIS account/region? (yes/no) " ANSWER
[ "$ANSWER" = "yes" ] || { echo "Aborted."; exit 1; }

echo ""
echo "==> Creating keyspace + tables (this can take a couple of minutes; Keyspaces DDL is async)..."
npm run bootstrap:keyspaces -w apps/services/tweet-service

echo ""
echo "Done. PostgreSQL tables are created automatically by the services on startup."
echo "If tweet-service was crash-looping before this (no keyspace), it will recover now."
