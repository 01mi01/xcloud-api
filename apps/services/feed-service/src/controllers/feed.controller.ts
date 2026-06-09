import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import * as svc from "../services/feed.service";

type AuthRequest = Request & { user: JwtPayload & { sub: string } };

/**
 * GET /v1/feed?cursor=X&limit=20
 *
 * Implementa la operación GetFeed definida en feed.smithy.
 * Requiere autenticación (JWT). El userId se extrae del token.
 */
export const getFeed = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthRequest;
    const userId  = authReq.user.sub;

    const cursor = req.query.cursor as string | undefined;
    const limit  = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    if (limit !== undefined && (isNaN(limit) || limit < 1)) {
        res.status(400).json({ message: "limit must be a positive integer" });
        return;
    }

    try {
        const feed = await svc.getFeed(userId, cursor, limit);
        res.status(200).json({
            tweets:     feed.tweets,
            nextCursor: feed.nextCursor,
        });
    } catch (err) {
        console.error("[feed-service] Error fetching feed:", (err as Error).message);
        res.status(500).json({ message: "Internal server error" });
    }
};
