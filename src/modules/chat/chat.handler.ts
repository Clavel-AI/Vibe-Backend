import { Server } from "socket.io";
import { AuthenticatedSocket } from "../../socket/index";
import { redis } from "../../config/redis";
import * as chatService from "./chat.service";

const RATE_LIMIT_MS = 1000; // 1 message per second

export function registerChatHandlers(io: Server, socket: AuthenticatedSocket) {
  const userId = socket.userId!;

  socket.on("room:message", async ({ roomId, content, replyToId }: { roomId: string; content: string; replyToId?: string }) => {
    if (!roomId || !content?.trim()) return;
    if (content.trim().length > 500) return;

    // Redis-based rate limit: NX + 1s expiry — null means key existed → throttled
    const allowed = await redis.set(`rl:chat:${userId}`, 1, { nx: true, px: RATE_LIMIT_MS });
    if (!allowed) {
      socket.emit("room:error", { message: "Slow down!" });
      return;
    }

    try {
      const message = await chatService.createMessage({
        roomId,
        senderId: userId,
        content: content.trim(),
        replyToId,
      });

      io.to(`room:${roomId}`).emit("room:message:new", message);

      io.emit("rooms:activity", {
        roomId,
        lastActivityAt: message.createdAt.toISOString(),
        lastMessagePreview: content.trim().substring(0, 60),
        activityStatus: "active",
      });
    } catch (err) {
      console.error("[Chat] Message error:", err);
      socket.emit("room:error", { message: "Failed to send message" });
    }
  });

  socket.on("room:reaction", async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
    if (!messageId || !emoji) return;

    try {
      const { prisma } = await import("../../config/database");

      await chatService.toggleReaction(messageId, userId, emoji);

      const [msg, rawReactions] = await Promise.all([
        prisma.message.findUnique({ where: { id: messageId }, select: { roomId: true } }),
        prisma.reaction.findMany({ where: { messageId }, select: { userId: true, emoji: true } }),
      ]);
      if (!msg) return;

      io.to(`room:${msg.roomId}`).emit("room:reaction:update", {
        messageId,
        reactions: rawReactions,
      });
    } catch (err) {
      console.error("[Chat] Reaction error:", err);
    }
  });

  socket.on("room:typing", ({ roomId }: { roomId: string }) => {
    socket.to(`room:${roomId}`).emit("room:typing", { userId });
  });
}
