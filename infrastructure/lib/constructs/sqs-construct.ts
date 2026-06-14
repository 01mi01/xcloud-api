import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { SNS_TOPICS, SQS_QUEUES } from '../config/constants';

/**
 * Messaging topology (hybrid: Kafka local, SQS/SNS in prod):
 *   - tweet.created   -> SNS topic, fanned out to TWO SQS queues (fanout, search)
 *   - tweet.retweeted -> SNS topic, fanned out to TWO SQS queues (fanout, notification)
 *   - tweet.liked     -> SQS queue (likeEvent),    consumed by notification
 *   - user.followed   -> SQS queue (followEvent),  consumed by notification
 *   - user.created    -> SQS queue (userCreated),  consumed by search
 *   - user.updated    -> SQS queue (userUpdated),  consumed by search
 */
export class SqsConstruct extends Construct {
  public readonly tweetCreatedTopic:   sns.Topic;
  public readonly tweetRetweetedTopic: sns.Topic;
  public readonly fanoutQueue:   sqs.Queue;
  public readonly tweetIndex:    sqs.Queue;
  public readonly fanoutRetweet: sqs.Queue;
  public readonly notifyRetweet: sqs.Queue;
  public readonly likeEvent:     sqs.Queue;
  public readonly followEvent:   sqs.Queue;
  public readonly userCreated:   sqs.Queue;
  public readonly userUpdated:   sqs.Queue;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // ── tweet.created fan-out (SNS -> 2x SQS) ──────────────────────────
    this.tweetCreatedTopic = new sns.Topic(this, 'TweetCreatedTopic', {
      topicName: SNS_TOPICS.TWEET_CREATED,
    });

    this.fanoutQueue = this.makeQueue(SQS_QUEUES.FANOUT);
    this.tweetIndex  = this.makeQueue(SQS_QUEUES.TWEET_INDEX);
    this.tweetCreatedTopic.addSubscription(new subs.SqsSubscription(this.fanoutQueue));
    this.tweetCreatedTopic.addSubscription(new subs.SqsSubscription(this.tweetIndex));

    // ── tweet.retweeted fan-out (SNS -> 2x SQS) ────────────────────────
    this.tweetRetweetedTopic = new sns.Topic(this, 'TweetRetweetedTopic', {
      topicName: SNS_TOPICS.TWEET_RETWEETED,
    });

    this.fanoutRetweet = this.makeQueue(SQS_QUEUES.FANOUT_RETWEET);
    this.notifyRetweet = this.makeQueue(SQS_QUEUES.NOTIFY_RETWEET);
    this.tweetRetweetedTopic.addSubscription(new subs.SqsSubscription(this.fanoutRetweet));
    this.tweetRetweetedTopic.addSubscription(new subs.SqsSubscription(this.notifyRetweet));

    // ── 1:1 event queues ───────────────────────────────────────────────
    this.likeEvent   = this.makeQueue(SQS_QUEUES.LIKE_EVENT);
    this.followEvent = this.makeQueue(SQS_QUEUES.FOLLOW_EVENT);
    this.userCreated = this.makeQueue(SQS_QUEUES.USER_CREATED);
    this.userUpdated = this.makeQueue(SQS_QUEUES.USER_UPDATED);

    new ssm.StringParameter(this, 'tweet-created-topic-arn-param', {
      parameterName: `/xcloud/sns/${SNS_TOPICS.TWEET_CREATED}/arn`,
      stringValue:   this.tweetCreatedTopic.topicArn,
    });
    new ssm.StringParameter(this, 'tweet-retweeted-topic-arn-param', {
      parameterName: `/xcloud/sns/${SNS_TOPICS.TWEET_RETWEETED}/arn`,
      stringValue:   this.tweetRetweetedTopic.topicArn,
    });
  }

  private makeQueue(name: string): sqs.Queue {
    const dlq = new sqs.Queue(this, `${name}-dlq`, {
      queueName:       `${name}-dlq`,
      retentionPeriod: cdk.Duration.days(14),
      encryption:      sqs.QueueEncryption.SQS_MANAGED,
    });

    const queue = new sqs.Queue(this, name, {
      queueName:         name,
      visibilityTimeout: cdk.Duration.seconds(30),
      retentionPeriod:   cdk.Duration.days(4),
      encryption:        sqs.QueueEncryption.SQS_MANAGED,
      deadLetterQueue:   { queue: dlq, maxReceiveCount: 3 },
    });

    new ssm.StringParameter(this, `${name}-url-param`, {
      parameterName: `/xcloud/sqs/${name}/url`,
      stringValue:   queue.queueUrl,
    });

    return queue;
  }
}
