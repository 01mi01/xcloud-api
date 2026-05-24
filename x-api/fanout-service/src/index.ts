import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { startTweetCreatedConsumer } from "./consumers/tweet-created.consumer";

const main = async (): Promise<void> => {
    console.log("Fan-out Service starting...");

    try {
        await startTweetCreatedConsumer();
        console.log("Fan-out Service running — listening for events");
    } catch (err) {
        console.error("Fan-out Service failed to start:", (err as Error).message);
        process.exit(1);
    }
};

main();
