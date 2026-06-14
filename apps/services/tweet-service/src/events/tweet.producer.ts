import { createPublisher } from "@xcloud/shared";
import { Tweet } from "../models/tweet.model";

// Hybrid transport: Kafka locally, SQS/SNS in production (NODE_ENV=production).
// `tweet.created` fans out to fanout + search via SNS; `tweet.liked` is 1:1 to SQS.
const publisher = createPublisher({ clientId: "tweet-service" });

export const TOPICS = {
    TWEET_CREATED:   "tweet.created",
    TWEET_LIKED:     "tweet.liked",
    TWEET_RETWEETED: "tweet.retweeted",
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

// `tweet.retweeted` fans out to TWO consumers (fanout + notification) via SNS.
// retweeterId = quien retuitea; authorId = autor original (destinatario de la notificación).
export const publishTweetRetweeted = async ({ tweetId, retweeterId, authorId }: { tweetId: string; retweeterId: string; authorId: string }): Promise<void> => {
    try {
        await publisher.publish(
            "tweet.retweeted",
            { tweetId, retweeterId, authorId, timestamp: new Date().toISOString() },
            {
                key:             retweeterId,
                groupId:         retweeterId,          // FIFO MessageGroupId (prod)
                deduplicationId: `${retweeterId}:${tweetId}`,  // FIFO dedup (prod)
            },
        );
        console.log("[tweet.producer] Published tweet.retweeted:", tweetId);
    } catch (err) {
        console.error("[tweet.producer] Failed to publish tweet.retweeted:", (err as Error).message);
    }
};
