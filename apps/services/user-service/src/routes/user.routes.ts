import { Router } from "express";
import { verifyToken } from "@xcloud/shared";
import * as ctrl from "../controllers/user.controller";
import * as smithy from "../smithy/operations";

const router = Router();

// Especificas antes que parametrizadas para evitar shadowing.
// /search, /by-id y /:userId/(followers|following|follow) no están en el modelo
// Smithy — son handlers Express planos (no chocan con /:handle ni /:userId/follow POST).
// POST /reindex (un solo segmento) no choca con GET /:handle. Backfill del índice
// de búsqueda de usuarios — republica user.updated para todos.
router.post("/reindex", verifyToken, ctrl.reindexUsers);
router.get("/search", ctrl.searchUsers);
router.get("/by-id/:userId", ctrl.getUserById);
router.get("/:userId/follow", verifyToken, ctrl.getFollowStatus);
router.get("/:userId/followers", ctrl.getFollowers);
router.get("/:userId/following", ctrl.getFollowing);

// Operaciones modeladas — servidas por los handlers Smithy SSDK generados
// (ver src/smithy/). verifyToken sigue corriendo antes; el handler recibe
// req.user vía el HandlerContext.
// Estado de follow del viewer para un lote de userIds (no modelado).
router.post("/following-status", verifyToken, ctrl.getFollowingStatus);

router.put("/me", verifyToken, smithy.updateUser);
router.get("/:handle", smithy.getUser);
router.post("/:userId/follow", verifyToken, smithy.followUser);
router.delete("/:userId/follow", verifyToken, smithy.unfollowUser);

export default router;
