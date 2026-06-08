import express from "express";
import tweetRoutes from "./routes/tweet.routes";

const app = express();

app.use(express.json());
app.use("/v1/tweets", tweetRoutes);
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

export default app;
