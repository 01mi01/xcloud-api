import * as ec2        from 'aws-cdk-lib/aws-ec2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import { Construct } from 'constructs';

export interface RedisConstructProps {
  vpc: ec2.Vpc;
  nodeType: string;
}

export class RedisConstruct extends Construct {
  public readonly cluster: elasticache.CfnCacheCluster;
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: RedisConstructProps) {
    super(scope, id);

    this.securityGroup = new ec2.SecurityGroup(this, 'SG', {
      vpc: props.vpc,
      description: 'ElastiCache Redis access',
    });

    const subnetGroup = new elasticache.CfnSubnetGroup(this, 'SubnetGroup', {
      description: 'xcloud Redis subnet group',
      subnetIds: props.vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      }).subnetIds,
    });

    this.cluster = new elasticache.CfnCacheCluster(this, 'Cluster', {
      cacheNodeType:         props.nodeType,
      engine:                'redis',
      numCacheNodes:         1,
      cacheSubnetGroupName:  subnetGroup.ref,
      vpcSecurityGroupIds:   [this.securityGroup.securityGroupId],
      autoMinorVersionUpgrade: true,
    });

    // (No SSM parameter for the endpoint — consumers read cluster.attrRedisEndpointAddress
    // directly, and the write-only PutParameter was failing the stack.)
  }
}
