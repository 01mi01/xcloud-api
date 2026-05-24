import * as cdk from 'aws-cdk-lib';
import * as ec2  from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';
import { RedisConstruct } from '../constructs/redis-construct';

interface CacheStackProps extends cdk.StackProps {
  envConfig: EnvironmentConfig;
  vpc: ec2.Vpc;
}

export class CacheStack extends cdk.Stack {
  public readonly redis: RedisConstruct;

  constructor(scope: Construct, id: string, props: CacheStackProps) {
    super(scope, id, props);

    this.redis = new RedisConstruct(this, 'Redis', {
      vpc:      props.vpc,
      nodeType: props.envConfig.cacheNodeType,
    });

    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: this.redis.cluster.attrRedisEndpointAddress,
    });
  }
}
