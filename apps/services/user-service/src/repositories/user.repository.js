const pool = require("../config/db.config");
const { fromRow } = require("../models/user.model");

const WITH_COUNTS = `
    SELECT u.*,
        (SELECT COUNT(*) FROM follows WHERE following_id = u.user_id) AS followers_count,
        (SELECT COUNT(*) FROM follows WHERE follower_id  = u.user_id) AS following_count
    FROM users u
`;

const findByHandle = async (handle) => {
    const { rows } = await pool.query(`${WITH_COUNTS} WHERE u.handle = $1`, [handle]);
    return rows[0] ? fromRow(rows[0]) : null;
};

const findById = async (userId) => {
    const { rows } = await pool.query(`${WITH_COUNTS} WHERE u.user_id = $1`, [userId]);
    return rows[0] ? fromRow(rows[0]) : null;
};

const upsert = async (userId, handle) => {
    const { rows } = await pool.query(
        `INSERT INTO users (user_id, handle, display_name)
         VALUES ($1, $2, $2)
         ON CONFLICT (user_id) DO UPDATE SET handle = EXCLUDED.handle
         RETURNING *`,
        [userId, handle]
    );
    return fromRow({ ...rows[0], followers_count: 0, following_count: 0 });
};

const update = async (userId, fields) => {
    const sets = [];
    const values = [];
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

const insertFollow = async (followerId, followingId) => {
    await pool.query(
        `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)`,
        [followerId, followingId]
    );
};

const deleteFollow = async (followerId, followingId) => {
    const { rowCount } = await pool.query(
        `DELETE FROM follows WHERE follower_id = $1 AND following_id = $2`,
        [followerId, followingId]
    );
    return rowCount > 0;
};

const followExists = async (followerId, followingId) => {
    const { rows } = await pool.query(
        `SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2`,
        [followerId, followingId]
    );
    return rows.length > 0;
};

module.exports = { findByHandle, findById, upsert, update, insertFollow, deleteFollow, followExists };
