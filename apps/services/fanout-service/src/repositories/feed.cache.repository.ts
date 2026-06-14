import redis from "../config/redis.config";

const FEED_PREFIX     = "feed:";
const FEED_TTL        = 60 * 60 * 24;   // 24 horas
const FEED_MAX_LENGTH = 800;

/**
 * Agrega un tweetId al inicio del feed cache de un usuario.
 * Corresponde al diseño técnico §4.1:
 *   Fan-out Service → Feed Cache (Redis): PREPEND tweetId al feed de cada follower
 *
 * Usa LPUSH + LTRIM para mantener el feed acotado a 800 entradas.
 */
export const prependToFeed = async (userId: string, tweetId: string): Promise<void> => {
    const key = `${FEED_PREFIX}${userId}`;
    const pipeline = redis.pipeline();
    // Remove any existing occurrence first so a redelivered/duplicate event (or a
    // create+retweet of the same tweet) can't put the tweetId in the feed twice.
    pipeline.lrem(key, 0, tweetId);
    pipeline.lpush(key, tweetId);
    pipeline.ltrim(key, 0, FEED_MAX_LENGTH - 1);
    pipeline.expire(key, FEED_TTL);
    await pipeline.exec();
};
