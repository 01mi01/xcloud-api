import path from "path";
import dotenv from "dotenv";
import { Kafka } from "kafkajs";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

const kafka = new Kafka({
    clientId: "notification-service",
    brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
    retry: { initialRetryTime: 300, retries: 5 },
});

export default kafka;
