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
            .catch(() => null) // tweet borrado o inexistente → ignorar
    );

    const results = await Promise.all(requests);

    return results.filter((t): t is HydratedTweet => t !== null);
};
