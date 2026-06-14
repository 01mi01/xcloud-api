import { createConsumer } from "@xcloud/shared";
import { processRetweetEvent, RetweetEvent } from "../services/notification.service";

// local: Kafka topic "tweet.retweeted"; prod: SQS queue NOTIFY_RETWEET_QUEUE_URL,
// subscribed to the tweet.retweeted SNS topic (fan-out alongside fanout-service).
const consumer = createConsumer({
    clientId: "notification-service",
    groupId: "notification-service-retweet-group",
});

export const startRetweetConsumer = async (): Promise<void> => {
    await consumer.consume(
        { event: "tweet.retweeted", queueUrl: process.env.NOTIFY_RETWEET_QUEUE_URL },
        async (event: RetweetEvent) => {
            console.log(`[notification-service] Retweet event: ${event.retweeterId} retweeted ${event.tweetId}`);
            await processRetweetEvent(event);
        },
    );
    console.log("[notification-service] Retweet consumer wired (tweet.retweeted)");
};
