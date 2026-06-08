#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkingStack }  from '../lib/stacks/networking-stack';
import { EcsStack }         from '../lib/stacks/ecs-stack';
import { AuthStack }        from '../lib/stacks/auth-stack';
import { DatabaseStack }    from '../lib/stacks/database-stack';
import { CacheStack }       from '../lib/stacks/cache-stack';
import { MessagingStack }   from '../lib/stacks/messaging-stack';
import { StorageStack }     from '../lib/stacks/storage-stack';
import { CdnStack }         from '../lib/stacks/cdn-stack';
import { GatewayStack }     from '../lib/stacks/gateway-stack';
import { SearchStack }      from '../lib/stacks/search-stack';
import { MonitoringStack }  from '../lib/stacks/monitoring-stack';
import { environments }     from '../lib/config/environments';

const app = new cdk.App();

const envName = app.node.tryGetContext('env') as string ?? 'beta';
const envConfig = environments[envName];

if (!envConfig) {
  throw new Error(`Unknown environment "${envName}". Valid values: beta, gamma, prod`);
}

const env: cdk.Environment = {
  account: envConfig.account || process.env.CDK_DEFAULT_ACCOUNT,
  region:  envConfig.region  || process.env.CDK_DEFAULT_REGION,
};

const prefix = `xcloud-${envName}`;
const stackProps = { env, envConfig };

const networking = new NetworkingStack(app, `${prefix}-networking`, stackProps);
const auth       = new AuthStack      (app, `${prefix}-auth`,       stackProps);
const database   = new DatabaseStack  (app, `${prefix}-database`,   { ...stackProps, vpc: networking.vpc });
const cache      = new CacheStack     (app, `${prefix}-cache`,      { ...stackProps, vpc: networking.vpc });
const messaging  = new MessagingStack (app, `${prefix}-messaging`,  stackProps);
const storage    = new StorageStack   (app, `${prefix}-storage`,    stackProps);
const search     = envConfig.enableSearch
  ? new SearchStack(app, `${prefix}-search`, { ...stackProps, vpc: networking.vpc })
  : null;
const gateway    = new GatewayStack   (app, `${prefix}-gateway`,    { ...stackProps, vpc: networking.vpc });

new EcsStack(app, `${prefix}-ecs`, {
  ...stackProps,
  vpc:       networking.vpc,
  alb:       gateway.alb,
  database,
  cache,
  messaging,
  storage,
  auth,
  search,
});

new CdnStack(app, `${prefix}-cdn`, { ...stackProps, storage });

new MonitoringStack(app, `${prefix}-monitoring`, stackProps);

app.synth();
