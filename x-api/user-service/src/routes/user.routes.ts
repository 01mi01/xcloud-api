import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import * as ctrl from "../controllers/user.controller";

const router = Router();

router.get("/:handle", ctrl.getUser);
router.put("/me", verifyToken, ctrl.updateMe);
router.post("/:userId/follow", verifyToken, ctrl.followUser);
router.delete("/:userId/follow", verifyToken, ctrl.unfollowUser);

export default router;
