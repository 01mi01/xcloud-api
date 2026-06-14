import * as followerRepo from "../repositories/follower.repository";
import * as feedCacheRepo from "../repositories/feed.cache.repository";

export interface TweetCreatedEvent {
    tweetId:   string;
    authorId:  string;
    content:   string;
    createdAt: string;
}

/**
 * Procesa un evento TweetCreated.
 *
 * Flujo (según diseño técnico §4.1):
 *   1. Obtiene la lista de followers del autor desde PostgreSQL
 *   2. Para cada follower, hace LPUSH del tweetId en su feed cache en Redis
 *
 * Esto es "fan-out on write": el feed se pre-computa al momento de publicar,
 * no cuando el follower lo consulta.
 */
export const processTweetCreated = async (event: TweetCreatedEvent): Promise<void> => {
    const { tweetId, authorId } = event;

    // Paso 1: Obtener followers del autor
    const followerIds = await followerRepo.getFollowerIds(authorId);

    // El autor siempre ve sus propios tweets en su feed, aunque no se siga
    // a sí mismo. Incluimos su userId en la lista de destinos del fan-out.
    const recipients = Array.from(new Set([authorId, ...followerIds]));

    console.log(`[fanout-service] Fan-out tweet ${tweetId} to ${recipients.length} recipients (author + ${followerIds.length} followers)`);

    // Paso 2: Escribir en el feed cache de cada destinatario
    // En paralelo para mejor performance
    await Promise.all(
        recipients.map((recipientId) =>
            feedCacheRepo.prependToFeed(recipientId, tweetId)
        )
    );

    console.log(`[fanout-service] Fan-out complete for tweet ${tweetId}`);
};

export interface TweetRetweetedEvent {
    tweetId:     string;
    retweeterId: string;
    authorId:    string;
    timestamp:   string;
}

/**
 * Procesa un evento TweetRetweeted.
 *
 * Un retweet inserta el tweet ORIGINAL en el feed de los followers de quien
 * retuitea (y en el suyo propio), igual que el fan-out de un tweet nuevo pero
 * usando al retweeter como origen en vez del autor.
 */
export const processTweetRetweeted = async (event: TweetRetweetedEvent): Promise<void> => {
    const { tweetId, retweeterId } = event;

    const followerIds = await followerRepo.getFollowerIds(retweeterId);
    const recipients = Array.from(new Set([retweeterId, ...followerIds]));

    console.log(`[fanout-service] Retweet fan-out tweet ${tweetId} to ${recipients.length} recipients (retweeter + ${followerIds.length} followers)`);

    await Promise.all(
        recipients.map((recipientId) =>
            feedCacheRepo.prependToFeed(recipientId, tweetId)
        )
    );

    console.log(`[fanout-service] Retweet fan-out complete for tweet ${tweetId}`);
};
