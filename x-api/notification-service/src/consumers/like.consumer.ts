import kafka from "../config/kafka.config";
import { processLikeEvent, LikeEvent } from "../services/notification.service";

const TOPIC    = "tweet.liked";
const GROUP_ID = "notification-service-group";

export const startLikeConsumer = async (): Promise<void> => {
    const consumer = kafka.consumer({ groupId: GROUP_ID, sessionTimeout: 30000 });

    await consumer.connect();
    await consumer.subscribe({ topic: TOPIC, fromBeginning: false });

    console.log(`[notification-service] Like consumer subscribed to: ${TOPIC}`);

    await consumer.run({
        eachMessage: async ({ message }) => {
            if (!message.value) return;

            try {
                const event: LikeEvent & { targetUserId?: string } = JSON.parse(message.value.toString());
                console.log(`[notification-service] Like event: user ${event.userId} liked tweet ${event.tweetId}`);

                // El targetUserId viene del evento si el producer lo incluye,
                // de lo contrario usamos el key del mensaje como fallback
                const tweetAuthorId = event.targetUserId ?? message.key?.toString() ?? "";

                await processLikeEvent(event, tweetAuthorId);
            } catch (err) {
                console.error("[notification-service] Error processing like event:", (err as Error).message);
            }
        },
    });
};
