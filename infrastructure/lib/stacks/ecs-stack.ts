import * as cdk   from 'aws-cdk-lib';
import * as ec2   from 'aws-cdk-lib/aws-ec2';
import * as ecs   from 'aws-cdk-lib/aws-ecs';
import * as iam   from 'aws-cdk-lib/aws-iam';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';
import { MicroserviceConstruct } from '../constructs/microservice-construct';
import { DatabaseStack }  from './database-stack';
import { CacheStack }     from './cache-stack';
import { MessagingStack } from './messaging-stack';
import { StorageStack }   from './storage-stack';
import { AuthStack }      from './auth-stack';
import { SearchStack }    from './search-stack';
import { SERVICE_PORTS }  from '../config/constants';

interface EcsStackProps extends cdk.StackProps {
  envConfig:  EnvironmentConfig;
  vpc:        ec2.Vpc;
  alb:        elbv2.ApplicationLoadBalancer;
  database:   DatabaseStack;
  cache:      CacheStack;
  messaging:  MessagingStack;
  storage:    StorageStack;
  auth:       AuthStack;
  search:     SearchStack;
}

export class EcsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: EcsStackProps) {
    super(scope, id, props);

    const { envConfig, vpc, alb, database, cache, messaging, storage, auth, search } = props;

    // ── ECS Cluster ────────────────────────────────────────────────────
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      clusterName:        `xcloud-${envConfig.name}`,
      containerInsights:  true,
    });

    // ── Shared ALB listener ────────────────────────────────────────────
    const listener = alb.addListener('HttpsListener', {
      port: 443,
      open: true,
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: 'text/plain',
        messageBody: 'Not found',
      }),
    });

    // ── Helper: SQS grant ──────────────────────────────────────────────
    const sqsReadWrite = (queues: cdk.aws_sqs.IQueue[]) =>
      queues.map(q => new iam.PolicyStatement({
        actions:   ['sqs:SendMessage', 'sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes'],
        resources: [q.queueArn],
      }));

    // ── auth-service ───────────────────────────────────────────────────
    new MicroserviceConstruct(this, 'AuthService', {
      cluster,
      serviceName:         'auth-service',
      containerPort:       SERVICE_PORTS['auth-service'],
      listener,
      listenerPathPattern: '/v1/auth*',
      listenerPriority:    10,
      environment: {
        COGNITO_USER_POOL_ID: auth.cognito.userPool.userPoolId,
        COGNITO_CLIENT_ID:    auth.cognito.userPoolClient.userPoolClientId,
        AWS_REGION:           this.region,
      },
      taskPolicies: [
        new iam.PolicyStatement({
          actions:   ['cognito-idp:AdminGetUser', 'cognito-idp:AdminAddUserToGroup'],
          resources: [auth.cognito.userPool.userPoolArn],
        }),
      ],
      desiredCount: envConfig.taskCount,
    });

    // ── user-service ───────────────────────────────────────────────────
    const userSvc = new MicroserviceConstruct(this, 'UserService', {
      cluster,
      serviceName:         'user-service',
      containerPort:       SERVICE_PORTS['user-service'],
      listener,
      listenerPathPattern: '/v1/users*',
      listenerPriority:    20,
      environment: {
        DB_HOST:     database.rds.instance.instanceEndpoint.hostname,
        DB_NAME:     'xcloud_users',
        AWS_REGION:  this.region,
      },
      secrets: {
        DB_SECRET: ecs.Secret.fromSecretsManager(database.rds.credentials),
      },
      taskPolicies: sqsReadWrite([messaging.sqs.followEvent]),
      desiredCount: envConfig.taskCount,
    });
    database.rds.securityGroup.addIngressRule(
      userSvc.service.connections.securityGroups[0],
      cdk.aws_ec2.Port.tcp(5432),
    );

    // ── tweet-service ──────────────────────────────────────────────────
    new MicroserviceConstruct(this, 'TweetService', {
      cluster,
      serviceName:         'tweet-service',
      containerPort:       SERVICE_PORTS['tweet-service'],
      listener,
      listenerPathPattern: '/v1/tweets*',
      listenerPriority:    30,
      environment: {
        CASSANDRA_CONTACT_POINTS: `cassandra.${this.region}.amazonaws.com`,
        AWS_REGION:               this.region,
      },
      taskPolicies: [
        ...sqsReadWrite([messaging.sqs.tweetCreated, messaging.sqs.tweetIndex]),
        new iam.PolicyStatement({
          actions:   ['cassandra:*'],
          resources: ['*'],
        }),
      ],
      desiredCount: envConfig.taskCount,
    });

    // ── feed-service ───────────────────────────────────────────────────
    const feedSvc = new MicroserviceConstruct(this, 'FeedService', {
      cluster,
      serviceName:         'feed-service',
      containerPort:       SERVICE_PORTS['feed-service'],
      listener,
      listenerPathPattern: '/v1/feed*',
      listenerPriority:    40,
      environment: {
        REDIS_HOST:  cache.redis.cluster.attrRedisEndpointAddress,
        REDIS_PORT:  '6379',
        AWS_REGION:  this.region,
      },
      desiredCount: envConfig.taskCount,
    });
    cache.redis.securityGroup.addIngressRule(
      feedSvc.service.connections.securityGroups[0],
      cdk.aws_ec2.Port.tcp(6379),
    );

    // ── fanout-service ─────────────────────────────────────────────────
    const fanoutSvc = new MicroserviceConstruct(this, 'FanoutService', {
      cluster,
      serviceName:         'fanout-service',
      containerPort:       SERVICE_PORTS['fanout-service'],
      listener,
      listenerPathPattern: '/v1/fanout*',
      listenerPriority:    50,
      environment: {
        TWEET_CREATED_QUEUE_URL: messaging.sqs.tweetCreated.queueUrl,
        REDIS_HOST:              cache.redis.cluster.attrRedisEndpointAddress,
        AWS_REGION:              this.region,
      },
      taskPolicies: sqsReadWrite([messaging.sqs.tweetCreated]),
      desiredCount: envConfig.taskCount,
    });
    cache.redis.securityGroup.addIngressRule(
      fanoutSvc.service.connections.securityGroups[0],
      cdk.aws_ec2.Port.tcp(6379),
    );

    // ── media-service ──────────────────────────────────────────────────
    new MicroserviceConstruct(this, 'MediaService', {
      cluster,
      serviceName:         'media-service',
      containerPort:       SERVICE_PORTS['media-service'],
      listener,
      listenerPathPattern: '/v1/media*',
      listenerPriority:    60,
      environment: {
        MEDIA_BUCKET: storage.bucket.bucketName,
        AWS_REGION:   this.region,
      },
      taskPolicies: [
        new iam.PolicyStatement({
          actions:   ['s3:PutObject', 's3:GetObject', 's3:DeleteObject'],
          resources: [`${storage.bucket.bucketArn}/*`],
        }),
      ],
      desiredCount: envConfig.taskCount,
    });

    // ── notification-service ───────────────────────────────────────────
    new MicroserviceConstruct(this, 'NotificationService', {
      cluster,
      serviceName:         'notification-service',
      containerPort:       SERVICE_PORTS['notification-service'],
      listener,
      listenerPathPattern: '/v1/notifications*',
      listenerPriority:    70,
      environment: {
        LIKE_QUEUE_URL:   messaging.sqs.likeEvent.queueUrl,
        FOLLOW_QUEUE_URL: messaging.sqs.followEvent.queueUrl,
        AWS_REGION:       this.region,
      },
      taskPolicies: sqsReadWrite([messaging.sqs.likeEvent, messaging.sqs.followEvent]),
      desiredCount: envConfig.taskCount,
    });

    // ── search-service ─────────────────────────────────────────────────
    new MicroserviceConstruct(this, 'SearchService', {
      cluster,
      serviceName:         'search-service',
      containerPort:       SERVICE_PORTS['search-service'],
      listener,
      listenerPathPattern: '/v1/search*',
      listenerPriority:    80,
      environment: {
        OPENSEARCH_ENDPOINT: search.domain.domainEndpoint,
        TWEET_INDEX_QUEUE_URL: messaging.sqs.tweetIndex.queueUrl,
        AWS_REGION:          this.region,
      },
      taskPolicies: [
        ...sqsReadWrite([messaging.sqs.tweetIndex]),
        new iam.PolicyStatement({
          actions:   ['es:ESHttpGet', 'es:ESHttpPost', 'es:ESHttpPut', 'es:ESHttpDelete'],
          resources: [`${search.domain.domainArn}/*`],
        }),
      ],
      desiredCount: envConfig.taskCount,
    });
  }
}
