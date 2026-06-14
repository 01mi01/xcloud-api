import { createPublisher } from "@xcloud/shared";
import { User } from "../models/user.model";

// Hybrid transport: Kafka locally, SQS/SNS in production (NODE_ENV=production).
// `user.updated` is consumed by search-service to keep the user search index fresh.
const publisher = createPublisher({ clientId: "user-service" });

export const publishUserUpdated = async (user: User): Promise<void> => {
    try {
        await publisher.publish(
            "user.updated",
            {
                userId:         user.userId,
                handle:         user.handle,
                displayName:    user.displayName,
                bio:            user.bio,
                avatarUrl:      user.avatarUrl,
                followersCount: user.followersCount,
                followingCount: user.followingCount,
                createdAt:      user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
            },
            {
                key:     user.userId,
                groupId: user.userId,   // FIFO MessageGroupId (prod)
            },
        );
        console.log("[user.producer] Published user.updated:", user.userId);
    } catch (err) {
        console.error("[user.producer] Failed to publish user.updated:", (err as Error).message);
    }
};
