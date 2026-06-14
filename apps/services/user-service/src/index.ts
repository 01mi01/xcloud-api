import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

import { ensurePostgresSchema } from "@xcloud/shared";
import app from "./app";
import pool from "./config/db.config";

const PORT = parseInt(process.env.USER_PORT ?? "3001");

const main = async (): Promise<void> => {
    // Listen first (ALB health check passes immediately); ensure schema in background.
    app.listen(PORT, () => {
        console.log(`User Service running on port ${PORT}`);
    });
    ensurePostgresSchema(pool).catch((err) => console.error("[schema]", (err as Error).message));
};

main();
