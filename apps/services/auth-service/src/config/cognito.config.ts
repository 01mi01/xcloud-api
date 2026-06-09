import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../../../.env") });

export const JWT_SECRET  = process.env.JWT_SECRET  || "xcloud-local-dev-secret";
export const JWT_EXPIRES = "8h";
export const SALT_ROUNDS = 10;

export const dbConfig = {
    host:     process.env.DB_HOST     || "localhost",
    port:     parseInt(process.env.DB_PORT ?? "5432"),
    database: process.env.DB_NAME     || "xcloud",
    user:     process.env.DB_USER     || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
};
