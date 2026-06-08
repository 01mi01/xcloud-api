import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

import app from "./app";

const PORT = parseInt(process.env.AUTH_PORT ?? "3000");

app.listen(PORT, () => {
    console.log(`Auth Service running on port ${PORT}`);
});
