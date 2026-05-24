/**
 * Tweet event producer — publishes domain events to Kafka (MSK).
 *
 * DISABLED in local dev — Kafka (MSK) is not running locally.
 * Enable when deploying to AWS by uncommenting the Kafka block below
 * and setting KAFKA_BROKERS in the environment.
 *
 * Events published:
 *   - tweet.created  → consumed by fanout-service and search-service
 *   - tweet.liked    → consumed by notification-service
 */

// ── Kafka (disabled) ──────────────────────────────────────────────────────────
// const { Kafka } = require("kafkajs");
// const kafka = new Kafka({ brokers: process.env.KAFKA_BROKERS.split(",") });
// const producer = kafka.producer();
// await producer.connect();
// ─────────────────────────────────────────────────────────────────────────────

const publishTweetCreated = async (tweet) => {
    // TODO: await producer.send({ topic: "tweet.created", messages: [{ value: JSON.stringify(tweet) }] });
    console.log("[tweet.producer] tweet.created (stub):", tweet.tweetId);
};

const publishTweetLiked = async ({ tweetId, userId }) => {
    // TODO: await producer.send({ topic: "tweet.liked", messages: [{ value: JSON.stringify({ tweetId, userId }) }] });
    console.log("[tweet.producer] tweet.liked (stub):", tweetId, userId);
};

module.exports = { publishTweetCreated, publishTweetLiked };
