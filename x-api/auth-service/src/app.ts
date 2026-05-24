import express from "express";
import authRoutes from "./routes/auth.routes";

const app = express();

app.use(express.json());
app.use("/v1/auth", authRoutes);
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

export default app;
