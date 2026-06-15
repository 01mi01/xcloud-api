import path from "path";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config({ path: path.resolve(__dirname, "../../../../../.env") });

const TWEET_SERVICE_URL = process.env.TWEET_SERVICE_URL || "http://localhost:3002";

export interface HydratedTweet {
    tweetId:        string;
    content:        string;
    authorId:       string;
    mediaUrls:      string[];
    replyToTweetId: string | null;
    likesCount:     number;
    retweetCount:   number;
    repliesCount:   number;
    createdAt:      string;
}

/**
 * Hidrata una lista de tweetIds llamando al Tweet Service.
 *
 * En producción esto sería gRPC (rpc GetTweetsByIds).
 * En dev local usamos HTTP al Tweet Service para simplificar.
 */
export const getTweetsByIds = async (tweetIds: string[]): Promise<HydratedTweet[]> => {
    if (tweetIds.length === 0) return [];

    // Llamar en paralelo al endpoint GET /v1/tweets/:tweetId del Tweet Service
    const requests = tweetIds.map((id) =>
        axios
            .get<{ tweet: HydratedTweet }>(`${TWEET_SERVICE_URL}/v1/tweets/${id}`)
            .then((res) => res.data.tweet)
            .catch((err) => {
                // 404 = tweet borrado/inexistente → esperado, ignorar en silencio.
                // Cualquier otra cosa (ECONNREFUSED por TWEET_SERVICE_URL mal
                // configurado, 5xx, timeout) vacía el feed silenciosamente: loguear.
                const status = (err as { response?: { status?: number } })?.response?.status;
                if (status !== 404) {
                    console.error(`[feed-service] hydrate ${id} failed:`, status ?? (err as Error).message);
                }
                return null;
            })
    );

    const results = await Promise.all(requests);

    return results.filter((t): t is HydratedTweet => t !== null);
};
