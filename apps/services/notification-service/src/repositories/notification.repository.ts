import { v4 as uuidv4 } from "uuid";
import pool from "../config/db.config";

export interface Notification {
    id:              string;
    recipientUserId: string;
    actorUserId:     string;
    type:            string;    // "like" | "retweet" | "follow" | "mention"
    refTweetId:      string | null;
    read:            boolean;
    createdAt:       string;
}

export const insert = async (
    recipientUserId: string,
    actorUserId: string,
    type: string,
    refTweetId: string | null
): Promise<Notification> => {
    const id = uuidv4();
    const { rows } = await pool.query(
        `INSERT INTO notifications (id, recipient_user_id, actor_user_id, type, ref_tweet_id, read, created_at)
         VALUES ($1, $2, $3, $4, $5, false, NOW())
         RETURNING *`,
        [id, recipientUserId, actorUserId, type, refTweetId]
    );
    return mapRow(rows[0]);
};

export const findByRecipient = async (
    recipientUserId: string,
    limit: number = 20,
    offset: number = 0
): Promise<Notification[]> => {
    const { rows } = await pool.query(
        `SELECT * FROM notifications
         WHERE recipient_user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [recipientUserId, limit, offset]
    );
    return rows.map(mapRow);
};

export const markAsRead = async (notificationId: string, userId: string): Promise<boolean> => {
    const { rowCount } = await pool.query(
        `UPDATE notifications SET read = true WHERE id = $1 AND recipient_user_id = $2`,
        [notificationId, userId]
    );
    return (rowCount ?? 0) > 0;
};

const mapRow = (row: Record<string, unknown>): Notification => ({
    id:              row.id as string,
    recipientUserId: row.recipient_user_id as string,
    actorUserId:     row.actor_user_id as string,
    type:            row.type as string,
    refTweetId:      (row.ref_tweet_id as string) ?? null,
    read:            row.read as boolean,
    createdAt:       (row.created_at as Date).toISOString(),
});
