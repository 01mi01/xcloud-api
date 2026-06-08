import * as repo from "../repositories/notification.repository";
import * as wsPublisher from "../websocket/ws.publisher";

export interface LikeEvent {
    tweetId:   string;
    userId:    string;
    timestamp: string;
}

export interface FollowEvent {
    followerId:  string;
    followingId: string;
    timestamp:   string;
}

/**
 * Procesa un evento de like.
 * Diseño técnico §4.3:
 *   1. INSERT notificación en NotifDB
 *   2. Push al WebSocket si el usuario está conectado
 */
export const processLikeEvent = async (event: LikeEvent, tweetAuthorId: string): Promise<void> => {
    // No notificar si el usuario se da like a sí mismo
    if (event.userId === tweetAuthorId) return;

    const notification = await repo.insert(
        tweetAuthorId,
        event.userId,
        "like",
        event.tweetId
    );

    wsPublisher.pushToUser(tweetAuthorId, notification);
};

/**
 * Procesa un evento de follow.
 */
export const processFollowEvent = async (event: FollowEvent): Promise<void> => {
    const notification = await repo.insert(
        event.followingId,  // El seguido recibe la notificación
        event.followerId,   // El que siguió es el actor
        "follow",
        null
    );

    wsPublisher.pushToUser(event.followingId, notification);
};

/**
 * Obtiene las notificaciones de un usuario (para la API REST).
 */
export const getNotifications = async (
    userId: string,
    limit: number = 20,
    offset: number = 0
): Promise<repo.Notification[]> => {
    return repo.findByRecipient(userId, limit, offset);
};

/**
 * Marca una notificación como leída.
 */
export const markAsRead = async (notificationId: string, userId: string): Promise<boolean> => {
    return repo.markAsRead(notificationId, userId);
};
