import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env";
import { redis } from "../config/redis";
import { registerChatHandlers } from "../modules/chat/chat.handler";
import { registerDmHandlers } from "../modules/dm/dm.handler";

const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export interface AuthenticatedSocket extends Socket {
  userId?: string;
}

const PRESENCE_TTL = 86400; // 24h safety expiry on presence keys

export async function getRoomMemberCount(roomId: string): Promise<number> {
  return (await redis.scard(`room:presence:${roomId}`)) ?? 0;
}

export async function getRoomMembers(roomId: string): Promise<Set<string>> {
  const members = await redis.smembers(`room:presence:${roomId}`);
  return new Set(members as string[]);
}

let ioInstance: Server | null = null;
export function getIO(): Server | null { return ioInstance; }

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

    socket.on("room:join", async ({ roomId }: { roomId: string }) => {
      socket.join(`room:${roomId}`);
      await redis.sadd(`room:presence:${roomId}`, userId);
      await redis.sadd(`user:rooms:${userId}`, roomId);
      await redis.expire(`room:presence:${roomId}`, PRESENCE_TTL);
      await redis.expire(`user:rooms:${userId}`, PRESENCE_TTL);
      const count = await getRoomMemberCount(roomId);
      io.emit("room:count", { roomId, count });
    });

    socket.on("room:leave", async ({ roomId }: { roomId: string }) => {
      socket.leave(`room:${roomId}`);
      await redis.srem(`room:presence:${roomId}`, userId);
      await redis.srem(`user:rooms:${userId}`, roomId);
      const count = await getRoomMemberCount(roomId);
      io.emit("room:count", { roomId, count });
    });

    socket.on("disconnect", async () => {
      const rooms = await redis.smembers(`user:rooms:${userId}`) as string[];
      await Promise.all(
        rooms.map(async (roomId) => {
          await redis.srem(`room:presence:${roomId}`, userId);
          const count = await getRoomMemberCount(roomId);
          io.emit("room:count", { roomId, count });
        })
      );
      await redis.del(`user:rooms:${userId}`);
      console.log(`[Socket] Disconnected: ${userId}`);
    });

    // ─── Phase 3: Chat ───
    registerChatHandlers(io, socket);

    // ─── Phase 4: Direct Messages ───
    registerDmHandlers(io, socket);

    // ─── Phase 5: Call signaling ───
    // ─── Phase 6: Mood matching ───
  });

  return io;
}
