/**
 * Maps a raw PostgreSQL row to the User domain object.
 * All service/controller layers work with this shape, never raw DB rows.
 */
const fromRow = (row) => ({
    userId:         row.user_id,
    handle:         row.handle,
    displayName:    row.display_name,
    bio:            row.bio       ?? null,
    avatarUrl:      row.avatar_url ?? null,
    followersCount: parseInt(row.followers_count ?? 0),
    followingCount: parseInt(row.following_count ?? 0),
    createdAt:      row.created_at,
});

module.exports = { fromRow };
