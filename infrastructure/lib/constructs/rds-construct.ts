import * as cdk  from 'aws-cdk-lib';
import * as ec2  from 'aws-cdk-lib/aws-ec2';
import * as rds  from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

export interface RdsConstructProps {
  vpc: ec2.Vpc;
  instanceClass: string;
  databaseName: string;
  deletionProtection: boolean;
}

export class RdsConstruct extends Construct {
  public readonly instance: rds.DatabaseInstance;
  public readonly credentials: rds.DatabaseSecret;
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: RdsConstructProps) {
    super(scope, id);

    this.securityGroup = new ec2.SecurityGroup(this, 'SG', {
      vpc: props.vpc,
      description: 'RDS PostgreSQL access',
    });

    this.credentials = new rds.DatabaseSecret(this, 'Credentials', {
      username: 'xcloud_admin',
    });

    // Config is e.g. 'db.t3.micro'. RDS prepends the 'db.' itself, so pass the
    // bare type ('t3.micro'). (The old split() kept 'db' as the class and dropped
    // the size → 'db.db.t3'.)
    const instanceType = new ec2.InstanceType(props.instanceClass.replace(/^db\./, ''));
    this.instance = new rds.DatabaseInstance(this, 'Instance', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [this.securityGroup],
      credentials: rds.Credentials.fromSecret(this.credentials),
      databaseName: props.databaseName,
      storageEncrypted: true,
      multiAz: false,
      deletionProtection: props.deletionProtection,
      removalPolicy: props.deletionProtection
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    // (No SSM endpoint parameter — consumers read instance.instanceEndpoint.hostname
    // directly, and the write-only PutParameter is an unnecessary failure point.)
  }
}
