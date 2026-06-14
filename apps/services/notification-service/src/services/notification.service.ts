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

export interface RetweetEvent {
    tweetId:      string;
    userId:       string;   // quien retweeteó (actor)
    targetUserId: string;   // autor del tweet (destinatario)
    timestamp:    string;
}

export interface ReplyEvent {
    replyTweetId:  string;  // el tweet de respuesta
    parentTweetId: string;  // el tweet al que se respondió
    userId:        string;  // quien respondió (actor)
    targetUserId:  string;  // autor del tweet padre (destinatario)
    timestamp:     string;
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
 * Procesa un evento de retweet.
 */
export const processRetweetEvent = async (event: RetweetEvent): Promise<void> => {
    if (event.userId === event.targetUserId) return; // no notificar self-retweet

    const notification = await repo.insert(
        event.targetUserId,  // el autor del tweet recibe la notificación
        event.userId,        // quien retweeteó es el actor
        "retweet",
        event.tweetId
    );

    wsPublisher.pushToUser(event.targetUserId, notification);
};

/**
 * Procesa un evento de reply.
 */
export const processReplyEvent = async (event: ReplyEvent): Promise<void> => {
    if (event.userId === event.targetUserId) return; // no notificar self-reply

    const notification = await repo.insert(
        event.targetUserId,    // el autor del tweet padre recibe la notificación
        event.userId,          // quien respondió es el actor
        "reply",
        event.parentTweetId    // el tweet al que respondieron
    );

    wsPublisher.pushToUser(event.targetUserId, notification);
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
