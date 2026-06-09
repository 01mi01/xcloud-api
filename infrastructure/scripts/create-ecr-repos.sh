#!/usr/bin/env bash
# Create one ECR repository per service. MicroserviceConstruct references images
# via ecr.Repository.fromRepositoryName(), so the repos must exist before deploy.
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"

for svc in auth user tweet feed fanout media notification search; do
  repo="${svc}-service"
  echo "Ensuring ECR repo: ${repo}"
  aws ecr create-repository \
    --repository-name "${repo}" \
    --region "${REGION}" \
    --image-scanning-configuration scanOnPush=true \
    >/dev/null 2>&1 || echo "  (already exists)"
done

echo "Done. Repos in region ${REGION}."
