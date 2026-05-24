import * as cdk from 'aws-cdk-lib';
import * as ec2  from 'aws-cdk-lib/aws-ec2';
import * as ecs  from 'aws-cdk-lib/aws-ecs';
import * as ecr  from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam  from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { FARGATE_DEFAULTS } from '../config/constants';

export interface MicroserviceProps {
  /** ECS Cluster to deploy into. */
  cluster: ecs.Cluster;
  /** Service name, e.g. "auth-service". Also used as the ECR repository name. */
  serviceName: string;
  /** Container port the service listens on. */
  containerPort: number;
  /** ALB listener to attach a routing rule to. */
  listener: elbv2.ApplicationListener;
  /** ALB path prefix for routing, e.g. "/v1/auth*". */
  listenerPathPattern: string;
  /** ALB listener rule priority (must be unique across all services). */
  listenerPriority: number;
  /** Environment variables injected into the container. */
  environment?: Record<string, string>;
  /** Secrets Manager / SSM secrets injected as environment variables. */
  secrets?: Record<string, ecs.Secret>;
  /** Additional IAM policies for the task role. */
  taskPolicies?: iam.PolicyStatement[];
  /** Fargate CPU units (default 256 = 0.25 vCPU). */
  cpu?: number;
  /** Fargate memory MiB (default 512 = 0.5 GB). */
  memoryMiB?: number;
  /** Number of running tasks (default 1). */
  desiredCount?: number;
}

export class MicroserviceConstruct extends Construct {
  public readonly service: ecs.FargateService;
  public readonly taskRole: iam.Role;
  public readonly logGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: MicroserviceProps) {
    super(scope, id);

    const {
      cluster,
      serviceName,
      containerPort,
      listener,
      listenerPathPattern,
      listenerPriority,
      environment = {},
      secrets = {},
      taskPolicies = [],
      cpu         = FARGATE_DEFAULTS.cpu,
      memoryMiB   = FARGATE_DEFAULTS.memory,
      desiredCount = FARGATE_DEFAULTS.desiredCount,
    } = props;

    // ── CloudWatch log group ───────────────────────────────────────────
    this.logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName:  `/xcloud/${serviceName}`,
      retention:     logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ── ECR repository (one per service) ──────────────────────────────
    const repo = ecr.Repository.fromRepositoryName(
      this, 'Repo', serviceName,
    );

    // ── Task execution role (pull image, write logs) ───────────────────
    const executionRole = new iam.Role(this, 'ExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonECSTaskExecutionRolePolicy',
        ),
      ],
    });

    // ── Task role (business logic permissions) ─────────────────────────
    this.taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });
    for (const policy of taskPolicies) {
      this.taskRole.addToPolicy(policy);
    }

    // ── Task definition ────────────────────────────────────────────────
    const taskDef = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      cpu,
      memoryLimitMiB: memoryMiB,
      executionRole,
      taskRole: this.taskRole,
    });

    taskDef.addContainer('app', {
      image: ecs.ContainerImage.fromEcrRepository(repo, 'latest'),
      portMappings: [{ containerPort }],
      environment: {
        NODE_ENV: 'production',
        PORT:     String(containerPort),
        ...environment,
      },
      secrets,
      logging: ecs.LogDrivers.awsLogs({
        logGroup: this.logGroup,
        streamPrefix: serviceName,
      }),
      healthCheck: {
        command:     ['CMD-SHELL', `curl -f http://localhost:${containerPort}/health || exit 1`],
        interval:    cdk.Duration.seconds(30),
        timeout:     cdk.Duration.seconds(5),
        retries:     3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // ── Fargate service ────────────────────────────────────────────────
    this.service = new ecs.FargateService(this, 'Service', {
      cluster,
      taskDefinition: taskDef,
      desiredCount,
      assignPublicIp: false,
      circuitBreaker: { rollback: true },
    });

    // ── ALB target group + listener rule ──────────────────────────────
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'TargetGroup', {
      vpc:         cluster.vpc,
      port:        containerPort,
      protocol:    elbv2.ApplicationProtocol.HTTP,
      targets:     [this.service],
      healthCheck: {
        path:                '/health',
        healthyHttpCodes:    '200',
        interval:            cdk.Duration.seconds(30),
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    listener.addAction(`${serviceName}-rule`, {
      priority: listenerPriority,
      conditions: [elbv2.ListenerCondition.pathPatterns([listenerPathPattern])],
      action:     elbv2.ListenerAction.forward([targetGroup]),
    });

    // ── Auto Scaling ───────────────────────────────────────────────────
    const scaling = this.service.autoScaleTaskCount({
      minCapacity: desiredCount,
      maxCapacity: desiredCount * 4,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown:  cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(30),
    });
  }
}
