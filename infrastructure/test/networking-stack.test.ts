import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { NetworkingStack } from '../lib/stacks/networking-stack';
import { environments } from '../lib/config/environments';

describe('NetworkingStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new NetworkingStack(app, 'TestNetworking', {
      envConfig: environments.beta,
      env: { account: '123456789012', region: 'us-east-1' },
    });
    template = Template.fromStack(stack);
  });

  test('creates a VPC', () => {
    template.resourceCountIs('AWS::EC2::VPC', 1);
  });

  test('creates public, private and isolated subnets across 2 AZs', () => {
    // 2 AZs × 3 subnet types = 6 subnets
    template.resourceCountIs('AWS::EC2::Subnet', 6);
  });

  test('has a single NAT Gateway in beta (cost optimisation)', () => {
    template.resourceCountIs('AWS::EC2::NatGateway', 1);
  });

  test('enables VPC Flow Logs', () => {
    template.resourceCountIs('AWS::EC2::FlowLog', 1);
  });
});
