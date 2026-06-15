import { v4 as uuidv4 } from "uuid";
import * as repo from "../repositories/tweet.repository";
import * as producer from "../events/tweet.producer";
import { resolveHandleToUserId } from "../clients/user.client";
import { Tweet } from "../models/tweet.model";

// Extrae handles únicos mencionados en el contenido (@handle), sin la @.
const extractMentions = (content: string): string[] => {
    const matches = content.match(/@([A-Za-z0-9_]+)/g) ?? [];
    return [...new Set(matches.map((m) => m.slice(1)))];
};

// Notifica (best-effort) a cada usuario mencionado en el tweet.
const notifyMentions = async (tweet: Tweet, authorId: string): Promise<void> => {
    const handles = extractMentions(tweet.content ?? "");
    if (handles.length === 0) return;

    await Promise.all(handles.map(async (handle) => {
        const targetUserId = await resolveHandleToUserId(handle);
        if (targetUserId && targetUserId !== authorId) {
            await producer.publishTweetMentioned({ tweetId: tweet.tweetId!, userId: authorId, targetUserId });
        }
    }));
};

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

    // Notificar a los usuarios mencionados (@handle) en el contenido.
    await notifyMentions(tweet, authorId);

    // Si es un reply, notificar al autor del tweet padre (salvo self-reply).
    if (input.replyToTweetId) {
        const parent = await repo.findById(input.replyToTweetId);
        if (parent && parent.authorId && parent.authorId !== authorId) {
            await producer.publishTweetReplied({
                replyTweetId:  tweet.tweetId!,
                parentTweetId: input.replyToTweetId,
                userId:        authorId,
                targetUserId:  parent.authorId,
            });
        }
    }

    return tweet;
};

export const getTweet = async (tweetId: string): Promise<Tweet> => {
    const tweet = await repo.findById(tweetId);
    if (!tweet) throw new TweetNotFoundError(`Tweet '${tweetId}' not found`);
    tweet.repliesCount = await repo.countReplies(tweetId);
    return tweet;
};

export const getTweetsByAuthor = async (authorId: string, limit = 20): Promise<Tweet[]> => {
    return repo.findByAuthor(authorId, limit);
};

export const getReplies = async (tweetId: string, limit = 50): Promise<Tweet[]> => {
    return repo.findReplies(tweetId, limit);
};

export const getLikedTweets = async (userId: string, limit = 50): Promise<Tweet[]> => {
    return repo.likedByUser(userId, limit);
};

// Per-viewer interaction state for a batch of tweets (which ones this user
// has liked / retweeted) — powers the highlighted button state on reload.
export const getInteractions = async (
    userId: string,
    tweetIds: string[],
): Promise<{ liked: string[]; retweeted: string[] }> => {
    const [liked, retweeted] = await Promise.all([
        repo.likedTweetIds(userId, tweetIds),
        repo.retweetedTweetIds(userId, tweetIds),
    ]);
    return { liked, retweeted };
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
