const { Router } = require("express");
const { verifyToken } = require("../middleware/auth");
const ctrl = require("../controllers/user.controller");

const router = Router();

// GET /v1/users/:handle — public
router.get("/:handle", ctrl.getUser);

// PUT /v1/users/me — protected
router.put("/me", verifyToken, ctrl.updateMe);

// POST /v1/users/:userId/follow — protected
router.post("/:userId/follow", verifyToken, ctrl.followUser);

// DELETE /v1/users/:userId/follow — protected
router.delete("/:userId/follow", verifyToken, ctrl.unfollowUser);

module.exports = router;
