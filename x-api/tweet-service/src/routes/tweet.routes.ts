import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import * as ctrl from "../controllers/tweet.controller";

const router = Router();

router.post("/", verifyToken, ctrl.createTweet);
router.get("/:tweetId", ctrl.getTweet);
router.delete("/:tweetId", verifyToken, ctrl.deleteTweet);
router.post("/:tweetId/like", verifyToken, ctrl.likeTweet);
router.delete("/:tweetId/like", verifyToken, ctrl.unlikeTweet);

export default router;
