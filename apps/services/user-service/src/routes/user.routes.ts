import { Router } from "express";
import { verifyToken } from "@xcloud/shared";
import * as ctrl from "../controllers/user.controller";
import * as smithy from "../smithy/operations";

const router = Router();

// Especificas antes que parametrizadas para evitar shadowing
// /by-id no está en el modelo Smithy — sigue siendo un handler Express plano.
router.get("/by-id/:userId", ctrl.getUserById);

// Operaciones modeladas — servidas por los handlers Smithy SSDK generados
// (ver src/smithy/). verifyToken sigue corriendo antes; el handler recibe
// req.user vía el HandlerContext.
router.put("/me", verifyToken, smithy.updateUser);
router.get("/:handle", smithy.getUser);
router.post("/:userId/follow", verifyToken, smithy.followUser);
router.delete("/:userId/follow", verifyToken, smithy.unfollowUser);

export default router;
