import { Request, Response } from "express";
import * as svc from "../services/search.service";

/**
 * GET /v1/search?q=...&type=tweets|users&limit=20&cursor=0
 *
 * Implements the search API from the design doc §3.4 (tweets + users).
 */
export const search = async (req: Request, res: Response): Promise<void> => {
    const q     = req.query.q as string | undefined;
    const type  = (req.query.type as string) || "tweets";
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const cursor = parseInt(req.query.cursor as string) || 0;

    if (!q || q.length < 2) {
        res.status(400).json({ message: "q is required and must be at least 2 characters" });
        return;
    }

    try {
        if (type === "tweets") {
            const { results, total } = await svc.searchTweets(q, limit, cursor);
            const nextCursor = cursor + limit < total ? String(cursor + limit) : null;
            res.status(200).json({ results, nextCursor });
        } else if (type === "users") {
            const { results, total } = await svc.searchUsers(q, limit, cursor);
            const nextCursor = cursor + limit < total ? String(cursor + limit) : null;
            res.status(200).json({ results, nextCursor });
        } else {
            res.status(400).json({ message: "Unsupported search type. Use 'tweets' or 'users'." });
        }
    } catch (err) {
        console.error("[search-service] Error:", (err as Error).message);
        res.status(500).json({ message: "Internal server error" });
    }
};
