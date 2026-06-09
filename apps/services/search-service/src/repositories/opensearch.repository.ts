import esClient, { TWEET_INDEX } from "../config/elasticsearch.config";

export interface TweetDocument {
    tweetId:   string;
    authorId:  string;
    content:   string;
    createdAt: string;
}

/**
 * Ensure the tweets index exists with proper mapping.
 */
export const ensureIndex = async (): Promise<void> => {
    const exists = await esClient.indices.exists({ index: TWEET_INDEX });
    if (!exists) {
        await esClient.indices.create({
            index: TWEET_INDEX,
            body: {
                mappings: {
                    properties: {
                        tweetId:   { type: "keyword" },
                        authorId:  { type: "keyword" },
                        content:   { type: "text", analyzer: "standard" },
                        createdAt: { type: "date" },
                    },
                },
            },
        });
        console.log(`[search-service] Created index: ${TWEET_INDEX}`);
    }
};

/**
 * Index a tweet document for full-text search.
 */
export const indexTweet = async (doc: TweetDocument): Promise<void> => {
    await esClient.index({
        index: TWEET_INDEX,
        id:    doc.tweetId,
        body:  doc,
    });
};

/**
 * Search tweets by keyword/hashtag.
 * Corresponds to: GET /v1/search?q=...&type=tweets
 */
export const searchTweets = async (
    query: string,
    limit: number = 20,
    offset: number = 0
): Promise<{ results: TweetDocument[]; total: number }> => {
    const response = await esClient.search({
        index: TWEET_INDEX,
        body: {
            query: {
                match: { content: { query, fuzziness: "AUTO" } },
            },
            sort: [{ createdAt: "desc" }],
            from: offset,
            size: limit,
        },
    });

    const hits = response.hits.hits;
    const total = typeof response.hits.total === "number"
        ? response.hits.total
        : response.hits.total?.value ?? 0;

    const results: TweetDocument[] = hits.map((hit: { _source?: unknown }) => hit._source as TweetDocument);

    return { results, total };
};
