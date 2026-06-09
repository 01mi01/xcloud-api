import * as cdk from 'aws-cdk-lib';
import * as ec2  from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

interface NetworkingStackProps extends cdk.StackProps {
  envConfig: EnvironmentConfig;
}

export class NetworkingStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: NetworkingStackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs:      2,
      natGateways: props.envConfig.natGateways,
      subnetConfiguration: [
        {
          cidrMask:   24,
          name:       'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask:   24,
          name:       'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask:   28,
          name:       'isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // VPC Flow Logs for security auditing
    this.vpc.addFlowLog('FlowLogs', {
      trafficType: ec2.FlowLogTrafficType.REJECT,
    });

    new cdk.CfnOutput(this, 'VpcId', { value: this.vpc.vpcId });
  }
}
