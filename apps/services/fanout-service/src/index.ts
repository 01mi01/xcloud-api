import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

import { startTweetCreatedConsumer } from "./consumers/tweet-created.consumer";
import { startHealthServer } from "./health-server";

const main = async (): Promise<void> => {
    console.log("Fan-out Service starting...");

    // Start the health endpoint first — in production the SQS consumer is a
    // blocking poll loop, so this must be listening before we enter it.
    startHealthServer();

    // Start the consumer — retry up to 5 times to tolerate slow broker startup.
    // On `docker compose up`, Kafka may still be electing the tweet.created
    // partition leader when we subscribe, surfacing a transient
    // "This server does not host this topic-partition". Retry instead of
    // exiting so the worker recovers on its own.
    const startConsumer = async (attempt = 1): Promise<void> => {
        try {
            await startTweetCreatedConsumer();
            console.log("Fan-out Service running — listening for events");
        } catch (err) {
            if (attempt >= 5) {
                console.error("Fan-out Service failed to start after 5 attempts:", (err as Error).message);
                process.exit(1);
            }
            const delay = attempt * 3000;
            console.warn(`Consumer start failed (attempt ${attempt}), retrying in ${delay / 1000}s...`);
            await new Promise(res => setTimeout(res, delay));
            return startConsumer(attempt + 1);
        }
    };

    await startConsumer();
};

main();
