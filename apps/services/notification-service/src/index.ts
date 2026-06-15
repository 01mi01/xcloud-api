import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

import { ensurePostgresSchema } from "@xcloud/shared";
import app from "./app";
import pool from "./config/db.config";
import { startLikeConsumer } from "./consumers/like.consumer";
import { startFollowConsumer } from "./consumers/follow.consumer";
import { startRetweetConsumer } from "./consumers/retweet.consumer";
import { startReplyConsumer } from "./consumers/reply.consumer";
import { startMentionConsumer } from "./consumers/mention.consumer";
import { attachWebSocketServer } from "./websocket/ws.server";

const PORT = parseInt(process.env.NOTIFICATION_PORT ?? "3004");

const main = async (): Promise<void> => {
    // Start the HTTP server FIRST so the ALB health check (GET /health) passes
    // immediately. Blocking on the DB here would delay listening and trip the ECS
    // deployment circuit breaker if RDS is slow/unreachable.
    const server = app.listen(PORT, () => {
        console.log(`Notification Service running on port ${PORT}`);
    });
    attachWebSocketServer(server);

    // Ensure the PG schema in the background (idempotent, retries internally).
    ensurePostgresSchema(pool).catch((err) => console.error("[schema]", (err as Error).message));

    // Start event consumers — retry up to 5 times to tolerate slow broker startup.
    const startConsumers = async (attempt = 1): Promise<void> => {
        try {
            // Start concurrently: in production each consumer long-polls its own
            // SQS queue (a blocking loop), so they must not be awaited sequentially.
            // like + follow + retweet always start (retweet uses our SNS fan-out
            // queue NOTIFY_RETWEET_QUEUE_URL); reply + mention only when their
            // direct SQS queue URL is configured.
            const consumers = [startLikeConsumer(), startFollowConsumer(), startRetweetConsumer()];
            if (process.env.REPLY_EVENT_QUEUE_URL)   consumers.push(startReplyConsumer());
            if (process.env.MENTION_EVENT_QUEUE_URL) consumers.push(startMentionConsumer());
            await Promise.all(consumers);
            console.log("Notification Service — event consumers running");
        } catch (err) {
            if (attempt >= 5) {
                console.error("Failed to start event consumers after 5 attempts:", (err as Error).message);
                return;
            }
            const delay = attempt * 3000;
            console.warn(`Consumer start failed (attempt ${attempt}), retrying in ${delay / 1000}s...`);
            await new Promise(res => setTimeout(res, delay));
            return startConsumers(attempt + 1);
        }
    };
    startConsumers();
};

main();
