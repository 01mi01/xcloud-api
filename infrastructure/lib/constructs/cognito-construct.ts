import * as cdk     from 'aws-cdk-lib';
import * as cognito  from 'aws-cdk-lib/aws-cognito';
import * as ssm      from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export class CognitoConstruct extends Construct {
  public readonly userPool:      cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly resourceServer: cognito.UserPoolResourceServer;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName:     'xcloud-users',
      selfSignUpEnabled: true,
      signInAliases:    { email: true },
      autoVerify:       { email: true },
      passwordPolicy: {
        minLength:        8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits:    true,
        requireSymbols:   false,
      },
      standardAttributes: {
        email:    { required: true, mutable: false },
        nickname: { required: true, mutable: true },
      },
      accountRecovery:  cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy:    cdk.RemovalPolicy.RETAIN,
    });

    // Groups
    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName:  'admin',
      precedence: 1,
    });
    new cognito.CfnUserPoolGroup(this, 'UserGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName:  'user',
      precedence: 2,
    });

    // Resource server with custom scopes
    this.resourceServer = this.userPool.addResourceServer('ResourceServer', {
      identifier: 'https://api.xcloud.app',
      scopes: [
        { scopeName: 'read',  scopeDescription: 'Read access'  },
        { scopeName: 'write', scopeDescription: 'Write access' },
      ],
    });

    this.userPoolClient = this.userPool.addClient('WebClient', {
      userPoolClientName:         'xcloud-web',
      authFlows: {
        userPassword:               true,
        userSrp:                    true,
      },
      oAuth: {
        flows:  { authorizationCodeGrant: true },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
          cognito.OAuthScope.resourceServer(this.resourceServer, { scopeName: 'read',  scopeDescription: 'Read' }),
          cognito.OAuthScope.resourceServer(this.resourceServer, { scopeName: 'write', scopeDescription: 'Write' }),
        ],
        callbackUrls: ['http://localhost:5173/callback'],
        logoutUrls:   ['http://localhost:5173'],
      },
      accessTokenValidity:  cdk.Duration.minutes(60),
      idTokenValidity:      cdk.Duration.minutes(60),
      refreshTokenValidity: cdk.Duration.days(30),
    });

    // SSM params consumed by auth-service
    new ssm.StringParameter(this, 'PoolIdParam', {
      parameterName: '/xcloud/cognito/user-pool-id',
      stringValue:   this.userPool.userPoolId,
    });
    new ssm.StringParameter(this, 'ClientIdParam', {
      parameterName: '/xcloud/cognito/client-id',
      stringValue:   this.userPoolClient.userPoolClientId,
    });
  }
}
