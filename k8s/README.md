# Kubernetes manifests — reference only (not deployed)

> **Status:** superseded by Amazon ECS + Fargate. See [ADR-002](../docs/adr/002-replace-eks-with-ecs-fargate.md).

These manifests are **not actively used**. The project no longer runs on EKS:
container orchestration is handled by the CDK ECS stacks under
[`infrastructure/lib/stacks/ecs-stack.ts`](../infrastructure/lib/stacks/ecs-stack.ts),
where each microservice is an ECS Service backed by a Fargate task.

They are kept in the repository as the migration target if the project later
moves back to Kubernetes (per ADR-002, the `microservice-construct.ts` CDK
construct is intended to expose an interface so ECS vs. EKS can be selected via
a CDK context variable when the scale justifies EKS).

**Do not deploy these directly** — they are documentation, not live infrastructure.
