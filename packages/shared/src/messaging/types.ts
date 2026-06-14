/** Logical domain events, independent of transport (Kafka topic / SQS queue / SNS topic). */
export type EventName = 'tweet.created' | 'tweet.liked' | 'user.followed' | 'tweet.retweeted' | 'tweet.replied' | 'tweet.mentioned';

export interface PublishOptions {
  /** Kafka message key / partition hint. */
  key?: string;
  /** FIFO MessageGroupId (SQS/SNS FIFO). */
  groupId?: string;
  /** FIFO MessageDeduplicationId (SQS/SNS FIFO). */
  deduplicationId?: string;
}

export interface Publisher {
  publish(event: EventName, payload: unknown, opts?: PublishOptions): Promise<void>;
}

export type MessageHandler = (payload: any) => Promise<void> | void;

export interface SubscribeOptions {
  event: EventName;
  /** Required in production: the SQS queue URL this consumer drains. Ignored locally (Kafka). */
  queueUrl?: string;
}

export interface Consumer {
  /** Begin consuming. Resolves once wired (Kafka) or runs a long-poll loop (SQS). */
  consume(opts: SubscribeOptions, handler: MessageHandler): Promise<void>;
}

/** Production uses SQS/SNS; everything else (local dev) uses Kafka. */
export const isProduction = (): boolean => process.env.NODE_ENV === 'production';
