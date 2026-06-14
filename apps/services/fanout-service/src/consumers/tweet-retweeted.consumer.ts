import { createConsumer } from "@xcloud/shared";
import { processTweetRetweeted, TweetRetweetedEvent } from "../services/fanout.service";

/**
 * Consumes "tweet.retweeted" and fans the original tweet out to each follower
 * of the retweeter (fan-out on retweet).
 *
 * Transport is chosen by NODE_ENV (see @xcloud/shared):
 *   - local: Kafka topic "tweet.retweeted" (group fanout-service-retweet-group)
 *   - prod:  SQS queue FANOUT_RETWEET_QUEUE_URL, subscribed to the tweet.retweeted SNS topic
 */
const consumer = createConsumer({ clientId: "fanout-service", groupId: "fanout-service-retweet-group" });

export const startTweetRetweetedConsumer = async (): Promise<void> => {
    await consumer.consume(
        { event: "tweet.retweeted", queueUrl: process.env.FANOUT_RETWEET_QUEUE_URL },
        async (event: TweetRetweetedEvent) => {
            console.log(`[fanout-service] Received tweet.retweeted: tweet ${event.tweetId} by ${event.retweeterId}`);
            await processTweetRetweeted(event);
        },
    );
    console.log("[fanout-service] Consumer wired for tweet.retweeted");
};
