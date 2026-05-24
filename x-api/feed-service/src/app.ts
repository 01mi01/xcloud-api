import express from "express";
import feedRoutes from "./routes/feed.routes";

const app = express();

app.use(express.json());
app.use("/v1/feed", feedRoutes);
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

export default app;
