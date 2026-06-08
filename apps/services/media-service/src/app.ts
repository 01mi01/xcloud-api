import express from "express";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => res.status(200).json({ status: "ok", service: "media-service" }));

// Stub introduced during cloud migration — media uploads not yet implemented.
app.use("/v1/media", (_req, res) => res.status(503).json({ message: "Not yet implemented" }));

export default app;
