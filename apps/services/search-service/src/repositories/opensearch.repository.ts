import esClient, { TWEET_INDEX, USER_INDEX } from "../config/elasticsearch.config";

export interface TweetDocument {
    tweetId:   string;
    authorId:  string;
    content:   string;
    createdAt: string;
}

export interface UserDocument {
    userId:         string;
    handle:         string;
    displayName:    string;
    bio:            string | null;
    avatarUrl:      string | null;
    followersCount: number;
    followingCount: number;
    createdAt:      string;
}

/**
 * Ensure the tweets index exists with proper mapping.
 */
export const ensureIndex = async (): Promise<void> => {
    const { body: exists } = await esClient.indices.exists({ index: TWEET_INDEX });
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
 * Ensure the users index exists with proper mapping.
 */
export const ensureUserIndex = async (): Promise<void> => {
    const { body: exists } = await esClient.indices.exists({ index: USER_INDEX });
    if (!exists) {
        await esClient.indices.create({
            index: USER_INDEX,
            body: {
                mappings: {
                    properties: {
                        userId:         { type: "keyword" },
                        handle:         { type: "text", analyzer: "standard" },
                        displayName:    { type: "text", analyzer: "standard" },
                        bio:            { type: "text", analyzer: "standard" },
                        avatarUrl:      { type: "keyword" },
                        followersCount: { type: "integer" },
                        followingCount: { type: "integer" },
                        createdAt:      { type: "date" },
                    },
                },
            },
        });
        console.log(`[search-service] Created index: ${USER_INDEX}`);
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
 * Index (or re-index) a user document. Keyed by userId so user.updated events
 * overwrite the same document (idempotent upsert).
 */
export const indexUser = async (doc: UserDocument): Promise<void> => {
    await esClient.index({
        index: USER_INDEX,
        id:    doc.userId,
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

    const hits = response.body.hits.hits;
    const total = typeof response.body.hits.total === "number"
        ? response.body.hits.total
        : response.body.hits.total?.value ?? 0;

    const results: TweetDocument[] = hits.map((hit: { _source?: unknown }) => hit._source as TweetDocument);

    return { results, total };
};

/**
 * Search users by handle, display name or bio.
 * Corresponds to: GET /v1/search?q=...&type=users
 */
export const searchUsers = async (
    query: string,
    limit: number = 20,
    offset: number = 0
): Promise<{ results: UserDocument[]; total: number }> => {
    const response = await esClient.search({
        index: USER_INDEX,
        body: {
            query: {
                multi_match: {
                    query,
                    fields: ["handle^3", "displayName^2", "bio"],
                    fuzziness: "AUTO",
                },
            },
            sort: [{ followersCount: "desc" }],
            from: offset,
            size: limit,
        },
    });

    const hits = response.body.hits.hits;
    const total = typeof response.body.hits.total === "number"
        ? response.body.hits.total
        : response.body.hits.total?.value ?? 0;

    const results: UserDocument[] = hits.map((hit: { _source?: unknown }) => hit._source as UserDocument);

    return { results, total };
};
