import { Request, Response } from "express";
import * as svc from "../services/user.service";

// Las operaciones modeladas en Smithy (GetUser, UpdateUser, Follow/Unfollow)
// viven en src/smithy/operations.ts — aquí solo quedan las rutas fuera del modelo.

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

export const getUserById = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = await svc.getById(req.params.userId as string);
        res.status(200).json(user);
    } catch (err) {
        if ((err as Error).name === "UserNotFoundError") { res.status(404).json({ message: (err as Error).message }); return; }
        res.status(500).json({ message: "Internal server error" });
    }
};
