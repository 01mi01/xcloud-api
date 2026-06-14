import * as cdk   from 'aws-cdk-lib';
import * as ec2   from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

interface GatewayStackProps extends cdk.StackProps {
  envConfig: EnvironmentConfig;
  vpc: ec2.Vpc;
}

export class GatewayStack extends cdk.Stack {
  public readonly alb: elbv2.ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props: GatewayStackProps) {
    super(scope, id, props);

    this.alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc:             props.vpc,
      internetFacing:  true,
      loadBalancerName: `xcloud-${props.envConfig.name}`,
      // Default is 60s; the notification WebSocket is long-lived. The server also
      // pings every 30s (keeps the tunnel active), but the extra margin avoids
      // dropping briefly-idle sockets and reduces client reconnect churn.
      idleTimeout:     cdk.Duration.seconds(300),
    });
    // NOTE: the HTTP :80 listener is created in EcsStack (same stack as the
    // services/target groups) to avoid a cross-stack dependency cycle. For beta
    // we serve plain HTTP — HTTPS (443 + ACM cert + 80->443 redirect) is a
    // gamma/prod concern, added later.

    new cdk.CfnOutput(this, 'AlbDnsName', { value: this.alb.loadBalancerDnsName });
  }
}
