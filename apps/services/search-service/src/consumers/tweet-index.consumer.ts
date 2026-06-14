import { createConsumer } from "@xcloud/shared";
import { indexTweet, TweetCreatedEvent } from "../services/search.service";

// local: Kafka topic "tweet.created"; prod: SQS queue TWEET_INDEX_QUEUE_URL,
// subscribed to the tweet.created SNS topic (fan-out alongside fanout-service).
const consumer = createConsumer({ clientId: "search-service", groupId: "search-service-group" });

export const startTweetIndexConsumer = async (): Promise<void> => {
    // NOTE: in prod consume() is an infinite long-poll loop that never resolves,
    // so callers must NOT await this sequentially before starting other consumers
    // (see index.ts). Log before entering the loop.
    console.log("[search-service] Tweet index consumer starting (tweet.created)");
    await consumer.consume(
        { event: "tweet.created", queueUrl: process.env.TWEET_INDEX_QUEUE_URL },
        async (event: TweetCreatedEvent) => {
            console.log(`[search-service] Indexing tweet ${event.tweetId}`);
            await indexTweet(event);
        },
    );
};
