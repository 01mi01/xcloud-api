import { createPublisher } from "@xcloud/shared";
import { User } from "../models/user.model";

// Hybrid transport: Kafka locally, SQS/SNS in production (NODE_ENV=production).
// `user.updated` → search-service (index freshness); `user.followed` → notification-service.
const publisher = createPublisher({ clientId: "user-service" });

// followerId = quien sigue (actor); followingId = el seguido (destinatario de la notificación).
export const publishUserFollowed = async (followerId: string, followingId: string): Promise<void> => {
    try {
        await publisher.publish(
            "user.followed",
            { followerId, followingId, timestamp: new Date().toISOString() },
            {
                key:     followingId,
                groupId: followingId,   // FIFO MessageGroupId (prod)
            },
        );
        console.log("[user.producer] Published user.followed:", followerId, "->", followingId);
    } catch (err) {
        console.error("[user.producer] Failed to publish user.followed:", (err as Error).message);
    }
};

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
