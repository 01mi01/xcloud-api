import { Router } from "express";
import { verifyToken } from "@xcloud/shared";
import * as ctrl from "../controllers/user.controller";

const router = Router();

// Especificas antes que parametrizadas para evitar shadowing
router.get("/by-id/:userId", ctrl.getUserById);
router.put("/me", verifyToken, ctrl.updateMe);
router.get("/:handle", ctrl.getUser);
router.post("/:userId/follow", verifyToken, ctrl.followUser);
router.delete("/:userId/follow", verifyToken, ctrl.unfollowUser);

export default router;
