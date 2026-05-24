import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { SQS_QUEUES } from '../config/constants';

export class SqsConstruct extends Construct {
  public readonly tweetCreated:  sqs.Queue;
  public readonly likeEvent:     sqs.Queue;
  public readonly followEvent:   sqs.Queue;
  public readonly tweetIndex:    sqs.Queue;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.tweetCreated = this.makeQueue(SQS_QUEUES.TWEET_CREATED, true);
    this.likeEvent    = this.makeQueue(SQS_QUEUES.LIKE_EVENT);
    this.followEvent  = this.makeQueue(SQS_QUEUES.FOLLOW_EVENT);
    this.tweetIndex   = this.makeQueue(SQS_QUEUES.TWEET_INDEX);
  }

  private makeQueue(name: string, fifo = false): sqs.Queue {
    const queueName = fifo ? `${name}.fifo` : name;

    const dlq = new sqs.Queue(this, `${name}-dlq`, {
      queueName:         fifo ? `${name}-dlq.fifo` : `${name}-dlq`,
      fifo,
      retentionPeriod:   cdk.Duration.days(14),
      encryption:        sqs.QueueEncryption.SQS_MANAGED,
    });

    const queue = new sqs.Queue(this, name, {
      queueName,
      fifo,
      visibilityTimeout:   cdk.Duration.seconds(30),
      retentionPeriod:     cdk.Duration.days(4),
      encryption:          sqs.QueueEncryption.SQS_MANAGED,
      deadLetterQueue: {
        queue:           dlq,
        maxReceiveCount: 3,
      },
    });

    new ssm.StringParameter(this, `${name}-url-param`, {
      parameterName: `/xcloud/sqs/${name}/url`,
      stringValue:   queue.queueUrl,
    });

    return queue;
  }
}
