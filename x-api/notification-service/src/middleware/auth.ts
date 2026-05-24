import path from "path";
import dotenv from "dotenv";
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

const JWT_SECRET = process.env.JWT_SECRET || "xcloud-local-dev-secret";

export const verifyToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ message: "Missing or invalid authorization header" });
        return;
    }

    const token = authHeader.split(" ")[1];

    try {
        const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
        (req as Request & { user: jwt.JwtPayload }).user = payload;
        next();
    } catch {
        res.status(401).json({ message: "Token is invalid or expired" });
    }
};
