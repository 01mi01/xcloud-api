import * as cdk from 'aws-cdk-lib';
import * as ec2  from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';
import { RdsConstruct } from '../constructs/rds-construct';

interface DatabaseStackProps extends cdk.StackProps {
  envConfig: EnvironmentConfig;
  vpc: ec2.Vpc;
}

export class DatabaseStack extends cdk.Stack {
  public readonly rds: RdsConstruct;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    this.rds = new RdsConstruct(this, 'Rds', {
      vpc:                props.vpc,
      instanceClass:      props.envConfig.rdsInstanceClass,
      databaseName:       'xcloud',
      deletionProtection: props.envConfig.deletionProtection,
    });

    new cdk.CfnOutput(this, 'RdsEndpoint', { value: this.rds.instance.instanceEndpoint.hostname });
  }
}
