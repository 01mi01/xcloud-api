import { Router } from "express";
import * as ctrl from "../controllers/search.controller";

const router = Router();

// GET /v1/search — public endpoint (no auth required per design doc §3.4)
router.get("/", ctrl.search);

export default router;
