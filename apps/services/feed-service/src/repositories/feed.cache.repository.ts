import redis from "../config/redis.config";

const FEED_PREFIX     = "feed:";
const TWEET_PREFIX    = "tweet:";
const FEED_TTL        = 60 * 60 * 24;   // 24 horas
const TWEET_CACHE_TTL = 60 * 60;        // 1 hora
const FEED_MAX_LENGTH = 800;

/**
 * Obtiene los tweetIds del feed cache de un usuario.
 * Soporta paginación basada en cursor (offset numérico).
 */
export const getFeedTweetIds = async (
    userId: string,
    cursor: number,
    limit: number
): Promise<string[]> => {
    const key = `${FEED_PREFIX}${userId}`;
    const ids = await redis.lrange(key, cursor, cursor + limit - 1);
    return ids;
};

/**
 * Guarda una lista de tweetIds en el feed cache del usuario.
 * Usado al reconstruir el feed desde Cassandra (cache miss).
 */
export const setFeedTweetIds = async (userId: string, tweetIds: string[]): Promise<void> => {
    if (tweetIds.length === 0) return;

    const key = `${FEED_PREFIX}${userId}`;
    const pipeline = redis.pipeline();
    pipeline.del(key);
    pipeline.rpush(key, ...tweetIds);
    pipeline.ltrim(key, 0, FEED_MAX_LENGTH - 1);
    pipeline.expire(key, FEED_TTL);
    await pipeline.exec();
};

/**
 * Agrega un tweetId al inicio del feed de un usuario (fan-out on write).
 */
export const prependToFeed = async (userId: string, tweetId: string): Promise<void> => {
    const key = `${FEED_PREFIX}${userId}`;
    const pipeline = redis.pipeline();
    pipeline.lpush(key, tweetId);
    pipeline.ltrim(key, 0, FEED_MAX_LENGTH - 1);
    pipeline.expire(key, FEED_TTL);
    await pipeline.exec();
};

/**
 * Verifica si un feed cache existe para el usuario.
 */
export const feedExists = async (userId: string): Promise<boolean> => {
    const exists = await redis.exists(`${FEED_PREFIX}${userId}`);
    return exists === 1;
};

/**
 * Obtiene un tweet hidratado del cache secundario.
 */
export const getCachedTweet = async (tweetId: string): Promise<Record<string, string> | null> => {
    const key = `${TWEET_PREFIX}${tweetId}`;
    const data = await redis.hgetall(key);
    if (!data || Object.keys(data).length === 0) return null;
    return data;
};

/**
 * Cachea un tweet hidratado en Redis (TTL 1h).
 */
export const cacheTweet = async (tweetId: string, tweet: Record<string, string>): Promise<void> => {
    const key = `${TWEET_PREFIX}${tweetId}`;
    const pipeline = redis.pipeline();
    pipeline.hset(key, tweet);
    pipeline.expire(key, TWEET_CACHE_TTL);
    await pipeline.exec();
};
