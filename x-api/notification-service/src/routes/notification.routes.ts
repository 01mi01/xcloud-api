import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import * as ctrl from "../controllers/notification.controller";

const router = Router();

router.get("/", verifyToken, ctrl.getNotifications);
router.put("/:notificationId/read", verifyToken, ctrl.markRead);

export default router;
