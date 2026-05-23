require("dotenv").config({ path: require("path").resolve(__dirname, "../../../../.env") });
const { Pool } = require("pg");

const pool = new Pool({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

const getUserByHandle = async (handle) => {
    const { rows } = await pool.query(
        `SELECT u.*,
            (SELECT COUNT(*) FROM follows WHERE following_id = u.user_id) AS followers_count,
            (SELECT COUNT(*) FROM follows WHERE follower_id  = u.user_id) AS following_count
         FROM users u WHERE u.handle = $1`,
        [handle]
    );
    return rows[0] ? mapUser(rows[0]) : null;
};

const getUserById = async (userId) => {
    const { rows } = await pool.query(
        `SELECT u.*,
            (SELECT COUNT(*) FROM follows WHERE following_id = u.user_id) AS followers_count,
            (SELECT COUNT(*) FROM follows WHERE follower_id  = u.user_id) AS following_count
         FROM users u WHERE u.user_id = $1`,
        [userId]
    );
    return rows[0] ? mapUser(rows[0]) : null;
};

const createUser = async (userId, handle) => {
    const { rows } = await pool.query(
        `INSERT INTO users (user_id, handle, display_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO NOTHING
         RETURNING *`,
        [userId, handle, handle]
    );
    return rows[0] ? { ...mapUser(rows[0]), followersCount: 0, followingCount: 0 } : null;
};

const updateUser = async (userId, fields) => {
    const updates = [];
    const values = [];
    let i = 1;

    if (fields.displayName !== undefined) { updates.push(`display_name = $${i++}`); values.push(fields.displayName); }
    if (fields.bio         !== undefined) { updates.push(`bio = $${i++}`);          values.push(fields.bio); }
    if (fields.avatarUrl   !== undefined) { updates.push(`avatar_url = $${i++}`);   values.push(fields.avatarUrl); }

    if (updates.length === 0) return null;

    values.push(userId);
    const { rows } = await pool.query(
        `UPDATE users SET ${updates.join(", ")} WHERE user_id = $${i} RETURNING *`,
        values
    );
    if (!rows[0]) return null;

    return getUserById(userId);
};

const followUser = async (followerId, userId) => {
    const target = await getUserById(userId);
    if (!target) throw new Error("User not found");

    try {
        await pool.query(
            `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)`,
            [followerId, userId]
        );
    } catch (err) {
        if (err.code === "23505") throw new Error("Already following this user");
        throw err;
    }
};

const unfollowUser = async (followerId, userId) => {
    const target = await getUserById(userId);
    if (!target) throw new Error("User not found");

    await pool.query(
        `DELETE FROM follows WHERE follower_id = $1 AND following_id = $2`,
        [followerId, userId]
    );
};

const mapUser = (row) => ({
    userId:         row.user_id,
    handle:         row.handle,
    displayName:    row.display_name,
    bio:            row.bio,
    avatarUrl:      row.avatar_url,
    followersCount: parseInt(row.followers_count ?? 0),
    followingCount: parseInt(row.following_count ?? 0),
    createdAt:      row.created_at,
});

module.exports = { getUserByHandle, getUserById, createUser, updateUser, followUser, unfollowUser };
