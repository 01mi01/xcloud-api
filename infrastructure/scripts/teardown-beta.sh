#!/usr/bin/env bash
# Destroy all BETA resources. Fargate + NAT cost ~$3.5/day running 24/7, so tear
# down whenever you're not actively demoing.
set -euo pipefail

echo "⚠️  This will DESTROY all xcloud-beta-* resources. Continue? (yes/no)"
read -r confirm
if [ "${confirm}" = "yes" ]; then
  npx cdk destroy "xcloud-beta-*" --force --context env=beta
else
  echo "Aborted."
fi
