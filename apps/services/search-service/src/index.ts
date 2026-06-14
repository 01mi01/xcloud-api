import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

import app from "./app";
import { ensureIndex, ensureUserIndex } from "./repositories/opensearch.repository";
import { startTweetIndexConsumer } from "./consumers/tweet-index.consumer";
import { startUserIndexConsumers } from "./consumers/user-index.consumer";

const PORT = parseInt(process.env.SEARCH_PORT ?? "3005");

const main = async (): Promise<void> => {
    // Ensure Elasticsearch indices exist (tweets + users)
    try {
        await ensureIndex();
        await ensureUserIndex();
        console.log("Search Service — Elasticsearch indices ready");
    } catch (err) {
        console.error("Failed to create ES indices:", (err as Error).message);
    }

    // Start Kafka consumers for tweet + user indexing
    try {
        await startTweetIndexConsumer();
        await startUserIndexConsumers();
        console.log("Search Service — Kafka consumers running");
    } catch (err) {
        console.error("Failed to start Kafka consumers:", (err as Error).message);
    }

    // Start HTTP server for search API
    app.listen(PORT, () => {
        console.log(`Search Service running on port ${PORT}`);
    });
};

main();
