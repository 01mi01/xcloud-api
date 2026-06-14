import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

import app from "./app";
import { ensureIndex, ensureUserIndex } from "./repositories/opensearch.repository";
import { startTweetIndexConsumer } from "./consumers/tweet-index.consumer";
import { startUserIndexConsumers } from "./consumers/user-index.consumer";

const PORT = parseInt(process.env.SEARCH_PORT ?? "3005");

// OpenSearch ResponseError.message is just "Response Error" — the useful detail
// (status code + body) lives on err.meta. Surface it so failures are diagnosable.
const describeErr = (err: unknown): string => {
    const e = err as { meta?: { statusCode?: number; body?: unknown }; message?: string };
    if (e?.meta) {
        return `status=${e.meta.statusCode} body=${JSON.stringify(e.meta.body)}`;
    }
    return e?.message ?? String(err);
};

const main = async (): Promise<void> => {
    // Start the HTTP server FIRST so the ALB health check (GET /health) passes
    // immediately — independent of whether OpenSearch is reachable yet. Otherwise
    // a slow/blocked connection to the search backend delays app.listen, the
    // target stays unhealthy, and ECS trips the deployment circuit breaker.
    app.listen(PORT, () => {
        console.log(`Search Service running on port ${PORT}`);
    });

    // Ensure the search indices exist (tweets + users). Best-effort: never block
    // startup or crash the process if the backend isn't reachable yet.
    try {
        await ensureIndex();
        await ensureUserIndex();
        console.log("Search Service — search indices ready");
    } catch (err) {
        console.error("Failed to create search indices:", describeErr(err));
    }

    // Start event consumers for tweet + user indexing (Kafka local / SQS prod).
    // In prod each consume() is an infinite SQS long-poll loop that never resolves,
    // so they must be started CONCURRENTLY (fire-and-forget) — awaiting them
    // sequentially would start only the tweet consumer and never the user ones
    // (the bug that left the user search index permanently empty). Per-message
    // errors are handled inside consume().
    startTweetIndexConsumer().catch((err) => console.error("Tweet index consumer failed:", describeErr(err)));
    startUserIndexConsumers().catch((err) => console.error("User index consumers failed:", describeErr(err)));
    console.log("Search Service — index consumers started");
};

main();
