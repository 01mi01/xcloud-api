import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import app from "./app";

const PORT = parseInt(process.env.USER_PORT ?? "3001");

app.listen(PORT, () => {
    console.log(`User Service running on port ${PORT}`);
});
