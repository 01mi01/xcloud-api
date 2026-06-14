import { Request, Response } from "express";
import * as svc from "../services/user.service";

// Las operaciones modeladas en Smithy (GetUser, UpdateUser, Follow/Unfollow)
// viven en src/smithy/operations.ts — aquí solo quedan las rutas fuera del modelo.

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
