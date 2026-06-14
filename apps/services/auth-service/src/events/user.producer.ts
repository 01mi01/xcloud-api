import { createPublisher } from "@xcloud/shared";

// Hybrid transport: Kafka locally, SQS/SNS in production (NODE_ENV=production).
// `user.created` is consumed by search-service to seed the user search index.
const publisher = createPublisher({ clientId: "auth-service" });

export interface UserCreatedPayload {
    userId:      string;
    handle:      string;
    displayName: string;
    createdAt:   string;
}

export const publishUserCreated = async (user: UserCreatedPayload): Promise<void> => {
    try {
        await publisher.publish(
            "user.created",
            // Profile starts minimal at registration (displayName = handle; no bio/avatar).
            { ...user, bio: null, avatarUrl: null, followersCount: 0, followingCount: 0 },
            {
                key:             user.userId,
                groupId:         user.userId,   // FIFO MessageGroupId (prod)
                deduplicationId: user.userId,   // FIFO dedup (prod)
            },
        );
        console.log("[auth.producer] Published user.created:", user.userId);
    } catch (err) {
        console.error("[auth.producer] Failed to publish user.created:", (err as Error).message);
    }
};
