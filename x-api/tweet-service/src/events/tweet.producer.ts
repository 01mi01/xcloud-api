import { Tweet } from "../models/tweet.model";

export const publishTweetCreated = async (tweet: Tweet): Promise<void> => {
    console.log("[tweet.producer] tweet.created (stub):", tweet.tweetId);
};

export const publishTweetLiked = async ({ tweetId, userId }: { tweetId: string; userId: string }): Promise<void> => {
    console.log("[tweet.producer] tweet.liked (stub):", tweetId, userId);
};
