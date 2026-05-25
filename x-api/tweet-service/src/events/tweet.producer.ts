import { Kafka, Producer } from "kafkajs";
import { Tweet } from "../models/tweet.model";

const kafka = new Kafka({
    clientId: "tweet-service",
    brokers: (process.env.KAFKA_BROKERS || "localhost:9094").split(","),
    retry: { initialRetryTime: 300, retries: 5 },
});

let producer: Producer | null = null;

const getProducer = async (): Promise<Producer> => {
    if (!producer) {
        producer = kafka.producer();
        await producer.connect();
        console.log("[tweet.producer] Connected to Kafka");
    }
    return producer;
};

export const TOPICS = {
    TWEET_CREATED: "tweet.created",
    TWEET_LIKED:   "tweet.liked",
};

export const publishTweetCreated = async (tweet: Tweet): Promise<void> => {
    try {
        const p = await getProducer();
        await p.send({
            topic: TOPICS.TWEET_CREATED,
            messages: [{
                key:   tweet.authorId ?? undefined,
                value: JSON.stringify({
                    tweetId:   tweet.tweetId,
                    authorId:  tweet.authorId,
                    content:   tweet.content,
                    createdAt: tweet.createdAt,
                }),
            }],
        });
        console.log("[tweet.producer] Published tweet.created:", tweet.tweetId);
    } catch (err) {
        console.error("[tweet.producer] Failed to publish tweet.created:", (err as Error).message);
    }
};

export const publishTweetLiked = async ({ tweetId, userId, targetUserId }: { tweetId: string; userId: string; targetUserId: string }): Promise<void> => {
    try {
        const p = await getProducer();
        await p.send({
            topic: TOPICS.TWEET_LIKED,
            messages: [{
                key:   tweetId,
                value: JSON.stringify({ tweetId, userId, targetUserId, timestamp: new Date().toISOString() }),
            }],
        });
        console.log("[tweet.producer] Published tweet.liked:", tweetId);
    } catch (err) {
        console.error("[tweet.producer] Failed to publish tweet.liked:", (err as Error).message);
    }
};
