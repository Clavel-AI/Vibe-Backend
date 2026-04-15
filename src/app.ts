import express from "express";
import { createServer } from "http";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { redis } from "./config/redis";
import { prisma } from "./config/database";
import { setupSocketIO } from "./socket";
import authRoutes from "./modules/auth/auth.routes";
import roomRoutes from "./modules/rooms/rooms.routes";
import dmRoutes from "./modules/dm/dm.routes";
import * as dmController from "./modules/dm/dm.controller";
import { authMiddleware } from "./middleware/auth";

const app = express();
const httpServer = createServer(app);

// ─── Middleware ───
app.use(helmet());
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

// ─── Health Check ───
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Routes ───
app.use("/api/auth", authRoutes);

app.use("/api/rooms", roomRoutes);
app.use("/api/dm", dmRoutes);

// Block / unblock users
app.post("/api/users/:id/block",   authMiddleware, dmController.blockUser);
app.delete("/api/users/:id/block", authMiddleware, dmController.unblockUser);

// Future phases:
// app.use("/api/calls", callRoutes);
// app.use("/api/mood", moodRoutes);
// app.use("/api/contacts", contactRoutes);
// app.use("/api/referral", referralRoutes);
// app.use("/api/reports", reportRoutes);
// app.use("/api/admin", adminRoutes);

// ─── Socket.IO ───
const io = setupSocketIO(httpServer);

// ─── Start Server ───
async function start() {
  // Connect Redis (optional — not used until Phase 3 rate limiting)
  try {
    await redis.connect();
  } catch {
    console.warn("[Redis] Not available — starting without Redis (Phase 1 only)");
  }

  // Verify DB connection
  try {
    await prisma.$connect();
    console.log("[DB] Connected to Supabase PostgreSQL");
  } catch (err) {
    console.error("[DB] Failed to connect:", err);
    process.exit(1);
  }

  httpServer.listen(env.port, () => {
    console.log(`[Server] Running on port ${env.port} (${env.nodeEnv})`);
    console.log(`[Server] Health check: http://localhost:${env.port}/api/health`);
  });
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[Server] Shutting down...");
  await prisma.$disconnect();
  redis.disconnect();
  httpServer.close();
  process.exit(0);
});

start();

export { app, io };
