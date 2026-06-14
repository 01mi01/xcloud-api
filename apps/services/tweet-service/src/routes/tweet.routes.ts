import { Router } from "express";
import { verifyToken } from "@xcloud/shared";
import * as ctrl from "../controllers/tweet.controller";

const router = Router();

router.post("/", verifyToken, ctrl.createTweet);
// Per-viewer like/retweet state for a batch of tweetIds (authed).
router.post("/interactions", verifyToken, ctrl.getInteractions);
// Two-segment literal path — must not be shadowed by the single-segment /:tweetId.
router.get("/author/:authorId", ctrl.getTweetsByAuthor);
router.get("/liked/:userId", ctrl.getLikedTweets);
router.get("/:tweetId/replies", ctrl.getReplies);
router.get("/:tweetId", ctrl.getTweet);
router.delete("/:tweetId", verifyToken, ctrl.deleteTweet);
router.post("/:tweetId/like", verifyToken, ctrl.likeTweet);
router.delete("/:tweetId/like", verifyToken, ctrl.unlikeTweet);
router.post("/:tweetId/retweet", verifyToken, ctrl.retweetTweet);
router.delete("/:tweetId/retweet", verifyToken, ctrl.unretweetTweet);

export default router;
