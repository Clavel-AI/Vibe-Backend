import { Server } from "socket.io";
import { AuthenticatedSocket } from "../../socket/index";
import * as dmService from "./dm.service";

// Rate limiting: 1 message per second per user (in-memory)
const lastMessageTime = new Map<string, number>();

export function registerDmHandlers(io: Server, socket: AuthenticatedSocket) {
  const userId = socket.userId!;

  // Join a DM thread room for real-time updates
  socket.on("dm:join", ({ threadId }: { threadId: string }) => {
    socket.join(`dm:${threadId}`);
  });

  socket.on("dm:leave", ({ threadId }: { threadId: string }) => {
    socket.leave(`dm:${threadId}`);
  });

  socket.on("dm:message", async ({ threadId, content, replyToId }: { threadId: string; content: string; replyToId?: string }) => {
    try {
      // Rate limit: 1 msg/sec
      const now = Date.now();
      const last = lastMessageTime.get(userId) ?? 0;
      if (now - last < 1000) return;
      lastMessageTime.set(userId, now);

      if (!content?.trim()) return;
      if (content.length > 1000) return;

      // Verify user is part of thread
      const thread = await dmService.getThread(threadId);
      if (!thread) return;
      if (thread.user1Id !== userId && thread.user2Id !== userId) return;

      // Check block
      const otherId = thread.user1Id === userId ? thread.user2Id : thread.user1Id;
      const blocked = await dmService.isBlocked(userId, otherId);
      if (blocked) return;

      const msg = await dmService.createDmMessage(threadId, userId, content.trim(), replyToId);

      // Broadcast to thread room (both users)
      io.to(`dm:${threadId}`).emit("dm:message:new", msg);

      // Also push to the other user's personal channel so they get it even if not in the room
      io.to(`user:${otherId}`).emit("dm:message:new", msg);
    } catch (err) {
      console.error("[DM Socket] dm:message error:", err);
    }
  });

  socket.on("dm:reaction", async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
    try {
      // Verify the message belongs to a thread the user is part of
      const message = await dmService.getMessageThread(messageId);
      if (!message) return;
      if (message.thread.user1Id !== userId && message.thread.user2Id !== userId) return;

      await dmService.toggleDmReaction(messageId, userId, emoji);
      // Send raw reactions so each client computes myReaction from their own userId
      const reactions = await dmService.getRawDmReactions(messageId);

      // Broadcast updated reactions to both users in the thread
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
