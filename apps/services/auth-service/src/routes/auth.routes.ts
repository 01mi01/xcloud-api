import { Router } from "express";
import { verifyToken } from "@xcloud/shared";
import { register, login, me } from "../controllers/auth.controller";
import { rateLimit } from "../middleware/rate-limit";

const router = Router();

// §3.1 — max 10 login attempts per minute per IP.
const loginLimiter = rateLimit({ windowMs: 60_000, max: 10 });

router.post("/register", register);
router.post("/login", loginLimiter, login);
router.get("/me", verifyToken, me);

export default router;
