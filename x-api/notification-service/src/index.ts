import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import app from "./app";
import { startLikeConsumer } from "./consumers/like.consumer";
import { startFollowConsumer } from "./consumers/follow.consumer";

const PORT = parseInt(process.env.NOTIFICATION_PORT ?? "3004");

const main = async (): Promise<void> => {
    // Start Kafka consumers — retry up to 5 times to tolerate slow broker startup
    const startConsumers = async (attempt = 1): Promise<void> => {
        try {
            await startLikeConsumer();
            await startFollowConsumer();
            console.log("Notification Service — Kafka consumers running");
        } catch (err) {
            if (attempt >= 5) {
                console.error("Failed to start Kafka consumers after 5 attempts:", (err as Error).message);
                return;
            }
            const delay = attempt * 3000;
            console.warn(`Kafka consumer start failed (attempt ${attempt}), retrying in ${delay / 1000}s...`);
            await new Promise(res => setTimeout(res, delay));
            return startConsumers(attempt + 1);
        }
    };
    startConsumers();

    // Start HTTP server for REST API (GET notifications, mark as read)
    app.listen(PORT, () => {
        console.log(`Notification Service running on port ${PORT}`);
    });
};

main();
