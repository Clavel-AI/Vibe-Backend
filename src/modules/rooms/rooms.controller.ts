import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import * as roomsService from "./rooms.service";
import * as chatService from "../chat/chat.service";
import { prisma } from "../../config/database";
import { getRoomMembers } from "../../socket/index";

export async function getRooms(req: AuthRequest, res: Response) {
  try {
    const rooms = await roomsService.getRooms();
    res.json({ rooms });
  } catch (err) {
    console.error("[Rooms] Get rooms error:", err);
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
}

export async function getRoomById(req: AuthRequest, res: Response) {
  try {
    const room = await roomsService.getRoomById(req.params.id!, req.userId);
    if (!room) { res.status(404).json({ error: "Room not found" }); return; }
    res.json({ room });
  } catch (err) {
    console.error("[Rooms] Get room error:", err);
    res.status(500).json({ error: "Failed to fetch room" });
  }
}

export async function joinRoom(req: AuthRequest, res: Response) {
  try {
    const { id: roomId } = req.params;
    const userId = req.userId!;

    const { isNew } = await roomsService.joinRoom(roomId!, userId);

    // Only create system message on first-ever join
    if (isNew) {
      const profile = await prisma.profile.findUnique({
        where: { id: userId },
        select: { handle: true },
      });
      if (profile) {
        const sysMsg = await chatService.createMessage({
          roomId: roomId!,
          senderId: userId,
          content: `${profile.handle} joined`,
          type: "system",
        });
        // Broadcast system message via the io instance
        const { getIO } = await import("../../socket/index");
        getIO()?.to(`room:${roomId}`).emit("room:message:new", sysMsg);
      }
    }

    res.json({ joined: true, isNew });
  } catch (err) {
    console.error("[Rooms] Join error:", err);
    res.status(500).json({ error: "Failed to join room" });
  }
}

export async function leaveRoom(req: AuthRequest, res: Response) {
  try {
    const { id: roomId } = req.params;
    const userId = req.userId!;

    await roomsService.leaveRoom(roomId!, userId);

    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: { handle: true },
    });
    if (profile) {
      const sysMsg = await chatService.createMessage({
        roomId: roomId!,
        senderId: userId,
        content: `${profile.handle} left the room`,
        type: "system",
      });
      const { getIO } = await import("../../socket/index");
      getIO()?.to(`room:${roomId}`).emit("room:message:new", sysMsg);
    }

    res.json({ left: true });
  } catch (err) {
    console.error("[Rooms] Leave error:", err);
    res.status(500).json({ error: "Failed to leave room" });
  }
}

export async function getRoomMessages(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const data = await chatService.getRoomMessages(id!, req.userId!, cursor, limit);
    res.json(data);
  } catch (err) {
    console.error("[Rooms] Get messages error:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
}

export async function getRoomMembersHandler(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const onlineIds = [...getRoomMembers(id!)];
    const profiles = await prisma.profile.findMany({
      where: { id: { in: onlineIds } },
      select: { id: true, name: true, handle: true, avatarUrl: true },
    });
    res.json({ members: profiles });
  } catch (err) {
    console.error("[Rooms] Get members error:", err);
    res.status(500).json({ error: "Failed to fetch members" });
  }
}
