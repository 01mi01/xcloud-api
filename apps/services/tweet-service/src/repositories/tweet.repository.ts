import client from "../config/db.config";
import { fromRow, Tweet, TweetRow } from "../models/tweet.model";
import cassandra from "cassandra-driver";

export interface InsertTweetParams {
    tweetId:         string;
    authorId:        string;
    content:         string;
    mediaUrls?:      string[];
    replyToTweetId?: string | null;
}

export const findById = async (tweetId: string): Promise<Tweet | null> => {
    const result = await client.execute(
        "SELECT * FROM tweets WHERE tweet_id = ?",
        [cassandra.types.Uuid.fromString(tweetId)],
        { prepare: true }
    );
    const row = result.first();
    return row ? fromRow(row as unknown as TweetRow) : null;
};

export const insert = async ({ tweetId, authorId, content, mediaUrls, replyToTweetId }: InsertTweetParams): Promise<Tweet> => {
    const id     = cassandra.types.Uuid.fromString(tweetId);
    const author = cassandra.types.Uuid.fromString(authorId);
    const now    = new Date();

    await client.batch([
        {
            query: `INSERT INTO tweets
                        (tweet_id, author_id, content, media_urls, reply_to_tweet_id, likes_count, retweet_count, replies_count, created_at)
                    VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?)`,
            params: [id, author, content, mediaUrls ?? [], replyToTweetId ? cassandra.types.Uuid.fromString(replyToTweetId) : null, now],
        },
        {
            query: `INSERT INTO tweets_by_author (author_id, created_at, tweet_id, content)
                    VALUES (?, ?, ?, ?)`,
            params: [author, now, id, content],
        },
    ], { prepare: true });

    // Si es un reply, incrementar replies_count en el tweet padre
    if (replyToTweetId) {
        const parentId = cassandra.types.Uuid.fromString(replyToTweetId);
        const current = await client.execute(
            "SELECT replies_count FROM tweets WHERE tweet_id = ?",
            [parentId], { prepare: true }
        );
        const count = current.first()?.replies_count ?? 0;
        await client.execute(
            "UPDATE tweets SET replies_count = ? WHERE tweet_id = ?",
            [count + 1, parentId], { prepare: true }
        );
    }

    const result = await client.execute(
        "SELECT * FROM tweets WHERE tweet_id = ?",
        [id],
        { prepare: true }
    );
    return fromRow(result.first() as unknown as TweetRow);
};

export const remove = async (tweetId: string): Promise<boolean> => {
    const tweet = await findById(tweetId);
    if (!tweet) return false;

    const id     = cassandra.types.Uuid.fromString(tweetId);
    const author = cassandra.types.Uuid.fromString(tweet.authorId!);

    await client.batch([
        { query: "DELETE FROM tweets WHERE tweet_id = ?", params: [id] },
        { query: "DELETE FROM tweets_by_author WHERE author_id = ? AND created_at = ? AND tweet_id = ?", params: [author, tweet.createdAt, id] },
    ], { prepare: true });

    return true;
};

export const insertLike = async (userId: string, tweetId: string): Promise<void> => {
    const uid = cassandra.types.Uuid.fromString(userId);
    const tid = cassandra.types.Uuid.fromString(tweetId);
    const now = new Date();

    await client.batch([
        { query: "INSERT INTO likes (tweet_id, user_id, created_at) VALUES (?, ?, ?)", params: [tid, uid, now] },
        { query: "INSERT INTO likes_by_user (user_id, tweet_id, created_at) VALUES (?, ?, ?)", params: [uid, tid, now] },
    ], { prepare: true });

    const current = await client.execute("SELECT likes_count FROM tweets WHERE tweet_id = ?", [tid], { prepare: true });
    const count = current.first()?.likes_count ?? 0;
    await client.execute("UPDATE tweets SET likes_count = ? WHERE tweet_id = ?", [count + 1, tid], { prepare: true });
};

export const deleteLike = async (userId: string, tweetId: string): Promise<boolean> => {
    const exists = await likeExists(userId, tweetId);
    if (!exists) return false;

    const uid = cassandra.types.Uuid.fromString(userId);
    const tid = cassandra.types.Uuid.fromString(tweetId);

    await client.batch([
        { query: "DELETE FROM likes WHERE tweet_id = ? AND user_id = ?", params: [tid, uid] },
        { query: "DELETE FROM likes_by_user WHERE user_id = ? AND tweet_id = ?", params: [uid, tid] },
    ], { prepare: true });

    const current = await client.execute("SELECT likes_count FROM tweets WHERE tweet_id = ?", [tid], { prepare: true });
    const count = current.first()?.likes_count ?? 0;
    await client.execute("UPDATE tweets SET likes_count = ? WHERE tweet_id = ?", [Math.max(0, count - 1), tid], { prepare: true });

    return true;
};

export const findReplies = async (tweetId: string): Promise<Tweet[]> => {
    const result = await client.execute(
        "SELECT * FROM tweets WHERE reply_to_tweet_id = ? ALLOW FILTERING",
        [cassandra.types.Uuid.fromString(tweetId)],
        { prepare: true }
    );
    return result.rows
        .map((row) => fromRow(row as unknown as TweetRow))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const likeExists = async (userId: string, tweetId: string): Promise<boolean> => {
    const result = await client.execute(
        "SELECT tweet_id FROM likes_by_user WHERE user_id = ? AND tweet_id = ?",
        [cassandra.types.Uuid.fromString(userId), cassandra.types.Uuid.fromString(tweetId)],
        { prepare: true }
    );
    return result.rowLength > 0;
};
