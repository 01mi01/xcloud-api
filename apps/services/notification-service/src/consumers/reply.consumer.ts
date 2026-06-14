import { createConsumer } from "@xcloud/shared";
import { processReplyEvent, ReplyEvent } from "../services/notification.service";

// local: Kafka topic "tweet.replied"; prod: SQS queue REPLY_EVENT_QUEUE_URL.
const consumer = createConsumer({
    clientId: "notification-service",
    groupId: "notification-service-reply-group",
});

export const startReplyConsumer = async (): Promise<void> => {
    await consumer.consume(
        { event: "tweet.replied", queueUrl: process.env.REPLY_EVENT_QUEUE_URL },
        async (event: ReplyEvent) => {
            console.log(`[notification-service] Reply event: user ${event.userId} replied to ${event.parentTweetId}`);
            await processReplyEvent(event);
        },
    );
    console.log("[notification-service] Reply consumer wired (tweet.replied)");
};
