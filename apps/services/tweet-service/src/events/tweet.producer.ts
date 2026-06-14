import { createPublisher } from "@xcloud/shared";
import { Tweet } from "../models/tweet.model";

// Hybrid transport: Kafka locally, SQS/SNS in production (NODE_ENV=production).
// `tweet.created` fans out to fanout + search via SNS; `tweet.liked` is 1:1 to SQS.
const publisher = createPublisher({ clientId: "tweet-service" });

export const TOPICS = {
    TWEET_CREATED:   "tweet.created",
    TWEET_LIKED:     "tweet.liked",
    TWEET_RETWEETED: "tweet.retweeted",
    TWEET_REPLIED:   "tweet.replied",
    TWEET_MENTIONED: "tweet.mentioned",
} as const;

export const publishTweetCreated = async (tweet: Tweet): Promise<void> => {
    try {
        await publisher.publish(
            "tweet.created",
            {
                tweetId:   tweet.tweetId,
                authorId:  tweet.authorId,
                content:   tweet.content,
                createdAt: tweet.createdAt,
            },
            {
                key:             tweet.authorId ?? undefined,
                groupId:         tweet.authorId ?? undefined,   // FIFO MessageGroupId (prod)
                deduplicationId: tweet.tweetId ?? undefined,    // FIFO dedup (prod)
            },
        );
        console.log("[tweet.producer] Published tweet.created:", tweet.tweetId);
    } catch (err) {
        console.error("[tweet.producer] Failed to publish tweet.created:", (err as Error).message);
    }
};

export const publishTweetLiked = async ({ tweetId, userId, targetUserId }: { tweetId: string; userId: string; targetUserId: string }): Promise<void> => {
    try {
        await publisher.publish(
            "tweet.liked",
            { tweetId, userId, targetUserId, timestamp: new Date().toISOString() },
            { key: tweetId },
        );
        console.log("[tweet.producer] Published tweet.liked:", tweetId);
    } catch (err) {
        console.error("[tweet.producer] Failed to publish tweet.liked:", (err as Error).message);
    }
};

export const publishTweetRetweeted = async ({ tweetId, userId, targetUserId }: { tweetId: string; userId: string; targetUserId: string }): Promise<void> => {
    try {
        await publisher.publish(
            "tweet.retweeted",
            { tweetId, userId, targetUserId, timestamp: new Date().toISOString() },
            { key: tweetId },
        );
        console.log("[tweet.producer] Published tweet.retweeted:", tweetId);
    } catch (err) {
        console.error("[tweet.producer] Failed to publish tweet.retweeted:", (err as Error).message);
    }
};

export const publishTweetReplied = async ({ replyTweetId, parentTweetId, userId, targetUserId }: { replyTweetId: string; parentTweetId: string; userId: string; targetUserId: string }): Promise<void> => {
    try {
        await publisher.publish(
            "tweet.replied",
            { replyTweetId, parentTweetId, userId, targetUserId, timestamp: new Date().toISOString() },
            { key: parentTweetId },
        );
        console.log("[tweet.producer] Published tweet.replied:", replyTweetId);
    } catch (err) {
        console.error("[tweet.producer] Failed to publish tweet.replied:", (err as Error).message);
    }
};

export const publishTweetMentioned = async ({ tweetId, userId, targetUserId }: { tweetId: string; userId: string; targetUserId: string }): Promise<void> => {
    try {
        await publisher.publish(
            "tweet.mentioned",
            { tweetId, userId, targetUserId, timestamp: new Date().toISOString() },
            { key: tweetId },
        );
        console.log("[tweet.producer] Published tweet.mentioned:", tweetId, "->", targetUserId);
    } catch (err) {
        console.error("[tweet.producer] Failed to publish tweet.mentioned:", (err as Error).message);
    }
};
