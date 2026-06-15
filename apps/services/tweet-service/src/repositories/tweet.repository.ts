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

export const findByAuthor = async (authorId: string, limit = 20): Promise<Tweet[]> => {
    // tweets_by_author is clustered by created_at DESC, so this returns newest first.
    const index = await client.execute(
        "SELECT tweet_id FROM tweets_by_author WHERE author_id = ? LIMIT ?",
        [cassandra.types.Uuid.fromString(authorId), limit],
        { prepare: true }
    );
    const ids = index.rows.map((r) => r.tweet_id);
    // Hydrate each id from the main tweets table (full row: counts, media, etc.).
    const rows = await Promise.all(
        ids.map((id) =>
            client.execute("SELECT * FROM tweets WHERE tweet_id = ?", [id], { prepare: true }).then((r) => r.first())
        )
    );
    return rows.filter(Boolean).map((row) => fromRow(row as unknown as TweetRow));
};

export const findReplies = async (tweetId: string, limit = 50): Promise<Tweet[]> => {
    const index = await client.execute(
        "SELECT tweet_id FROM replies_by_tweet WHERE reply_to_tweet_id = ? LIMIT ?",
        [cassandra.types.Uuid.fromString(tweetId), limit],
        { prepare: true }
    );
    const ids = index.rows.map((r) => r.tweet_id);
    const rows = await Promise.all(
        ids.map((id) =>
            client.execute("SELECT * FROM tweets WHERE tweet_id = ?", [id], { prepare: true }).then((r) => r.first())
        )
    );
    return rows.filter(Boolean).map((row) => fromRow(row as unknown as TweetRow));
};

export const likedByUser = async (userId: string, limit = 50): Promise<Tweet[]> => {
    const index = await client.execute(
        "SELECT tweet_id FROM likes_by_user WHERE user_id = ? LIMIT ?",
        [cassandra.types.Uuid.fromString(userId), limit],
        { prepare: true }
    );
    const ids = index.rows.map((r) => r.tweet_id);
    const rows = await Promise.all(
        ids.map((id) =>
            client.execute("SELECT * FROM tweets WHERE tweet_id = ?", [id], { prepare: true }).then((r) => r.first())
        )
    );
    return rows.filter(Boolean).map((row) => fromRow(row as unknown as TweetRow));
};

export const countReplies = async (tweetId: string): Promise<number> => {
    // Amazon Keyspaces rejects SELECT COUNT(*) ("countRows is not yet supported"),
    // so count rows client-side. The replies partition is bounded per tweet and
    // repliesCount is display-only, so fall back to 0 rather than fail the read.
    try {
        const result = await client.execute(
            "SELECT reply_to_tweet_id FROM replies_by_tweet WHERE reply_to_tweet_id = ?",
            [cassandra.types.Uuid.fromString(tweetId)],
            { prepare: true }
        );
        return result.rowLength;
    } catch (err) {
        console.error("[tweet-service] countReplies failed:", (err as Error).message);
        return 0;
    }
};

export const insert = async ({ tweetId, authorId, content, mediaUrls, replyToTweetId }: InsertTweetParams): Promise<Tweet> => {
    const id     = cassandra.types.Uuid.fromString(tweetId);
    const author = cassandra.types.Uuid.fromString(authorId);
    const now    = new Date();

    const replyParent = replyToTweetId ? cassandra.types.Uuid.fromString(replyToTweetId) : null;

    const queries = [
        {
            query: `INSERT INTO tweets
                        (tweet_id, author_id, content, media_urls, reply_to_tweet_id, likes_count, retweet_count, replies_count, created_at)
                    VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?)`,
            params: [id, author, content, mediaUrls ?? [], replyParent, now],
        },
        {
            query: `INSERT INTO tweets_by_author (author_id, created_at, tweet_id, content)
                    VALUES (?, ?, ?, ?)`,
            params: [author, now, id, content],
        },
    ];
    // Index replies under their parent so a tweet's replies can be listed.
    if (replyParent) {
        queries.push({
            query: `INSERT INTO replies_by_tweet (reply_to_tweet_id, created_at, tweet_id)
                    VALUES (?, ?, ?)`,
            params: [replyParent, now, id],
        });
    }

    // Keyspaces rejects LOGGED batches (the driver default); these batches span
    // two partitions/tables, so UNLOGGED is correct (and works on local Cassandra too).
    await client.batch(queries, { prepare: true, logged: false });

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
    ], { prepare: true, logged: false });

    return true;
};

export const insertLike = async (userId: string, tweetId: string): Promise<void> => {
    const uid = cassandra.types.Uuid.fromString(userId);
    const tid = cassandra.types.Uuid.fromString(tweetId);
    const now = new Date();

    await client.batch([
        { query: "INSERT INTO likes (tweet_id, user_id, created_at) VALUES (?, ?, ?)", params: [tid, uid, now] },
        { query: "INSERT INTO likes_by_user (user_id, tweet_id, created_at) VALUES (?, ?, ?)", params: [uid, tid, now] },
    ], { prepare: true, logged: false });

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
    ], { prepare: true, logged: false });

    const current = await client.execute("SELECT likes_count FROM tweets WHERE tweet_id = ?", [tid], { prepare: true });
    const count = current.first()?.likes_count ?? 0;
    await client.execute("UPDATE tweets SET likes_count = ? WHERE tweet_id = ?", [Math.max(0, count - 1), tid], { prepare: true });

    return true;
};

export const findLikedByUser = async (userId: string): Promise<Tweet[]> => {
    const rows = await client.execute(
        "SELECT tweet_id, created_at FROM likes_by_user WHERE user_id = ?",
        [cassandra.types.Uuid.fromString(userId)],
        { prepare: true }
    );
    const tweets = await Promise.all(
        rows.rows.map((r) => findById(r.tweet_id.toString()))
    );
    return tweets
        .filter((t): t is Tweet => t !== null)
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

export const insertRetweet = async (userId: string, tweetId: string): Promise<void> => {
    const uid = cassandra.types.Uuid.fromString(userId);
    const tid = cassandra.types.Uuid.fromString(tweetId);
    const now = new Date();

    await client.batch([
        { query: "INSERT INTO retweets (tweet_id, user_id, created_at) VALUES (?, ?, ?)", params: [tid, uid, now] },
        { query: "INSERT INTO retweets_by_user (user_id, tweet_id, created_at) VALUES (?, ?, ?)", params: [uid, tid, now] },
    ], { prepare: true, logged: false });

    const current = await client.execute("SELECT retweet_count FROM tweets WHERE tweet_id = ?", [tid], { prepare: true });
    const count = current.first()?.retweet_count ?? 0;
    await client.execute("UPDATE tweets SET retweet_count = ? WHERE tweet_id = ?", [count + 1, tid], { prepare: true });
};

export const deleteRetweet = async (userId: string, tweetId: string): Promise<boolean> => {
    const exists = await retweetExists(userId, tweetId);
    if (!exists) return false;

    const uid = cassandra.types.Uuid.fromString(userId);
    const tid = cassandra.types.Uuid.fromString(tweetId);

    await client.batch([
        { query: "DELETE FROM retweets WHERE tweet_id = ? AND user_id = ?", params: [tid, uid] },
        { query: "DELETE FROM retweets_by_user WHERE user_id = ? AND tweet_id = ?", params: [uid, tid] },
    ], { prepare: true, logged: false });

    const current = await client.execute("SELECT retweet_count FROM tweets WHERE tweet_id = ?", [tid], { prepare: true });
    const count = current.first()?.retweet_count ?? 0;
    await client.execute("UPDATE tweets SET retweet_count = ? WHERE tweet_id = ?", [Math.max(0, count - 1), tid], { prepare: true });

    return true;
};

export const retweetExists = async (userId: string, tweetId: string): Promise<boolean> => {
    const result = await client.execute(
        "SELECT tweet_id FROM retweets_by_user WHERE user_id = ? AND tweet_id = ?",
        [cassandra.types.Uuid.fromString(userId), cassandra.types.Uuid.fromString(tweetId)],
        { prepare: true }
    );
    return result.rowLength > 0;
};

// For a viewer, return which of the given tweetIds they have liked / retweeted.
// Single partition (user_id) + IN on the clustering key (tweet_id) — efficient.
const interactedIds = async (table: string, userId: string, tweetIds: string[]): Promise<string[]> => {
    if (tweetIds.length === 0) return [];
    const result = await client.execute(
        `SELECT tweet_id FROM ${table} WHERE user_id = ? AND tweet_id IN ?`,
        [cassandra.types.Uuid.fromString(userId), tweetIds.map((id) => cassandra.types.Uuid.fromString(id))],
        { prepare: true }
    );
    return result.rows.map((r) => r.tweet_id.toString());
};

export const likedTweetIds = (userId: string, tweetIds: string[]): Promise<string[]> =>
    interactedIds("likes_by_user", userId, tweetIds);

export const retweetedTweetIds = (userId: string, tweetIds: string[]): Promise<string[]> =>
    interactedIds("retweets_by_user", userId, tweetIds);
