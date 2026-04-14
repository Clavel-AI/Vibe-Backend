import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env";
import { registerChatHandlers } from "../modules/chat/chat.handler";

const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export interface AuthenticatedSocket extends Socket {
  userId?: string;
}

// In-memory: roomId → Set of userIds currently viewing the room
const roomMembers = new Map<string, Set<string>>();

let ioInstance: Server | null = null;
export function getIO(): Server | null { return ioInstance; }

export function getRoomMemberCount(roomId: string): number {
  return roomMembers.get(roomId)?.size ?? 0;
}

export function getRoomMembers(roomId: string): Set<string> {
  return roomMembers.get(roomId) ?? new Set();
}

export function setupSocketIO(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: env.corsOrigin,
      methods: ["GET", "POST"],
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // Auth middleware — verify Supabase JWT
  io.use(async (socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication required"));

    try {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !user) return next(new Error("Invalid token"));
      socket.userId = user.id;
      next();
    } catch {
      next(new Error("Auth failed"));
    }
  });

  ioInstance = io;
  io.on("connection", (socket: AuthenticatedSocket) => {
    const userId = socket.userId!;
    console.log(`[Socket] Connected: ${userId}`);

    // Personal channel for DMs, call requests, etc.
    socket.join(`user:${userId}`);

    // ─── Room Presence ───

    // room:join = real-time presence only (user is viewing the room now)
    socket.on("room:join", ({ roomId }: { roomId: string }) => {
      socket.join(`room:${roomId}`);
      if (!roomMembers.has(roomId)) roomMembers.set(roomId, new Set());
      roomMembers.get(roomId)!.add(userId);
      const count = getRoomMemberCount(roomId);
      io.to(`room:${roomId}`).emit("room:count", { roomId, count });
    });

    // room:leave = user closed the room screen (real-time presence only)
    socket.on("room:leave", ({ roomId }: { roomId: string }) => {
      socket.leave(`room:${roomId}`);
      roomMembers.get(roomId)?.delete(userId);
      const count = getRoomMemberCount(roomId);
      io.to(`room:${roomId}`).emit("room:count", { roomId, count });
    });

    socket.on("disconnect", () => {
      roomMembers.forEach((members, roomId) => {
        if (members.has(userId)) {
          members.delete(userId);
          const count = members.size;
          io.to(`room:${roomId}`).emit("room:count", { roomId, count });
        }
      });
      console.log(`[Socket] Disconnected: ${userId}`);
    });

    // ─── Phase 3: Chat ───
    registerChatHandlers(io, socket);

    // ─── Phase 5: Call signaling ───
    // ─── Phase 6: Mood matching ───
  });

  return io;
}
