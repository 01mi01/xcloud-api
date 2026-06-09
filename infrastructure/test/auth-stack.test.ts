import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AuthStack } from '../lib/stacks/auth-stack';
import { environments } from '../lib/config/environments';

describe('AuthStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new AuthStack(app, 'TestAuth', {
      envConfig: environments.beta,
      env: { account: '123456789012', region: 'us-east-1' },
    });
    template = Template.fromStack(stack);
  });

  test('creates a Cognito User Pool', () => {
    template.resourceCountIs('AWS::Cognito::UserPool', 1);
  });

  test('enables self-sign-up', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      AdminCreateUserConfig: { AllowAdminCreateUserOnly: false },
    });
  });

  test('creates admin and user groups', () => {
    template.resourceCountIs('AWS::Cognito::UserPoolGroup', 2);
  });

  test('creates a User Pool Client', () => {
    template.resourceCountIs('AWS::Cognito::UserPoolClient', 1);
  });

  test('writes User Pool ID to SSM', () => {
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: '/xcloud/cognito/user-pool-id',
    });
  });
});
