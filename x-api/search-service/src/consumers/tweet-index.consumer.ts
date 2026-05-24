import kafka from "../config/kafka.config";
import { indexTweet, TweetCreatedEvent } from "../services/search.service";

const TOPIC    = "tweet.created";
const GROUP_ID = "search-service-group";

export const startTweetIndexConsumer = async (): Promise<void> => {
    const consumer = kafka.consumer({ groupId: GROUP_ID });

    await consumer.connect();
    await consumer.subscribe({ topic: TOPIC, fromBeginning: false });

    console.log(`[search-service] Tweet index consumer subscribed to: ${TOPIC}`);

    await consumer.run({
        eachMessage: async ({ message }) => {
            if (!message.value) return;

            try {
                const event: TweetCreatedEvent = JSON.parse(message.value.toString());
                console.log(`[search-service] Indexing tweet ${event.tweetId}`);

                await indexTweet(event);
            } catch (err) {
                console.error("[search-service] Error indexing tweet:", (err as Error).message);
            }
        },
    });
};
