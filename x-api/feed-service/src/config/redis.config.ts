import path from "path";
import dotenv from "dotenv";
import Redis from "ioredis";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

const redis = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT ?? "6379"),
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
        const delay = Math.min(times * 200, 2000);
        return delay;
    },
});

redis.on("error", (err) => {
    console.error("[feed-service] Redis connection error:", err.message);
});

redis.on("connect", () => {
    console.log("[feed-service] Connected to Redis");
});

export default redis;
