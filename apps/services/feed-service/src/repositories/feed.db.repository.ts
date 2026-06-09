import cassandraClient from "../config/cassandra.config";
import pgPool from "../config/db.config";
import cassandra from "cassandra-driver";

/**
 * Obtiene los IDs de las cuentas que un usuario sigue.
 * Lee de PostgreSQL (tabla follows).
 */
export const getFollowingIds = async (userId: string): Promise<string[]> => {
    const { rows } = await pgPool.query(
        "SELECT following_id FROM follows WHERE follower_id = $1",
        [userId]
    );
    return rows.map((r: { following_id: string }) => r.following_id);
};

/**
 * Reconstruye el feed consultando tweets de las cuentas seguidas.
 * Lee de Cassandra (tabla tweets_by_author), ordenado por created_at DESC.
 * Retorna los tweetIds.
 */
export const rebuildFeedFromDb = async (
    followingIds: string[],
    limit: number
): Promise<string[]> => {
    if (followingIds.length === 0) return [];

    // Consultar tweets de cada autor en paralelo
    const queries = followingIds.map((authorId) =>
        cassandraClient.execute(
            "SELECT tweet_id, created_at FROM tweets_by_author WHERE author_id = ? LIMIT ?",
            [cassandra.types.Uuid.fromString(authorId), limit],
            { prepare: true }
        )
    );

    const results = await Promise.all(queries);

    // Unificar y ordenar por created_at DESC
    const allTweets: { tweetId: string; createdAt: Date }[] = [];
    for (const result of results) {
        for (const row of result.rows) {
            allTweets.push({
                tweetId:   row.tweet_id.toString(),
                createdAt: row.created_at,
            });
        }
    }

    allTweets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return allTweets.slice(0, limit).map((t) => t.tweetId);
};
