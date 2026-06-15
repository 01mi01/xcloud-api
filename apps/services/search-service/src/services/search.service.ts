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

// El user-service/auth-service publican estos eventos para mantener el índice
// de usuarios. user.created trae el perfil recién creado (bio/avatar nulos);
// user.updated trae el perfil actualizado.
export interface UserEvent {
    userId:          string;
    handle:          string;
    displayName:     string;
    bio?:            string | null;
    avatarUrl?:      string | null;
    followersCount?: number;
    followingCount?: number;
    createdAt:       string;
}

/**
 * Index (or re-index) a user when a user.created / user.updated event arrives.
 */
export const indexUser = async (event: UserEvent): Promise<void> => {
    await esRepo.indexUser({
        userId:         event.userId,
        handle:         event.handle,
        displayName:    event.displayName,
        bio:            event.bio ?? null,
        avatarUrl:      event.avatarUrl ?? null,
        followersCount: event.followersCount ?? 0,
        followingCount: event.followingCount ?? 0,
        createdAt:      event.createdAt,
    });
};

/**
 * Search users by handle / display name / bio.
 * Corresponds to: GET /v1/search?q=...&type=users
 */
export const searchUsers = async (
    query: string,
    limit: number = 20,
    offset: number = 0
): Promise<{ results: esRepo.UserDocument[]; total: number }> => {
    return esRepo.searchUsers(query, limit, offset);
};
