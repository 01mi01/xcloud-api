import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import * as svc from "../services/user.service";

type AuthRequest = Request & { user: JwtPayload & { sub: string; username?: string; "cognito:username"?: string } };

const URL_REGEX = /^https?:\/\/.+/;

export const getUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = await svc.getByHandle(req.params.handle);
        res.status(200).json(user);
    } catch (err) {
        if ((err as Error).name === "UserNotFoundError") { res.status(404).json({ message: (err as Error).message }); return; }
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getUserById = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = await svc.getById(req.params.userId);
        res.status(200).json(user);
    } catch (err) {
        if ((err as Error).name === "UserNotFoundError") { res.status(404).json({ message: (err as Error).message }); return; }
        res.status(500).json({ message: "Internal server error" });
    }
};

export const updateMe = async (req: Request, res: Response): Promise<void> => {
    const { displayName, bio, avatarUrl } = req.body as { displayName?: string; bio?: string; avatarUrl?: string };

    if (displayName !== undefined && displayName.length > 50) {
        res.status(400).json({ message: "displayName must be 50 characters or less" }); return;
    }
    if (bio !== undefined && bio.length > 160) {
        res.status(400).json({ message: "bio must be 160 characters or less" }); return;
    }
    if (avatarUrl !== undefined && !URL_REGEX.test(avatarUrl)) {
        res.status(400).json({ message: "avatarUrl must be a valid URL" }); return;
    }
    if (displayName === undefined && bio === undefined && avatarUrl === undefined) {
        res.status(400).json({ message: "At least one field is required: displayName, bio, avatarUrl" }); return;
    }

    try {
        const authReq = req as AuthRequest;
        const handle = authReq.user.username ?? authReq.user["cognito:username"] ?? "";
        const user = await svc.updateProfile(authReq.user.sub, handle, { displayName, bio, avatarUrl });
        res.status(200).json(user);
    } catch (err) {
        if ((err as Error).name === "UserNotFoundError") { res.status(404).json({ message: (err as Error).message }); return; }
        res.status(500).json({ message: "Internal server error" });
    }
};

export const followUser = async (req: Request, res: Response): Promise<void> => {
    const followingId = req.params.userId;
    const followerId  = (req as AuthRequest).user.sub;

    if (followerId === followingId) {
        res.status(400).json({ message: "You cannot follow yourself" }); return;
    }

    try {
        await svc.follow(followerId, followingId);
        res.status(204).send();
    } catch (err) {
        if ((err as Error).name === "UserNotFoundError")     { res.status(404).json({ message: (err as Error).message }); return; }
        if ((err as Error).name === "AlreadyFollowingError") { res.status(409).json({ message: (err as Error).message }); return; }
        res.status(500).json({ message: "Internal server error" });
    }
};

export const unfollowUser = async (req: Request, res: Response): Promise<void> => {
    const followingId = req.params.userId;
    const followerId  = (req as AuthRequest).user.sub;

    try {
        await svc.unfollow(followerId, followingId);
        res.status(204).send();
    } catch (err) {
        if ((err as Error).name === "NotFollowingError") { res.status(404).json({ message: (err as Error).message }); return; }
        res.status(500).json({ message: "Internal server error" });
    }
};
