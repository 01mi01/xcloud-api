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
