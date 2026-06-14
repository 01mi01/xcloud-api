import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import {
  Consumer,
  MessageHandler,
  Publisher,
  PublishOptions,
  SubscribeOptions,
  EventName,
} from './types';

const region = (): string => process.env.AWS_REGION || 'us-east-1';

// Events that fan out to MULTIPLE consumers are published to an SNS topic
// (which then fans out to each consumer's own SQS queue). 1:1 events go
// straight to a single SQS queue. Env var names match the CDK outputs.
const SNS_TOPIC_ENV: Partial<Record<EventName, string>> = {
  'tweet.created': 'TWEET_CREATED_TOPIC_ARN',
};
const SQS_QUEUE_ENV: Partial<Record<EventName, string>> = {
  'tweet.liked': 'LIKE_EVENT_QUEUE_URL',
  'user.followed': 'FOLLOW_EVENT_QUEUE_URL',
  'tweet.retweeted': 'RETWEET_EVENT_QUEUE_URL',
  'tweet.replied': 'REPLY_EVENT_QUEUE_URL',
  'tweet.mentioned': 'MENTION_EVENT_QUEUE_URL',
};

/** Production publisher: SNS for fan-out events, SQS for 1:1 events. */
export class SqsPublisher implements Publisher {
  private sqs = new SQSClient({ region: region() });
  private sns = new SNSClient({ region: region() });

  async publish(event: EventName, payload: unknown, opts: PublishOptions = {}): Promise<void> {
    const body = JSON.stringify(payload);

    const topicEnv = SNS_TOPIC_ENV[event];
    if (topicEnv) {
      const TopicArn = process.env[topicEnv];
      if (!TopicArn) throw new Error(`Missing ${topicEnv} for event ${event}`);
      await this.sns.send(
        new PublishCommand({
          TopicArn,
          Message: body,
          MessageGroupId: opts.groupId,
          MessageDeduplicationId: opts.deduplicationId,
        }),
      );
      return;
    }

    const queueEnv = SQS_QUEUE_ENV[event];
    const QueueUrl = queueEnv ? process.env[queueEnv] : undefined;
    if (!QueueUrl) throw new Error(`No SQS queue configured for event ${event}`);
    await this.sqs.send(
      new SendMessageCommand({
        QueueUrl,
        MessageBody: body,
        MessageGroupId: opts.groupId,
        MessageDeduplicationId: opts.deduplicationId,
      }),
    );
  }
}

/** Production consumer: long-polls a single SQS queue, unwrapping SNS envelopes. */
export class SqsConsumer implements Consumer {
  private sqs = new SQSClient({ region: region() });

  async consume({ event, queueUrl }: SubscribeOptions, handler: MessageHandler): Promise<void> {
    if (!queueUrl) throw new Error(`Missing queueUrl for SQS consumer of ${event}`);

    // Runs until the process is terminated (the ECS task is the unit of scaling).
    for (;;) {
      const res = await this.sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20,
        }),
      );

      for (const m of res.Messages ?? []) {
        try {
          const raw = m.Body ? JSON.parse(m.Body) : {};
          // SNS->SQS delivery wraps the payload in an envelope with a `Message` field.
          const payload =
            raw && typeof raw === 'object' && typeof raw.Message === 'string'
              ? JSON.parse(raw.Message)
              : raw;
          await handler(payload);
          await this.sqs.send(
            new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: m.ReceiptHandle! }),
          );
        } catch (err) {
          console.error(`[sqs-consumer] error handling ${event}:`, (err as Error).message);
        }
      }
    }
  }
}
