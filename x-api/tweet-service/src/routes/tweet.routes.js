const { Router } = require("express");
const { verifyToken } = require("../middleware/auth");
const ctrl = require("../controllers/tweet.controller");

const router = Router();

// POST /v1/tweets — protected
router.post("/", verifyToken, ctrl.createTweet);

// GET /v1/tweets/:tweetId — public
router.get("/:tweetId", ctrl.getTweet);

// DELETE /v1/tweets/:tweetId — protected
router.delete("/:tweetId", verifyToken, ctrl.deleteTweet);

// POST /v1/tweets/:tweetId/like — protected
router.post("/:tweetId/like", verifyToken, ctrl.likeTweet);

// DELETE /v1/tweets/:tweetId/like — protected
router.delete("/:tweetId/like", verifyToken, ctrl.unlikeTweet);

module.exports = router;
