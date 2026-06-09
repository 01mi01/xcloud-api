import express from "express";

/**
 * Minimal HTTP server exposing GET /health so this otherwise headless worker
 * can run as an ECS Fargate service behind an ALB/target-group health check.
 */
export const startHealthServer = (): void => {
    const app = express();
    app.get("/health", (_req, res) =>
        res.status(200).json({ status: "ok", service: "fanout-service" }),
    );
    const PORT = parseInt(process.env.FANOUT_PORT ?? "3007");
    app.listen(PORT, () => console.log(`[fanout-service] Health server on port ${PORT}`));
};
