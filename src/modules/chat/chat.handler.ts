import { Server } from "socket.io";
import { AuthenticatedSocket } from "../../socket/index";
import * as chatService from "./chat.service";

// Simple in-memory rate limiter: userId → last message timestamp
const lastMessage = new Map<string, number>();
const RATE_LIMIT_MS = 1000; // 1 message per second

export function registerChatHandlers(io: Server, socket: AuthenticatedSocket) {
  const userId = socket.userId!;

  socket.on("room:message", async ({ roomId, content }: { roomId: string; content: string }) => {
    // Validate
    if (!roomId || !content?.trim()) return;
    if (content.trim().length > 500) return;

    // Rate limit
    const now = Date.now();
    const last = lastMessage.get(userId) ?? 0;
    if (now - last < RATE_LIMIT_MS) {
      socket.emit("room:error", { message: "Slow down!" });
      return;
    }
    lastMessage.set(userId, now);

    try {
      const message = await chatService.createMessage({
        roomId,
        senderId: userId,
        content: content.trim(),
      });

      // Broadcast to everyone in the room (including sender)
      io.to(`room:${roomId}`).emit("room:message:new", message);
    } catch (err) {
      console.error("[Chat] Message error:", err);
      socket.emit("room:error", { message: "Failed to send message" });
    }
  });

  socket.on("room:reaction", async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
    if (!messageId || !emoji) return;

    try {
      await chatService.toggleReaction(messageId, userId, emoji);
      const reactions = await chatService.getReactionSummary(messageId, userId);

      // Broadcast updated reactions to the room — we need the roomId
      // Get it from the message
      const { prisma } = await import("../../config/database");
      const msg = await prisma.message.findUnique({ where: { id: messageId }, select: { roomId: true } });
      if (!msg) return;

      io.to(`room:${msg.roomId}`).emit("room:reaction:update", {
        messageId,
        reactions,
      });
    } catch (err) {
      console.error("[Chat] Reaction error:", err);
    }
  });

  socket.on("room:typing", ({ roomId }: { roomId: string }) => {
    // Broadcast typing indicator to others in the room
    socket.to(`room:${roomId}`).emit("room:typing", { userId });
  });
}
