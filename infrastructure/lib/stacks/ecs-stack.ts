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
  /** Null when envConfig.enableSearch is false (e.g. beta). */
  search:     SearchStack | null;
}

export class EcsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: EcsStackProps) {
    super(scope, id, props);

    const { envConfig, vpc, alb, database, cache, messaging, storage, auth, search } = props;
    const sqs = messaging.sqs;

    // ── ECS Cluster ────────────────────────────────────────────────────
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      clusterName:        `xcloud-${envConfig.name}`,
      containerInsights:  true,
    });

    // ── Shared ALB listener (HTTP :80) ─────────────────────────────────
    // Created here (NOT via alb.addListener in the gateway stack) so the
    // listener, target groups and rules all live in THIS stack — avoiding a
    // cross-stack dependency cycle with the gateway stack. Beta serves plain
    // HTTP; HTTPS (443 + ACM) is a later gamma/prod concern.
    const listener = new elbv2.ApplicationListener(this, 'HttpListener', {
      loadBalancer: alb,
      port: 80,
      open: true,
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: 'text/plain',
        messageBody: 'Not found',
      }),
    });

    // ── IAM helpers ────────────────────────────────────────────────────
    const sqsAccess = (queues: cdk.aws_sqs.IQueue[]) =>
      queues.map(q => new iam.PolicyStatement({
        actions:   ['sqs:SendMessage', 'sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes'],
        resources: [q.queueArn],
      }));
    const snsPublish = (topicArn: string) =>
      new iam.PolicyStatement({ actions: ['sns:Publish'], resources: [topicArn] });

    // Declare the SG ingress rules in THIS (ecs) stack via CfnSecurityGroupIngress,
    // rather than dbSG.addIngressRule(...) which would place the rule in the
    // database/cache stack and create a cross-stack dependency cycle.
    const rdsIngressFrom = (svc: MicroserviceConstruct, id: string) =>
      new ec2.CfnSecurityGroupIngress(this, `RdsIngress-${id}`, {
        groupId:               database.rds.securityGroup.securityGroupId,
        ipProtocol:            'tcp',
        fromPort:              5432,
        toPort:                5432,
        sourceSecurityGroupId: svc.service.connections.securityGroups[0].securityGroupId,
      });
    const redisIngressFrom = (svc: MicroserviceConstruct, id: string) =>
      new ec2.CfnSecurityGroupIngress(this, `RedisIngress-${id}`, {
        groupId:               cache.redis.securityGroup.securityGroupId,
        ipProtocol:            'tcp',
        fromPort:              6379,
        toPort:                6379,
        sourceSecurityGroupId: svc.service.connections.securityGroups[0].securityGroupId,
      });

    // ── auth-service (PostgreSQL + Cognito) ────────────────────────────
    const authSvc = new MicroserviceConstruct(this, 'AuthService', {
      cluster,
      serviceName:         'auth-service',
      containerPort:       SERVICE_PORTS['auth-service'],
      listener,
      listenerPathPattern: '/v1/auth*',
      listenerPriority:    10,
      environment: {
        DB_HOST:              database.rds.instance.instanceEndpoint.hostname,
        DB_NAME:              'xcloud_users',
        COGNITO_USER_POOL_ID:   auth.cognito.userPool.userPoolId,
        COGNITO_CLIENT_ID:      auth.cognito.userPoolClient.userPoolClientId,
        USER_CREATED_QUEUE_URL: sqs.userCreated.queueUrl,
        AWS_REGION:             this.region,
      },
      secrets: {
        DB_SECRET: ecs.Secret.fromSecretsManager(database.rds.credentials),
      },
      taskPolicies: [
        new iam.PolicyStatement({
          actions:   ['cognito-idp:AdminGetUser', 'cognito-idp:AdminAddUserToGroup'],
          resources: [auth.cognito.userPool.userPoolArn],
        }),
        ...sqsAccess([sqs.userCreated]),
      ],
      desiredCount: envConfig.taskCount,
    });
    rdsIngressFrom(authSvc, 'auth');

    // ── user-service (publishes user.followed + user.updated) ──────────
    const userSvc = new MicroserviceConstruct(this, 'UserService', {
      cluster,
      serviceName:         'user-service',
      containerPort:       SERVICE_PORTS['user-service'],
      listener,
      listenerPathPattern: '/v1/users*',
      listenerPriority:    20,
      environment: {
        DB_HOST:                database.rds.instance.instanceEndpoint.hostname,
        DB_NAME:                'xcloud_users',
        FOLLOW_EVENT_QUEUE_URL: sqs.followEvent.queueUrl,
        USER_UPDATED_QUEUE_URL: sqs.userUpdated.queueUrl,
        AWS_REGION:             this.region,
      },
      secrets: {
        DB_SECRET: ecs.Secret.fromSecretsManager(database.rds.credentials),
      },
      taskPolicies: sqsAccess([sqs.followEvent, sqs.userUpdated]),
      desiredCount: envConfig.taskCount,
    });
    rdsIngressFrom(userSvc, 'user');

    // ── tweet-service (publishes tweet.created via SNS, tweet.liked via SQS) ──
    new MicroserviceConstruct(this, 'TweetService', {
      cluster,
      serviceName:         'tweet-service',
      containerPort:       SERVICE_PORTS['tweet-service'],
      listener,
      listenerPathPattern: '/v1/tweets*',
      listenerPriority:    30,
      environment: {
        CASSANDRA_CONTACT_POINTS:  `cassandra.${this.region}.amazonaws.com`,
        TWEET_CREATED_TOPIC_ARN:   sqs.tweetCreatedTopic.topicArn,
        TWEET_RETWEETED_TOPIC_ARN: sqs.tweetRetweetedTopic.topicArn,
        LIKE_EVENT_QUEUE_URL:      sqs.likeEvent.queueUrl,
        AWS_REGION:                this.region,
      },
      taskPolicies: [
        snsPublish(sqs.tweetCreatedTopic.topicArn),
        snsPublish(sqs.tweetRetweetedTopic.topicArn),
        ...sqsAccess([sqs.likeEvent]),
        new iam.PolicyStatement({ actions: ['cassandra:*'], resources: ['*'] }),
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
    redisIngressFrom(feedSvc, 'feed');

    // ── fanout-service (consumes tweet.created via its own SQS queue) ───
    const fanoutSvc = new MicroserviceConstruct(this, 'FanoutService', {
      cluster,
      serviceName:         'fanout-service',
      containerPort:       SERVICE_PORTS['fanout-service'],
      listener,
      listenerPathPattern: '/v1/fanout*',
      listenerPriority:    50,
      environment: {
        FANOUT_QUEUE_URL:         sqs.fanoutQueue.queueUrl,
        FANOUT_RETWEET_QUEUE_URL: sqs.fanoutRetweet.queueUrl,
        REDIS_HOST:               cache.redis.cluster.attrRedisEndpointAddress,
        AWS_REGION:               this.region,
      },
      taskPolicies: sqsAccess([sqs.fanoutQueue, sqs.fanoutRetweet]),
      desiredCount: envConfig.taskCount,
    });
    redisIngressFrom(fanoutSvc, 'fanout');

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

    // ── notification-service (consumes tweet.liked + user.followed + tweet.retweeted) ──
    new MicroserviceConstruct(this, 'NotificationService', {
      cluster,
      serviceName:         'notification-service',
      containerPort:       SERVICE_PORTS['notification-service'],
      listener,
      listenerPathPattern: '/v1/notifications*',
      listenerPriority:    70,
      environment: {
        LIKE_EVENT_QUEUE_URL:    sqs.likeEvent.queueUrl,
        FOLLOW_EVENT_QUEUE_URL:  sqs.followEvent.queueUrl,
        NOTIFY_RETWEET_QUEUE_URL: sqs.notifyRetweet.queueUrl,
        AWS_REGION:              this.region,
      },
      taskPolicies: sqsAccess([sqs.likeEvent, sqs.followEvent, sqs.notifyRetweet]),
      desiredCount: envConfig.taskCount,
    });

    // ── search-service (only when search is enabled) ───────────────────
    if (search) {
      new MicroserviceConstruct(this, 'SearchService', {
        cluster,
        serviceName:         'search-service',
        containerPort:       SERVICE_PORTS['search-service'],
        listener,
        listenerPathPattern: '/v1/search*',
        listenerPriority:    80,
        environment: {
          OPENSEARCH_ENDPOINT:    search.domain.domainEndpoint,
          TWEET_INDEX_QUEUE_URL:  sqs.tweetIndex.queueUrl,
          USER_CREATED_QUEUE_URL: sqs.userCreated.queueUrl,
          USER_UPDATED_QUEUE_URL: sqs.userUpdated.queueUrl,
          AWS_REGION:             this.region,
        },
        taskPolicies: [
          ...sqsAccess([sqs.tweetIndex, sqs.userCreated, sqs.userUpdated]),
          new iam.PolicyStatement({
            actions:   ['es:ESHttpGet', 'es:ESHttpPost', 'es:ESHttpPut', 'es:ESHttpDelete'],
            resources: [`${search.domain.domainArn}/*`],
          }),
        ],
        desiredCount: envConfig.taskCount,
      });
    }
  }
}
