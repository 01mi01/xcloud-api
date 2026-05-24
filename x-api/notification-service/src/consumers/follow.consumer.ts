import kafka from "../config/kafka.config";
import { processFollowEvent, FollowEvent } from "../services/notification.service";

const TOPIC    = "user.followed";
const GROUP_ID = "notification-service-follow-group";

export const startFollowConsumer = async (): Promise<void> => {
    const consumer = kafka.consumer({ groupId: GROUP_ID });

    await consumer.connect();
    await consumer.subscribe({ topic: TOPIC, fromBeginning: false });

    console.log(`[notification-service] Follow consumer subscribed to: ${TOPIC}`);

    await consumer.run({
        eachMessage: async ({ message }) => {
            if (!message.value) return;

            try {
                const event: FollowEvent = JSON.parse(message.value.toString());
                console.log(`[notification-service] Follow event: ${event.followerId} followed ${event.followingId}`);

                await processFollowEvent(event);
            } catch (err) {
                console.error("[notification-service] Error processing follow event:", (err as Error).message);
            }
        },
    });
};
