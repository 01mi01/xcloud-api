import { Kafka, Producer, logLevel } from 'kafkajs';
import {
  Consumer,
  MessageHandler,
  Publisher,
  PublishOptions,
  SubscribeOptions,
  EventName,
} from './types';

const brokers = (): string[] => (process.env.KAFKA_BROKERS || 'localhost:9094').split(',');

const newKafka = (clientId: string): Kafka =>
  new Kafka({
    clientId,
    brokers: brokers(),
    retry: { initialRetryTime: 300, retries: 5 },
    logLevel: logLevel.ERROR,
  });

/** Local-dev publisher: produces to a Kafka topic named after the event. */
export class KafkaPublisher implements Publisher {
  private kafka: Kafka;
  private producer: Producer | null = null;

  constructor(clientId: string) {
    this.kafka = newKafka(clientId);
  }

  private async getProducer(): Promise<Producer> {
    if (!this.producer) {
      this.producer = this.kafka.producer();
      await this.producer.connect();
    }
    return this.producer;
  }

  async publish(event: EventName, payload: unknown, opts: PublishOptions = {}): Promise<void> {
    const producer = await this.getProducer();
    await producer.send({
      topic: event,
      messages: [{ key: opts.key, value: JSON.stringify(payload) }],
    });
  }
}

/** Local-dev consumer: subscribes to the Kafka topic named after the event. */
export class KafkaConsumer implements Consumer {
  private kafka: Kafka;
  private groupId: string;

  constructor(clientId: string, groupId: string) {
    this.kafka = newKafka(clientId);
    this.groupId = groupId;
  }

  async consume({ event }: SubscribeOptions, handler: MessageHandler): Promise<void> {
    const consumer = this.kafka.consumer({ groupId: this.groupId, sessionTimeout: 30000 });
    await consumer.connect();
    await consumer.subscribe({ topic: event, fromBeginning: false });
    await consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        try {
          await handler(JSON.parse(message.value.toString()));
        } catch (err) {
          console.error(`[kafka-consumer] error handling ${event}:`, (err as Error).message);
        }
      },
    });
  }
}
