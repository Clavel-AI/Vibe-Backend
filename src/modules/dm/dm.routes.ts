import { Router } from "express";
import { authMiddleware } from "../../middleware/auth";
import * as dmController from "./dm.controller";

const router = Router();

router.post("/thread",                 authMiddleware, dmController.getOrCreateThread);
router.get("/threads",                 authMiddleware, dmController.listThreads);
router.get("/:threadId/messages",      authMiddleware, dmController.getMessages);

export default router;
