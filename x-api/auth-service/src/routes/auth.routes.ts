import { Router } from "express";
import { verifyToken } from "../middleware/validate-jwt";
import { register, login, me } from "../controllers/auth.controller";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", verifyToken, me);

export default router;
