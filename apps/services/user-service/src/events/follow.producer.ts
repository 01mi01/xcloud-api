import { createPublisher } from "@xcloud/shared";

// Hybrid transport: Kafka locally, SQS/SNS in production (NODE_ENV=production).
// `user.followed` is consumed by notification-service to notify the followed user.
const publisher = createPublisher({ clientId: "user-service" });

export const publishUserFollowed = async (followerId: string, followingId: string): Promise<void> => {
    try {
        await publisher.publish(
            "user.followed",
            { followerId, followingId, timestamp: new Date().toISOString() },
            { key: followingId },
        );
        console.log("[user.producer] Published user.followed:", followerId, "->", followingId);
    } catch (err) {
        console.error("[user.producer] Failed to publish user.followed:", (err as Error).message);
    }
};
