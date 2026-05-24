import * as esRepo from "../repositories/opensearch.repository";

export interface TweetCreatedEvent {
    tweetId:   string;
    authorId:  string;
    content:   string;
    createdAt: string;
}

/**
 * Index a tweet when a TweetCreated event is received from Kafka.
 * Corresponds to HU-28: indexación automática via Kafka.
 */
export const indexTweet = async (event: TweetCreatedEvent): Promise<void> => {
    await esRepo.indexTweet({
        tweetId:   event.tweetId,
        authorId:  event.authorId,
        content:   event.content,
        createdAt: event.createdAt,
    });
};

/**
 * Search tweets by keyword or hashtag.
 * Corresponds to: GET /v1/search?q=...&type=tweets
 */
export const searchTweets = async (
    query: string,
    limit: number = 20,
    offset: number = 0
): Promise<{ results: esRepo.TweetDocument[]; total: number }> => {
    return esRepo.searchTweets(query, limit, offset);
};
