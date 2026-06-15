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
      // Single data node → zone awareness is off → OpenSearch requires EXACTLY
      // one subnet. Selecting PRIVATE_WITH_EGRESS by type returns one subnet per
      // AZ (the deploy fails with "You must specify exactly one subnet"), so pin
      // to a single private subnet.
      vpcSubnets: [{ subnets: [props.vpc.privateSubnets[0]] }],
      encryptionAtRest: { enabled: true },
      nodeToNodeEncryption: true,
      enforceHttps: true,
      // Resource-based access policy. The domain is VPC-only (private subnets,
      // SG-restricted to the search-service tasks), so network reachability is
      // already locked down; this just authorizes signed HTTP data-plane calls.
      // NOTE: do NOT add `aws:PrincipalOrgID` here — StringEquals is a literal
      // match (no wildcard), and a standalone account has no org id, so the
      // condition never matches and every request 403s.
      accessPolicies: [
        new iam.PolicyStatement({
          effect:     iam.Effect.ALLOW,
          principals: [new iam.AnyPrincipal()],
          actions:    ['es:ESHttp*'],
          resources:  ['*'],
        }),
      ],
      removalPolicy: props.envConfig.deletionProtection
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    new cdk.CfnOutput(this, 'OpenSearchEndpoint', { value: this.domain.domainEndpoint });
  }
}
