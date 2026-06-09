import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';
import { CognitoConstruct } from '../constructs/cognito-construct';

interface AuthStackProps extends cdk.StackProps {
  envConfig: EnvironmentConfig;
}

export class AuthStack extends cdk.Stack {
  public readonly cognito: CognitoConstruct;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);
    this.cognito = new CognitoConstruct(this, 'Cognito');
    new cdk.CfnOutput(this, 'UserPoolId',  { value: this.cognito.userPool.userPoolId });
    new cdk.CfnOutput(this, 'ClientId',    { value: this.cognito.userPoolClient.userPoolClientId });
  }
}
