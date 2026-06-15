import { Request, Response } from "express";
import * as svc from "../services/user.service";

// Las operaciones modeladas en Smithy (GetUser, UpdateUser, Follow/Unfollow)
// viven en src/smithy/operations.ts — aquí solo quedan las rutas fuera del modelo.

// POST /v1/users/reindex — republishes user.updated for every user so
// search-service rebuilds its user index (backfill; events only flow forward).
// Auth-gated (any logged-in user can trigger it); idempotent.
export const reindexUsers = async (_req: Request, res: Response): Promise<void> => {
    try {
        const count = await svc.reindexAll();
        res.status(200).json({ reindexed: count });
    } catch (err) {
        console.error("[user-service] reindex failed:", (err as Error).message);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const searchUsers = async (req: Request, res: Response): Promise<void> => {
    const q = (req.query.q as string ?? "").trim();
    if (q.length < 1) { res.status(200).json({ users: [] }); return; }
    try {
        const users = await svc.search(q);
        res.status(200).json({ users });
    } catch {
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getFollowStatus = async (req: Request, res: Response): Promise<void> => {
    const u = (req as any).user;
    const followerId = u?.sub ?? u?.userId;
    if (!followerId) { res.status(401).json({ message: "Unauthorized" }); return; }
    try {
        const following = await svc.isFollowing(followerId, req.params.userId as string);
        res.status(200).json({ following });
    } catch {
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getUserById = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = await svc.getById(req.params.userId as string);
        res.status(200).json(user);
    } catch (err) {
        if ((err as Error).name === "UserNotFoundError") { res.status(404).json({ message: (err as Error).message }); return; }
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getFollowing = async (req: Request, res: Response): Promise<void> => {
    try {
        const users = await svc.getFollowing(req.params.userId as string);
        res.status(200).json({ users });
    } catch {
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getFollowers = async (req: Request, res: Response): Promise<void> => {
    try {
        const users = await svc.getFollowers(req.params.userId as string);
        res.status(200).json({ users });
    } catch {
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getFollowingStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const followerId = (req as Request & { user: { sub: string } }).user.sub;
        const { userIds } = req.body as { userIds?: string[] };
        if (!Array.isArray(userIds)) { res.status(400).json({ message: "userIds[] is required" }); return; }
        const following = await svc.getFollowingStatus(followerId, userIds.slice(0, 200));
        res.status(200).json({ following });
    } catch {
        res.status(500).json({ message: "Internal server error" });
    }
};
