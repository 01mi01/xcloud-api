import pool from "../config/db.config";
import { fromRow, User } from "../models/user.model";

const WITH_COUNTS = `
    SELECT u.*,
        (SELECT COUNT(*) FROM follows WHERE following_id = u.user_id) AS followers_count,
        (SELECT COUNT(*) FROM follows WHERE follower_id  = u.user_id) AS following_count
    FROM users u
`;

export const findByHandle = async (handle: string): Promise<User | null> => {
    const { rows } = await pool.query(`${WITH_COUNTS} WHERE u.handle = $1`, [handle]);
    return rows[0] ? fromRow(rows[0]) : null;
};

export const findById = async (userId: string): Promise<User | null> => {
    const { rows } = await pool.query(`${WITH_COUNTS} WHERE u.user_id = $1`, [userId]);
    return rows[0] ? fromRow(rows[0]) : null;
};

// All users (capped) — used to backfill the search index (republish user.updated).
export const findAll = async (limit = 1000): Promise<User[]> => {
    const { rows } = await pool.query(`${WITH_COUNTS} ORDER BY u.handle LIMIT $1`, [limit]);
    return rows.map(fromRow);
};

export const upsert = async (userId: string, handle: string): Promise<User> => {
    const { rows } = await pool.query(
        `INSERT INTO users (user_id, handle, display_name)
         VALUES ($1, $2, $2)
         ON CONFLICT (user_id) DO UPDATE SET handle = EXCLUDED.handle
         RETURNING *`,
        [userId, handle]
    );
    return fromRow({ ...rows[0], followers_count: 0, following_count: 0 });
};

export interface UpdateFields {
    displayName?: string;
    bio?:         string;
    avatarUrl?:   string;
}

export const update = async (userId: string, fields: UpdateFields): Promise<User | null> => {
    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (fields.displayName !== undefined) { sets.push(`display_name = $${i++}`); values.push(fields.displayName); }
    if (fields.bio         !== undefined) { sets.push(`bio = $${i++}`);          values.push(fields.bio); }
    if (fields.avatarUrl   !== undefined) { sets.push(`avatar_url = $${i++}`);   values.push(fields.avatarUrl); }

    values.push(userId);
    const { rows } = await pool.query(
        `UPDATE users SET ${sets.join(", ")} WHERE user_id = $${i} RETURNING *`,
        values
    );
    if (!rows[0]) return null;
    return findById(userId);
};

export const search = async (query: string): Promise<User[]> => {
    const q = `%${query.toLowerCase()}%`;
    const { rows } = await pool.query(
        `${WITH_COUNTS} WHERE LOWER(u.handle) LIKE $1 OR LOWER(u.display_name) LIKE $1 ORDER BY u.display_name LIMIT 20`,
        [q]
    );
    return rows.map(fromRow);
};

export const insertFollow = async (followerId: string, followingId: string): Promise<void> => {
    await pool.query(
        `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)`,
        [followerId, followingId]
    );
};

export const deleteFollow = async (followerId: string, followingId: string): Promise<boolean> => {
    const { rowCount } = await pool.query(
        `DELETE FROM follows WHERE follower_id = $1 AND following_id = $2`,
        [followerId, followingId]
    );
    return (rowCount ?? 0) > 0;
};

// Of `candidateIds`, which ones does `followerId` already follow.
export const getFollowedSubset = async (followerId: string, candidateIds: string[]): Promise<string[]> => {
    if (candidateIds.length === 0) return [];
    const { rows } = await pool.query(
        `SELECT following_id FROM follows WHERE follower_id = $1 AND following_id = ANY($2)`,
        [followerId, candidateIds]
    );
    return rows.map((r: { following_id: string }) => r.following_id);
};

export const followExists = async (followerId: string, followingId: string): Promise<boolean> => {
    const { rows } = await pool.query(
        `SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2`,
        [followerId, followingId]
    );
    return rows.length > 0;
};

export const getFollowing = async (userId: string): Promise<User[]> => {
    const { rows } = await pool.query(
        `${WITH_COUNTS} INNER JOIN follows f ON u.user_id = f.following_id WHERE f.follower_id = $1 ORDER BY u.display_name`,
        [userId]
    );
    return rows.map(fromRow);
};

export const getFollowers = async (userId: string): Promise<User[]> => {
    const { rows } = await pool.query(
        `${WITH_COUNTS} INNER JOIN follows f ON u.user_id = f.follower_id WHERE f.following_id = $1 ORDER BY u.display_name`,
        [userId]
    );
    return rows.map(fromRow);
};
