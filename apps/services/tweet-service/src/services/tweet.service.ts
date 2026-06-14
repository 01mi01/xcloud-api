import { v4 as uuidv4 } from "uuid";
import * as repo from "../repositories/tweet.repository";
import * as producer from "../events/tweet.producer";
import { Tweet } from "../models/tweet.model";

export class TweetNotFoundError extends Error {
    constructor(m: string) { super(m); this.name = "TweetNotFoundError"; }
}
export class ForbiddenError extends Error {
    constructor(m: string) { super(m); this.name = "ForbiddenError"; }
}
export class AlreadyLikedError extends Error {
    constructor(m: string) { super(m); this.name = "AlreadyLikedError"; }
}
export class NotLikedError extends Error {
    constructor(m: string) { super(m); this.name = "NotLikedError"; }
}
export class AlreadyRetweetedError extends Error {
    constructor(m: string) { super(m); this.name = "AlreadyRetweetedError"; }
}
export class NotRetweetedError extends Error {
    constructor(m: string) { super(m); this.name = "NotRetweetedError"; }
}

export interface CreateTweetInput {
    content: string;
    mediaUrls?: string[];
    replyToTweetId?: string | null;
}

export const createTweet = async (authorId: string, input: CreateTweetInput): Promise<Tweet> => {
    const tweet = await repo.insert({
        tweetId: uuidv4(),
        authorId,
        content: input.content,
        mediaUrls: input.mediaUrls,
        replyToTweetId: input.replyToTweetId,
    });
    await producer.publishTweetCreated(tweet);
    return tweet;
};

export const getTweet = async (tweetId: string): Promise<Tweet> => {
    const tweet = await repo.findById(tweetId);
    if (!tweet) throw new TweetNotFoundError(`Tweet '${tweetId}' not found`);
    return tweet;
};

export const deleteTweet = async (tweetId: string, requesterId: string): Promise<void> => {
    const tweet = await repo.findById(tweetId);
    if (!tweet) throw new TweetNotFoundError(`Tweet '${tweetId}' not found`);
    if (tweet.authorId !== requesterId) throw new ForbiddenError("You can only delete your own tweets");
    await repo.remove(tweetId);
};

export const likeTweet = async (userId: string, tweetId: string): Promise<void> => {
    const tweet = await repo.findById(tweetId);
    if (!tweet) throw new TweetNotFoundError(`Tweet '${tweetId}' not found`);

    const already = await repo.likeExists(userId, tweetId);
    if (already) throw new AlreadyLikedError("Already liked this tweet");

    await repo.insertLike(userId, tweetId);
    await producer.publishTweetLiked({ tweetId, userId, targetUserId: tweet.authorId! });
};

export const unlikeTweet = async (userId: string, tweetId: string): Promise<void> => {
    const tweet = await repo.findById(tweetId);
    if (!tweet) throw new TweetNotFoundError(`Tweet '${tweetId}' not found`);

    const deleted = await repo.deleteLike(userId, tweetId);
    if (!deleted) throw new NotLikedError("You have not liked this tweet");
};

export const retweetTweet = async (userId: string, tweetId: string): Promise<void> => {
    const tweet = await repo.findById(tweetId);
    if (!tweet) throw new TweetNotFoundError(`Tweet '${tweetId}' not found`);

    const already = await repo.retweetExists(userId, tweetId);
    if (already) throw new AlreadyRetweetedError("Already retweeted this tweet");

    await repo.insertRetweet(userId, tweetId);
    // El evento fan-outea el tweet original a los followers del retweeter y
    // notifica al autor original.
    await producer.publishTweetRetweeted({ tweetId, retweeterId: userId, authorId: tweet.authorId! });
};

export const unretweetTweet = async (userId: string, tweetId: string): Promise<void> => {
    const tweet = await repo.findById(tweetId);
    if (!tweet) throw new TweetNotFoundError(`Tweet '${tweetId}' not found`);

    const deleted = await repo.deleteRetweet(userId, tweetId);
    if (!deleted) throw new NotRetweetedError("You have not retweeted this tweet");
};
