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

    try {
        await startTweetCreatedConsumer();
        console.log("Fan-out Service running — listening for events");
    } catch (err) {
        console.error("Fan-out Service failed to start:", (err as Error).message);
        process.exit(1);
    }
};

main();
