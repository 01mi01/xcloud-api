import { createConsumer } from "@xcloud/shared";
import { processFollowEvent, FollowEvent } from "../services/notification.service";

// local: Kafka topic "user.followed"; prod: SQS queue FOLLOW_EVENT_QUEUE_URL.
const consumer = createConsumer({
    clientId: "notification-service",
    groupId: "notification-service-follow-group",
});

export const startFollowConsumer = async (): Promise<void> => {
    await consumer.consume(
        { event: "user.followed", queueUrl: process.env.FOLLOW_EVENT_QUEUE_URL },
        async (event: FollowEvent) => {
            console.log(`[notification-service] Follow event: ${event.followerId} followed ${event.followingId}`);
            await processFollowEvent(event);
        },
    );
    console.log("[notification-service] Follow consumer wired (user.followed)");
};
