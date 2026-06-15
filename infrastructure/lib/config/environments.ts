export interface EnvironmentConfig {
  name: string;
  account: string;
  region: string;
  /** Number of NAT Gateways. Use 1 for cost savings in non-prod. */
  natGateways: number;
  /** Fargate desired task count multiplier (1 = one task per service). */
  taskCount: number;
  /** RDS instance class. */
  rdsInstanceClass: string;
  /** ElastiCache node type. */
  cacheNodeType: string;
  /** OpenSearch instance type. */
  opensearchInstanceType: string;
  /** Whether to enable deletion protection on stateful resources. */
  deletionProtection: boolean;
  /** Provision OpenSearch + search-service. Disabled on beta to save ~$25/mo. */
  enableSearch: boolean;
}

export const environments: Record<string, EnvironmentConfig> = {
  beta: {
    name: 'beta',
    account: process.env.CDK_DEFAULT_ACCOUNT ?? '',
    region:  process.env.CDK_DEFAULT_REGION  ?? 'us-east-1',
    natGateways: 1,
    taskCount: 1,
    rdsInstanceClass: 'db.t4g.micro',
    cacheNodeType: 'cache.t4g.micro',
    opensearchInstanceType: 't3.small.search',
    deletionProtection: false,
    enableSearch: false,
  },
  gamma: {
    name: 'gamma',
    account: process.env.CDK_DEFAULT_ACCOUNT ?? '',
    region:  process.env.CDK_DEFAULT_REGION  ?? 'us-east-1',
    natGateways: 1,
    taskCount: 1,
    rdsInstanceClass: 'db.t3.small',
    cacheNodeType: 'cache.t3.small',
    opensearchInstanceType: 't3.medium.search',
    deletionProtection: true,
    enableSearch: true,
  },
  prod: {
    name: 'prod',
    account: process.env.CDK_DEFAULT_ACCOUNT ?? '',
    region:  process.env.CDK_DEFAULT_REGION  ?? 'us-east-1',
    natGateways: 2,
    taskCount: 2,
    rdsInstanceClass: 'db.t3.medium',
    cacheNodeType: 'cache.t3.medium',
    opensearchInstanceType: 'm5.large.search',
    deletionProtection: true,
    enableSearch: true,
  },
};
