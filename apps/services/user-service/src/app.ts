import express from "express";
import userRoutes from "./routes/user.routes";

const app = express();

app.use(express.json());
app.use("/v1/users", userRoutes);
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

export default app;
