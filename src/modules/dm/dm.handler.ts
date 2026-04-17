import { Server } from "socket.io";
import { AuthenticatedSocket } from "../../socket/index";
import { redis } from "../../config/redis";
import * as dmService from "./dm.service";

export function registerDmHandlers(io: Server, socket: AuthenticatedSocket) {
  const userId = socket.userId!;

  socket.on("dm:join", ({ threadId }: { threadId: string }) => {
    socket.join(`dm:${threadId}`);
  });

  socket.on("dm:leave", ({ threadId }: { threadId: string }) => {
    socket.leave(`dm:${threadId}`);
  });

  socket.on("dm:message", async ({ threadId, content, replyToId }: { threadId: string; content: string; replyToId?: string }) => {
    try {
      // Redis-based rate limit: NX + 1s expiry
      const allowed = await redis.set(`rl:dm:${userId}`, 1, { nx: true, px: 1000 });
      if (!allowed) return;

      if (!content?.trim()) return;
      if (content.length > 1000) return;

      const thread = await dmService.getThread(threadId);
      if (!thread) return;
      if (thread.user1Id !== userId && thread.user2Id !== userId) return;

      const otherId = thread.user1Id === userId ? thread.user2Id : thread.user1Id;
      const blocked = await dmService.isBlocked(userId, otherId);
      if (blocked) return;

      const msg = await dmService.createDmMessage(threadId, userId, content.trim(), replyToId);

      io.to(`dm:${threadId}`).emit("dm:message:new", msg);
      io.to(`user:${otherId}`).emit("dm:message:new", msg);
    } catch (err) {
      console.error("[DM Socket] dm:message error:", err);
    }
  });

  socket.on("dm:reaction", async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
    try {
      const message = await dmService.getMessageThread(messageId);
      if (!message) return;
      if (message.thread.user1Id !== userId && message.thread.user2Id !== userId) return;

      await dmService.toggleDmReaction(messageId, userId, emoji);
      const reactions = await dmService.getRawDmReactions(messageId);

      io.to(`dm:${message.threadId}`).emit("dm:reaction:update", { messageId, reactions });

      const otherId = message.thread.user1Id === userId
        ? message.thread.user2Id
        : message.thread.user1Id;
      io.to(`user:${otherId}`).emit("dm:reaction:update", { messageId, reactions });
    } catch (err) {
      console.error("[DM Socket] dm:reaction error:", err);
    }
  });

  socket.on("dm:typing", ({ threadId }: { threadId: string }) => {
    socket.to(`dm:${threadId}`).emit("dm:typing", { userId, threadId });
  });
}
