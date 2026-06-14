import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
// Contrato generado desde el modelo Smithy (api-model) — solo tipos.
// Si el modelo cambia (p.ej. renombra un campo del request), esto rompe en compile-time.
import type { CreateTweetServerInput } from "@xcloud/sdk-server";
import * as svc from "../services/tweet.service";

type AuthRequest = Request & { user: JwtPayload & { sub: string } };

export const createTweet = async (req: Request, res: Response): Promise<void> => {
    const { content, mediaUrls, replyToTweetId } = req.body as CreateTweetServerInput;

    if (!content || content.trim().length === 0) { res.status(400).json({ message: "content is required" }); return; }
    if (content.length > 280) { res.status(400).json({ message: "content must be 280 characters or less" }); return; }

    try {
        const tweet = await svc.createTweet((req as AuthRequest).user.sub, { content, mediaUrls, replyToTweetId });
        res.status(201).json({ tweet });
    } catch {
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getTweet = async (req: Request, res: Response): Promise<void> => {
    try {
        const tweet = await svc.getTweet((req.params.tweetId as string));
        res.status(200).json({ tweet });
    } catch (err) {
        if ((err as Error).name === "TweetNotFoundError") { res.status(404).json({ message: (err as Error).message }); return; }
        res.status(500).json({ message: "Internal server error" });
    }
};

export const deleteTweet = async (req: Request, res: Response): Promise<void> => {
    try {
        await svc.deleteTweet((req.params.tweetId as string), (req as AuthRequest).user.sub);
        res.status(204).send();
    } catch (err) {
        if ((err as Error).name === "TweetNotFoundError") { res.status(404).json({ message: (err as Error).message }); return; }
        if ((err as Error).name === "ForbiddenError")     { res.status(403).json({ message: (err as Error).message }); return; }
        res.status(500).json({ message: "Internal server error" });
    }
};

export const likeTweet = async (req: Request, res: Response): Promise<void> => {
    try {
        await svc.likeTweet((req as AuthRequest).user.sub, (req.params.tweetId as string));
        res.status(204).send();
    } catch (err) {
        if ((err as Error).name === "TweetNotFoundError") { res.status(404).json({ message: (err as Error).message }); return; }
        if ((err as Error).name === "AlreadyLikedError")  { res.status(409).json({ message: (err as Error).message }); return; }
        res.status(500).json({ message: "Internal server error" });
    }
};

export const unlikeTweet = async (req: Request, res: Response): Promise<void> => {
    try {
        await svc.unlikeTweet((req as AuthRequest).user.sub, (req.params.tweetId as string));
        res.status(204).send();
    } catch (err) {
        if ((err as Error).name === "TweetNotFoundError") { res.status(404).json({ message: (err as Error).message }); return; }
        if ((err as Error).name === "NotLikedError")      { res.status(404).json({ message: (err as Error).message }); return; }
        res.status(500).json({ message: "Internal server error" });
    }
};

export const retweetTweet = async (req: Request, res: Response): Promise<void> => {
    try {
        await svc.retweetTweet((req as AuthRequest).user.sub, (req.params.tweetId as string));
        res.status(204).send();
    } catch (err) {
        if ((err as Error).name === "TweetNotFoundError")    { res.status(404).json({ message: (err as Error).message }); return; }
        if ((err as Error).name === "AlreadyRetweetedError") { res.status(409).json({ message: (err as Error).message }); return; }
        res.status(500).json({ message: "Internal server error" });
    }
};

export const unretweetTweet = async (req: Request, res: Response): Promise<void> => {
    try {
        await svc.unretweetTweet((req as AuthRequest).user.sub, (req.params.tweetId as string));
        res.status(204).send();
    } catch (err) {
        if ((err as Error).name === "TweetNotFoundError") { res.status(404).json({ message: (err as Error).message }); return; }
        if ((err as Error).name === "NotRetweetedError")  { res.status(404).json({ message: (err as Error).message }); return; }
        res.status(500).json({ message: "Internal server error" });
    }
};
