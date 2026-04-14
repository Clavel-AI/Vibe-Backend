import { Router } from "express";
import { authMiddleware } from "../../middleware/auth";
import * as roomsController from "./rooms.controller";

const router = Router();

router.get("/",                  authMiddleware, roomsController.getRooms);
router.get("/:id",               authMiddleware, roomsController.getRoomById);
router.get("/:id/messages",      authMiddleware, roomsController.getRoomMessages);
router.get("/:id/members",       authMiddleware, roomsController.getRoomMembersHandler);
router.post("/:id/join",         authMiddleware, roomsController.joinRoom);
router.delete("/:id/leave",      authMiddleware, roomsController.leaveRoom);

export default router;
