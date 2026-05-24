import path from "path";
import dotenv from "dotenv";
import Redis from "ioredis";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

const redis = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT ?? "6379"),
    maxRetriesPerRequest: 3,
});

redis.on("error", (err) => {
    console.error("[fanout-service] Redis connection error:", err.message);
});

redis.on("connect", () => {
    console.log("[fanout-service] Connected to Redis");
});

export default redis;
