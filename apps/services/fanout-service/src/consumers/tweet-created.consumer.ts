import { createConsumer } from "@xcloud/shared";
import { processTweetCreated, TweetCreatedEvent } from "../services/fanout.service";

/**
 * Consumes "tweet.created" and fans the tweet out to each follower's feed cache.
 *
 * Transport is chosen by NODE_ENV (see @xcloud/shared):
 *   - local: Kafka topic "tweet.created" (group fanout-service-group)
 *   - prod:  SQS queue FANOUT_QUEUE_URL, subscribed to the tweet.created SNS topic
 */
const consumer = createConsumer({ clientId: "fanout-service", groupId: "fanout-service-group" });

export const startTweetCreatedConsumer = async (): Promise<void> => {
    await consumer.consume(
        { event: "tweet.created", queueUrl: process.env.FANOUT_QUEUE_URL },
        async (event: TweetCreatedEvent) => {
            console.log(`[fanout-service] Received tweet.created: tweet ${event.tweetId}`);
            await processTweetCreated(event);
        },
    );
    console.log("[fanout-service] Consumer wired for tweet.created");
};
