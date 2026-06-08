import { createConsumer } from "@xcloud/shared";
import { indexTweet, TweetCreatedEvent } from "../services/search.service";

// local: Kafka topic "tweet.created"; prod: SQS queue TWEET_INDEX_QUEUE_URL,
// subscribed to the tweet.created SNS topic (fan-out alongside fanout-service).
const consumer = createConsumer({ clientId: "search-service", groupId: "search-service-group" });

export const startTweetIndexConsumer = async (): Promise<void> => {
    await consumer.consume(
        { event: "tweet.created", queueUrl: process.env.TWEET_INDEX_QUEUE_URL },
        async (event: TweetCreatedEvent) => {
            console.log(`[search-service] Indexing tweet ${event.tweetId}`);
            await indexTweet(event);
        },
    );
    console.log("[search-service] Tweet index consumer wired (tweet.created)");
};
