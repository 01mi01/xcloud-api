import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import * as ctrl from "../controllers/feed.controller";

const router = Router();

// GET /v1/feed — Operación GetFeed (feed.smithy)
// Auth requerida: userId se deriva del JWT
router.get("/", verifyToken, ctrl.getFeed);

export default router;
