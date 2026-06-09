import * as cacheRepo from "../repositories/feed.cache.repository";
import * as dbRepo from "../repositories/feed.db.repository";
import * as tweetClient from "../grpc/tweet.client";
import { HydratedTweet } from "../grpc/tweet.client";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 100;
const REBUILD_LIMIT = 800;

export interface FeedResult {
    tweets:     HydratedTweet[];
    nextCursor: string | null;
}

/**
 * Obtiene el feed personalizado del usuario.
 *
 * Flujo (según diseño técnico §4.2):
 *   1. Busca en Redis → feed:{userId} (lista de tweetIds)
 *   2. Si cache miss → reconstruye desde Cassandra (tweets de followings)
 *      y guarda en Redis con TTL 24h
 *   3. Hidrata tweetIds llamando al Tweet Service via HTTP (gRPC en prod)
 *   4. Retorna tweets[] + nextCursor para paginación
 */
export const getFeed = async (
    userId: string,
    cursorParam?: string,
    limitParam?: number
): Promise<FeedResult> => {
    const limit  = Math.min(Math.max(limitParam ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const cursor = parseInt(cursorParam ?? "0", 10) || 0;

    // ── Paso 1: Verificar cache en Redis ─────────────────
    const cacheExists = await cacheRepo.feedExists(userId);

    let tweetIds: string[];

    if (cacheExists) {
        // Cache HIT
        tweetIds = await cacheRepo.getFeedTweetIds(userId, cursor, limit);
    } else {
        // ── Paso 2: Cache MISS → reconstruir desde DB ────
        const followingIds = await dbRepo.getFollowingIds(userId);
        // Incluir al propio usuario para que vea sus propios tweets en su feed
        // (no se requiere que se siga a sí mismo en la tabla follows).
        const authorIds   = Array.from(new Set([userId, ...followingIds]));
        const allTweetIds = await dbRepo.rebuildFeedFromDb(authorIds, REBUILD_LIMIT);

        // Guardar en Redis para próximas lecturas
        await cacheRepo.setFeedTweetIds(userId, allTweetIds);

        // Paginar sobre los resultados
        tweetIds = allTweetIds.slice(cursor, cursor + limit);
    }

    if (tweetIds.length === 0) {
        return { tweets: [], nextCursor: null };
    }

    // ── Paso 3: Hidratar tweetIds via Tweet Service ──────
    const tweets = await tweetClient.getTweetsByIds(tweetIds);

    // ── Paso 4: Calcular nextCursor ──────────────────────
    const nextOffset = cursor + limit;
    const nextCursor = tweetIds.length === limit ? String(nextOffset) : null;

    return { tweets, nextCursor };
};
