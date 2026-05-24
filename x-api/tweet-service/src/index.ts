import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import app from "./app";

const PORT = parseInt(process.env.TWEET_PORT ?? "3002");

app.listen(PORT, () => {
    console.log(`Tweet Service running on port ${PORT}`);
});
