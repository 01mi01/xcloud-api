import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

import app from "./app";
import { ensureIndex } from "./repositories/opensearch.repository";
import { startTweetIndexConsumer } from "./consumers/tweet-index.consumer";

const PORT = parseInt(process.env.SEARCH_PORT ?? "3005");

const main = async (): Promise<void> => {
    // Ensure Elasticsearch index exists
    try {
        await ensureIndex();
        console.log("Search Service — Elasticsearch index ready");
    } catch (err) {
        console.error("Failed to create ES index:", (err as Error).message);
    }

    // Start Kafka consumer for tweet indexing
    try {
        await startTweetIndexConsumer();
        console.log("Search Service — Kafka consumer running");
    } catch (err) {
        console.error("Failed to start Kafka consumer:", (err as Error).message);
    }

    // Start HTTP server for search API
    app.listen(PORT, () => {
        console.log(`Search Service running on port ${PORT}`);
    });
};

main();
