import { Notification } from "../repositories/notification.repository";

// Map of userId → active WebSocket connections
// In production this would be AWS API Gateway WebSocket
const connections: Map<string, Set<{ send: (data: string) => void }>> = new Map();

/**
 * Register a WebSocket connection for a user.
 */
export const registerConnection = (userId: string, ws: { send: (data: string) => void }): void => {
    if (!connections.has(userId)) {
        connections.set(userId, new Set());
    }
    connections.get(userId)!.add(ws);
    console.log(`[ws] User ${userId} connected. Active: ${connections.get(userId)!.size}`);
};

/**
 * Remove a WebSocket connection for a user.
 */
export const removeConnection = (userId: string, ws: { send: (data: string) => void }): void => {
    const userConns = connections.get(userId);
    if (userConns) {
        userConns.delete(ws);
        if (userConns.size === 0) connections.delete(userId);
    }
};

/**
 * Push notification to user if they have an active connection.
 * If offline, the notification stays in DB and is delivered on reconnect.
 */
export const pushToUser = (userId: string, notification: Notification): void => {
    const userConns = connections.get(userId);
    if (userConns && userConns.size > 0) {
        const payload = JSON.stringify({
            type:     notification.type,
            actor:    notification.actorUserId,
            tweetId:  notification.refTweetId,
            notifId:  notification.id,
        });
        for (const ws of userConns) {
            try { ws.send(payload); } catch { /* connection dead, will be cleaned up */ }
        }
        console.log(`[ws] Pushed notification to user ${userId}`);
    } else {
        console.log(`[ws] User ${userId} offline — notification stored in DB`);
    }
};
