import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import app from "./app";
import { startLikeConsumer } from "./consumers/like.consumer";
import { startFollowConsumer } from "./consumers/follow.consumer";

const PORT = parseInt(process.env.NOTIFICATION_PORT ?? "3004");

const main = async (): Promise<void> => {
    // Start Kafka consumers
    try {
        await startLikeConsumer();
        await startFollowConsumer();
        console.log("Notification Service — Kafka consumers running");
    } catch (err) {
        console.error("Failed to start Kafka consumers:", (err as Error).message);
    }

    // Start HTTP server for REST API (GET notifications, mark as read)
    app.listen(PORT, () => {
        console.log(`Notification Service running on port ${PORT}`);
    });
};

main();
