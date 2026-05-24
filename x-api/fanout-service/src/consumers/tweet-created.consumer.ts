import kafka from "../config/kafka.config";
import { processTweetCreated, TweetCreatedEvent } from "../services/fanout.service";

const TOPIC    = "tweet.created";
const GROUP_ID = "fanout-service-group";

/**
 * Kafka consumer que escucha el topic "tweet.created".
 *
 * Corresponde al diseño técnico §4.1:
 *   Message Queue → Fan-out Service: Consume TweetCreated
 *
 * Cada mensaje contiene { tweetId, authorId, content, createdAt }.
 * El consumer llama a fanout.service para distribuir el tweet
 * al feed cache de cada follower.
 */
export const startTweetCreatedConsumer = async (): Promise<void> => {
    const consumer = kafka.consumer({ groupId: GROUP_ID });

    await consumer.connect();
    console.log(`[fanout-service] Kafka consumer connected, group: ${GROUP_ID}`);

    await consumer.subscribe({ topic: TOPIC, fromBeginning: false });
    console.log(`[fanout-service] Subscribed to topic: ${TOPIC}`);

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            if (!message.value) return;

            try {
                const event: TweetCreatedEvent = JSON.parse(message.value.toString());
                console.log(`[fanout-service] Received ${topic}[${partition}]: tweet ${event.tweetId}`);

                await processTweetCreated(event);
            } catch (err) {
                console.error("[fanout-service] Error processing message:", (err as Error).message);
            }
        },
    });
};
