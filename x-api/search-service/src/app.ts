import express from "express";
import searchRoutes from "./routes/search.routes";

const app = express();

app.use(express.json());
app.use("/v1/search", searchRoutes);
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

export default app;
