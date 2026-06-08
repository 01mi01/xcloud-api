# ADR-002 — Replace Amazon EKS with Amazon ECS Fargate

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-05-24 |
| **Deciders** | Engineering team |
| **Supersedes** | — |

---

## Context

The original architecture specified **Amazon EKS** as the container orchestration platform for all microservices.

EKS has a fixed cluster fee of **$0.10/hour (~$72/month)** regardless of workload, plus the cost of EC2 worker nodes (minimum 2–3 nodes for HA at ~$60–90/month combined for `t3.medium`). Total minimum: **~$130–160/month** before any application load.

For a demo or early-stage project this fixed base cost is significant and the operational complexity of managing a Kubernetes cluster (node groups, cluster upgrades, IRSA, networking add-ons) is disproportionate to current needs.

---

## Decision

Replace Amazon EKS with **Amazon ECS + Fargate**.

Each microservice becomes an ECS Service backed by a Fargate task definition. There is no cluster node fee — charges are based on vCPU and memory consumed per second while tasks are running.

### Mapping

| EKS concept | ECS Fargate equivalent |
|-------------|----------------------|
| Namespace | ECS Cluster |
| Deployment | ECS Service |
| Pod | Fargate Task |
| HPA | ECS Service Auto Scaling (target tracking) |
| IRSA (IAM for pods) | ECS Task Role |
| Ingress + ALB controller | ALB + ECS target group |
| ConfigMap / Secret | SSM Parameter Store / Secrets Manager |

### Infrastructure changes

The Kubernetes manifests in `k8s/` are superseded. The CDK `infrastructure/` stacks will be updated:

- Remove `eks-stack.ts` → add `ecs-stack.ts`
- Each service gets a `FargateService` construct in `lib/constructs/microservice-construct.ts`
- The ALB is shared across services using path-based routing rules

---

## Consequences

### Positive
- **Cost**: no cluster fee. A single Fargate task (`0.25 vCPU / 0.5GB`) running 24/7 costs ~$9/month. A demo fleet of 8 services (1 task each) = **~$72/month** vs. ~$160/month for EKS — roughly half.
- **No node management**: no worker node AMI updates, no cluster version upgrades.
- **Faster to deploy**: CDK `FargateService` is simpler to configure than EKS node groups + Helm charts.
- **IRSA equivalent**: ECS Task Roles provide per-service IAM scoping with no extra setup.

### Negative / Trade-offs
- **No Kubernetes ecosystem**: Helm charts, kubectl tooling, and service mesh options (Istio, Linkerd) are not available. Observability relies on CloudWatch Container Insights instead.
- **Less portable**: ECS is AWS-specific. Re-platforming to another cloud would require rewriting the orchestration layer.
- **Sidecar patterns**: more limited than Kubernetes — ECS supports sidecars but without the same lifecycle guarantees.
- **No bin-packing**: Fargate does not pack multiple containers onto shared EC2 nodes the way EKS does, so per-task costs are slightly higher at scale.

### Migration path back to EKS
The `k8s/` manifests are preserved in the repository. The `microservice-construct.ts` CDK construct should expose an interface so ECS vs. EKS can be selected via a CDK context variable when the project grows to justify EKS.

---

## Impact on k8s/ directory

The `k8s/` manifests are kept in the repository as reference but are **not actively used**. They serve as the migration target if the project later moves back to Kubernetes. A note should be added to the directory once the ECS CDK stacks are implemented.

---

## Alternatives Considered

| Option | Reason rejected |
|--------|----------------|
| EKS | ~$130–160/month minimum, high operational complexity for early stage |
| Single EC2 with docker-compose | No auto-scaling, manual deployments, not production-grade |
| AWS App Runner | Simpler than ECS but less control over networking and IAM; limited to HTTP services |
