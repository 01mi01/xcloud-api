import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

import app from "./app";

const PORT = parseInt(process.env.MEDIA_PORT ?? "3006");

app.listen(PORT, () => {
    console.log(`Media Service running on port ${PORT}`);
});
