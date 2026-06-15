import path from "path";
import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ path: path.resolve(__dirname, "../../../../../.env") });

const pool = new Pool({
    host:     process.env.DB_HOST     || "localhost",
    port:     parseInt(process.env.DB_PORT ?? "5432"),
    database: process.env.DB_NAME     || "xcloud",
    user:     process.env.DB_USER     || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    // RDS requires SSL (rds.force_ssl); encrypt in prod (CA not verified — demo).
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

export default pool;
