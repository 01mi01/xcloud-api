const client = require("../config/db.config");
const { fromRow } = require("../models/tweet.model");
const cassandra = require("cassandra-driver");

const findById = async (tweetId) => {
    const result = await client.execute(
        "SELECT * FROM tweets WHERE tweet_id = ?",
        [cassandra.types.Uuid.fromString(tweetId)],
        { prepare: true }
    );
    return result.first() ? fromRow(result.first()) : null;
};

const insert = async ({ tweetId, authorId, content, mediaUrls, replyToTweetId }) => {
    const id        = cassandra.types.Uuid.fromString(tweetId);
    const author    = cassandra.types.Uuid.fromString(authorId);
    const now       = new Date();

    await client.batch([
        {
            query: `INSERT INTO tweets
                        (tweet_id, author_id, content, media_urls, reply_to_tweet_id, likes_count, retweet_count, created_at)
                    VALUES (?, ?, ?, ?, ?, 0, 0, ?)`,
            params: [id, author, content, mediaUrls ?? [], replyToTweetId ? cassandra.types.Uuid.fromString(replyToTweetId) : null, now],
        },
        {
            query: `INSERT INTO tweets_by_author (author_id, created_at, tweet_id, content)
                    VALUES (?, ?, ?, ?)`,
            params: [author, now, id, content],
        },
    ], { prepare: true });

    const result = await client.execute(
        "SELECT * FROM tweets WHERE tweet_id = ?",
        [id],
        { prepare: true }
    );
    return fromRow(result.first());
};

const remove = async (tweetId) => {
    const tweet = await findById(tweetId);
    if (!tweet) return false;

    const id     = cassandra.types.Uuid.fromString(tweetId);
    const author = cassandra.types.Uuid.fromString(tweet.authorId);

    await client.batch([
        { query: "DELETE FROM tweets WHERE tweet_id = ?", params: [id] },
        { query: "DELETE FROM tweets_by_author WHERE author_id = ? AND created_at = ? AND tweet_id = ?", params: [author, tweet.createdAt, id] },
    ], { prepare: true });

    return true;
};

const insertLike = async (userId, tweetId) => {
    const uid = cassandra.types.Uuid.fromString(userId);
    const tid = cassandra.types.Uuid.fromString(tweetId);
    const now = new Date();

    await client.batch([
        { query: "INSERT INTO likes (tweet_id, user_id, created_at) VALUES (?, ?, ?)", params: [tid, uid, now] },
        { query: "INSERT INTO likes_by_user (user_id, tweet_id, created_at) VALUES (?, ?, ?)", params: [uid, tid, now] },
        { query: "UPDATE tweets SET likes_count = likes_count + 1 WHERE tweet_id = ?", params: [tid] },
    ], { prepare: true });
};

const deleteLike = async (userId, tweetId) => {
    const exists = await likeExists(userId, tweetId);
    if (!exists) return false;

    const uid = cassandra.types.Uuid.fromString(userId);
    const tid = cassandra.types.Uuid.fromString(tweetId);

    await client.batch([
        { query: "DELETE FROM likes WHERE tweet_id = ? AND user_id = ?", params: [tid, uid] },
        { query: "DELETE FROM likes_by_user WHERE user_id = ? AND tweet_id = ?", params: [uid, tid] },
        { query: "UPDATE tweets SET likes_count = likes_count - 1 WHERE tweet_id = ?", params: [tid] },
    ], { prepare: true });

    return true;
};

const likeExists = async (userId, tweetId) => {
    const result = await client.execute(
        "SELECT tweet_id FROM likes_by_user WHERE user_id = ? AND tweet_id = ?",
        [cassandra.types.Uuid.fromString(userId), cassandra.types.Uuid.fromString(tweetId)],
        { prepare: true }
    );
    return result.rowLength > 0;
};

module.exports = { findById, insert, remove, insertLike, deleteLike, likeExists };
