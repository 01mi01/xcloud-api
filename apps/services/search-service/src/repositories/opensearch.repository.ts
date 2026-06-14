import osClient, { TWEET_INDEX } from "../config/opensearch.config";

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
    const { body: exists } = await osClient.indices.exists({ index: TWEET_INDEX });
    if (!exists) {
        await osClient.indices.create({
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
    await osClient.index({
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
    const { body } = await osClient.search({
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

    const hits = body.hits.hits;
    const total = typeof body.hits.total === "number"
        ? body.hits.total
        : body.hits.total?.value ?? 0;

    const results: TweetDocument[] = hits.map((hit: { _source?: unknown }) => hit._source as TweetDocument);

    return { results, total };
};
