import * as cdk        from 'aws-cdk-lib';
import * as ec2        from 'aws-cdk-lib/aws-ec2';
import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';
import * as iam        from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

interface SearchStackProps extends cdk.StackProps {
  envConfig: EnvironmentConfig;
  vpc: ec2.Vpc;
}

export class SearchStack extends cdk.Stack {
  public readonly domain: opensearch.Domain;

  constructor(scope: Construct, id: string, props: SearchStackProps) {
    super(scope, id, props);

    this.domain = new opensearch.Domain(this, 'Domain', {
      domainName: `xcloud-${props.envConfig.name}`,
      version:    opensearch.EngineVersion.OPENSEARCH_2_13,
      capacity: {
        dataNodes:             1,
        dataNodeInstanceType:  props.envConfig.opensearchInstanceType,
      },
      ebs: {
        volumeSize: 10,
        volumeType: ec2.EbsDeviceVolumeType.GP3,
      },
      vpc: props.vpc,
      vpcSubnets: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }],
      encryptionAtRest: { enabled: true },
      nodeToNodeEncryption: true,
      enforceHttps: true,
      accessPolicies: [
        new iam.PolicyStatement({
          effect:     iam.Effect.ALLOW,
          principals: [new iam.AnyPrincipal()],
          actions:    ['es:*'],
          resources:  ['*'],
          conditions: {
            StringEquals: { 'aws:PrincipalOrgID': '*' },
          },
        }),
      ],
      removalPolicy: props.envConfig.deletionProtection
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    new cdk.CfnOutput(this, 'OpenSearchEndpoint', { value: this.domain.domainEndpoint });
  }
}
