import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

import app from "./app";

const PORT = parseInt(process.env.FEED_PORT ?? "3003");

app.listen(PORT, () => {
    console.log(`Feed Service running on port ${PORT}`);
});
