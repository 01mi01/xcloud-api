import express from "express";
import notificationRoutes from "./routes/notification.routes";

const app = express();

app.use(express.json());
app.use("/v1/notifications", notificationRoutes);
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

export default app;
