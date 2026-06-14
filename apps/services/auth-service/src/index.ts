import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

import { Pool } from "pg";
import { ensurePostgresSchema } from "@xcloud/shared";
import app from "./app";
import { dbConfig } from "./config/cognito.config";

const PORT = parseInt(process.env.AUTH_PORT ?? "3000");

const main = async (): Promise<void> => {
    // Listen first so the ALB health check passes immediately.
    app.listen(PORT, () => {
        console.log(`Auth Service running on port ${PORT}`);
    });

    // auth-service owns the full PG schema (auth_users, users, follows, notifications).
    // Ensure it in the background (idempotent, retries internally).
    const pool = new Pool(dbConfig);
    ensurePostgresSchema(pool)
        .catch((err) => console.error("[schema]", (err as Error).message))
        .finally(() => pool.end().catch(() => {}));
};

main();
