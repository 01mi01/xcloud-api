export interface User {
    userId:         string;
    handle:         string;
    displayName:    string;
    bio:            string | null;
    avatarUrl:      string | null;
    followersCount: number;
    followingCount: number;
    createdAt:      Date | string;
}

export interface UserRow {
    user_id:         string;
    handle:          string;
    display_name:    string;
    bio?:            string | null;
    avatar_url?:     string | null;
    followers_count?: string | number;
    following_count?: string | number;
    created_at:      Date | string;
}

export const fromRow = (row: UserRow): User => ({
    userId:         row.user_id,
    handle:         row.handle,
    displayName:    row.display_name,
    bio:            row.bio ?? null,
    avatarUrl:      row.avatar_url ?? null,
    followersCount: parseInt(String(row.followers_count ?? 0)),
    followingCount: parseInt(String(row.following_count ?? 0)),
    createdAt:      row.created_at,
});
