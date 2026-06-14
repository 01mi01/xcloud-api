import { Request, Response, NextFunction } from "express";

// Minimal in-memory fixed-window rate limiter (no external dependency).
// §3.1 — login: max 10 attempts/min per IP → 429 when exceeded.
// Note: in-memory state is per-process; behind multiple instances each has its
// own counter. For production this would move to Redis/ElastiCache.
interface Window { count: number; resetAt: number; }

export const rateLimit = (opts: { windowMs: number; max: number }) => {
    const hits = new Map<string, Window>();

    return (req: Request, res: Response, next: NextFunction): void => {
        const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
        const now = Date.now();
        const w = hits.get(ip);

        if (!w || now >= w.resetAt) {
            hits.set(ip, { count: 1, resetAt: now + opts.windowMs });
            next();
            return;
        }

        w.count += 1;
        if (w.count > opts.max) {
            const retryAfter = Math.ceil((w.resetAt - now) / 1000);
            res.setHeader("Retry-After", String(retryAfter));
            res.status(429).json({ message: "Too many requests. Try again later." });
            return;
        }
        next();
    };
};
