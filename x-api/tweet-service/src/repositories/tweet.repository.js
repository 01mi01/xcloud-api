const pool = require("../config/db.config");
const { fromRow } = require("../models/tweet.model");

const findById = async (tweetId) => {
    const { rows } = await pool.query(
        "SELECT * FROM tweets WHERE tweet_id = $1",
        [tweetId]
    );
    return rows[0] ? fromRow(rows[0]) : null;
};

const insert = async ({ tweetId, authorId, content, mediaUrls, replyToTweetId }) => {
    const { rows } = await pool.query(
        `INSERT INTO tweets (tweet_id, author_id, content, media_urls, reply_to_tweet_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [tweetId, authorId, content, mediaUrls ?? [], replyToTweetId ?? null]
    );
    return fromRow(rows[0]);
};

const remove = async (tweetId) => {
    const { rowCount } = await pool.query(
        "DELETE FROM tweets WHERE tweet_id = $1",
        [tweetId]
    );
    return rowCount > 0;
};

const insertLike = async (userId, tweetId) => {
    await pool.query(
        "INSERT INTO likes (user_id, tweet_id) VALUES ($1, $2)",
        [userId, tweetId]
    );
    await pool.query(
        "UPDATE tweets SET likes_count = likes_count + 1 WHERE tweet_id = $1",
        [tweetId]
    );
};

const deleteLike = async (userId, tweetId) => {
    const { rowCount } = await pool.query(
        "DELETE FROM likes WHERE user_id = $1 AND tweet_id = $2",
        [userId, tweetId]
    );
    if (rowCount > 0) {
        await pool.query(
            "UPDATE tweets SET likes_count = GREATEST(likes_count - 1, 0) WHERE tweet_id = $1",
            [tweetId]
        );
    }
    return rowCount > 0;
};

const likeExists = async (userId, tweetId) => {
    const { rows } = await pool.query(
        "SELECT 1 FROM likes WHERE user_id = $1 AND tweet_id = $2",
        [userId, tweetId]
    );
    return rows.length > 0;
};

module.exports = { findById, insert, remove, insertLike, deleteLike, likeExists };
