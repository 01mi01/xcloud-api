import { createConsumer } from "@xcloud/shared";
import { processMentionEvent, MentionEvent } from "../services/notification.service";

// local: Kafka topic "tweet.mentioned"; prod: SQS queue MENTION_EVENT_QUEUE_URL.
const consumer = createConsumer({
    clientId: "notification-service",
    groupId: "notification-service-mention-group",
});

export const startMentionConsumer = async (): Promise<void> => {
    await consumer.consume(
        { event: "tweet.mentioned", queueUrl: process.env.MENTION_EVENT_QUEUE_URL },
        async (event: MentionEvent) => {
            console.log(`[notification-service] Mention event: user ${event.userId} mentioned ${event.targetUserId} in ${event.tweetId}`);
            await processMentionEvent(event);
        },
    );
    console.log("[notification-service] Mention consumer wired (tweet.mentioned)");
};
