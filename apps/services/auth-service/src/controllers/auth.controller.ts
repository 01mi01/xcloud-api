import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { registerUser, loginUser, assignUserToGroup } from "../services/auth.service";

// Matches the Smithy `Handle` contract (com.twitter#Handle) that user-service's
// GetUser enforces via the SSDK. Validating here keeps registration in sync, so
// a handle that can be created can always be fetched.
const HANDLE_PATTERN = /^[a-zA-Z0-9_]{4,20}$/;

export const register = async (req: Request, res: Response): Promise<void> => {
    const { handle, email, password } = req.body as { handle?: string; email?: string; password?: string };

    if (!handle || !email || !password) {
        res.status(400).json({ message: "handle, email and password are required" });
        return;
    }

    if (!HANDLE_PATTERN.test(handle)) {
        res.status(400).json({ message: "handle must be 4-20 characters: letters, numbers and underscore only" });
        return;
    }

    try {
        const userId = await registerUser(handle, email, password);
        await assignUserToGroup(email, "user");
        res.status(201).json({ userId, message: "User registered successfully" });
    } catch (err) {
        if ((err as Error).name === "UsernameExistsException") {
            res.status(409).json({ message: "Email already registered" });
            return;
        }
        res.status(400).json({ message: (err as Error).message });
    }
};

export const login = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
        res.status(400).json({ message: "email and password are required" });
        return;
    }

    try {
        const tokens = await loginUser(email, password);
        res.status(200).json({
            token:     tokens.AccessToken,
            idToken:   tokens.IdToken,
            expiresAt: new Date(Date.now() + tokens.ExpiresIn * 1000).toISOString(),
        });
    } catch (err) {
        if ((err as Error).name === "NotAuthorizedException") {
            res.status(401).json({ message: "Invalid credentials" });
            return;
        }
        res.status(400).json({ message: (err as Error).message });
    }
};

export const me = (req: Request, res: Response): void => {
    const user = (req as Request & { user: JwtPayload }).user;
    res.status(200).json({
        userId: user["sub"],
        email:  user["email"],
        role:   (user["cognito:groups"] as string[] | undefined)?.[0] ?? "user",
    });
};
