import { Publisher, Consumer, isProduction } from './types';
import { KafkaPublisher, KafkaConsumer } from './kafka';
import { SqsPublisher, SqsConsumer } from './sqs';

export * from './types';

/**
 * Create a transport-appropriate event publisher.
 * Local dev → Kafka; production (`NODE_ENV=production`) → SQS/SNS.
 */
export const createPublisher = (opts: { clientId: string }): Publisher =>
  isProduction() ? new SqsPublisher() : new KafkaPublisher(opts.clientId);

/**
 * Create a transport-appropriate event consumer.
 * Local dev → Kafka (groupId); production → SQS (queueUrl passed per `consume`).
 */
export const createConsumer = (opts: { clientId: string; groupId: string }): Consumer =>
  isProduction() ? new SqsConsumer() : new KafkaConsumer(opts.clientId, opts.groupId);
