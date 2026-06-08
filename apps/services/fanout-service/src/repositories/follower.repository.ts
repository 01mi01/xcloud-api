import pool from "../config/db.config";

/**
 * Obtiene los IDs de todos los followers de un usuario.
 * Lee de PostgreSQL (tabla follows).
 *
 * En el diseño técnico esto corresponde a:
 *   Fan-out Service → User DB: GET followers de userId
 */
export const getFollowerIds = async (userId: string): Promise<string[]> => {
    const { rows } = await pool.query(
        "SELECT follower_id FROM follows WHERE following_id = $1",
        [userId]
    );
    return rows.map((r: { follower_id: string }) => r.follower_id);
};
