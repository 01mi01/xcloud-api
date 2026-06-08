import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import * as svc from "../services/notification.service";

type AuthRequest = Request & { user: JwtPayload & { sub: string } };

export const getNotifications = async (req: Request, res: Response): Promise<void> => {
    const userId = (req as AuthRequest).user.sub;
    const limit  = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    try {
        const notifications = await svc.getNotifications(userId, limit, offset);
        res.status(200).json({ notifications });
    } catch (err) {
        console.error("[notification-service] Error:", (err as Error).message);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const markRead = async (req: Request, res: Response): Promise<void> => {
    const userId = (req as AuthRequest).user.sub;
    const notificationId = req.params.notificationId as string;

    try {
        const updated = await svc.markAsRead(notificationId, userId);
        if (!updated) { res.status(404).json({ message: "Notification not found" }); return; }
        res.status(204).send();
    } catch (err) {
        console.error("[notification-service] Error:", (err as Error).message);
        res.status(500).json({ message: "Internal server error" });
    }
};
