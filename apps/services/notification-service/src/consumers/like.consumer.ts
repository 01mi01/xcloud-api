import { createConsumer } from "@xcloud/shared";
import { processLikeEvent, LikeEvent } from "../services/notification.service";

// local: Kafka topic "tweet.liked"; prod: SQS queue LIKE_EVENT_QUEUE_URL.
const consumer = createConsumer({
    clientId: "notification-service",
    groupId: "notification-service-group",
});

export const startLikeConsumer = async (): Promise<void> => {
    await consumer.consume(
        { event: "tweet.liked", queueUrl: process.env.LIKE_EVENT_QUEUE_URL },
        async (event: LikeEvent & { targetUserId?: string }) => {
            console.log(`[notification-service] Like event: user ${event.userId} liked tweet ${event.tweetId}`);
            // Producer always includes targetUserId (the tweet author) in the payload.
            const tweetAuthorId = event.targetUserId ?? "";
            await processLikeEvent(event, tweetAuthorId);
        },
    );
    console.log("[notification-service] Like consumer wired (tweet.liked)");
};
