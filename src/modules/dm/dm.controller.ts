import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import * as dmService from "./dm.service";

// POST /api/dm/thread  { userId: targetUserId }
export async function getOrCreateThread(req: AuthRequest, res: Response) {
  try {
    const myId = req.userId!;
    const { userId: targetId } = req.body as { userId: string };

    if (!targetId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }
    if (targetId === myId) {
      res.status(400).json({ error: "Cannot DM yourself" });
      return;
    }

    // Check block direction: did I block them, or did they block me?
    const iBlockedThem = await dmService.iBlockedUser(myId, targetId);
    const theyBlockedMe = await dmService.iBlockedUser(targetId, myId);
    if (iBlockedThem || theyBlockedMe) {
      res.status(403).json({
        error: "Blocked",
        canUnblock: iBlockedThem,   // I blocked them → I can unblock
        blockedUserId: targetId,
      });
      return;
    }

    const { id, isNew } = await dmService.getOrCreateThread(myId, targetId);
    res.json({ threadId: id, isNew });
  } catch (err) {
    console.error("[DM] getOrCreateThread error:", err);
    res.status(500).json({ error: "Failed to get/create thread" });
  }
}

// GET /api/dm/threads
export async function listThreads(req: AuthRequest, res: Response) {
  try {
    const threads = await dmService.getThreads(req.userId!);
    res.json({ threads });
  } catch (err) {
    console.error("[DM] listThreads error:", err);
    res.status(500).json({ error: "Failed to fetch threads" });
  }
}

// GET /api/dm/:threadId/messages
export async function getMessages(req: AuthRequest, res: Response) {
  try {
    const threadId = req.params.threadId as string;
    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    // Verify user is part of this thread
    const thread = await dmService.getThread(threadId!);
    if (!thread) { res.status(404).json({ error: "Thread not found" }); return; }

    const myId = req.userId!;
    if (thread.user1Id !== myId && thread.user2Id !== myId) {
      res.status(403).json({ error: "Not your thread" });
      return;
    }

    const data = await dmService.getThreadMessages(threadId!, myId, cursor, limit);
    res.json(data);
  } catch (err) {
    console.error("[DM] getMessages error:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
}

// POST /api/users/:id/block
export async function blockUser(req: AuthRequest, res: Response) {
  try {
    const blockerId = req.userId!;
    const blockedId = req.params.id as string;
    if (blockedId === blockerId) { res.status(400).json({ error: "Cannot block yourself" }); return; }
    await dmService.blockUser(blockerId, blockedId);
    res.json({ blocked: true });
  } catch (err) {
    console.error("[DM] blockUser error:", err);
    res.status(500).json({ error: "Failed to block user" });
  }
}

// DELETE /api/users/:id/block
export async function unblockUser(req: AuthRequest, res: Response) {
  try {
    await dmService.unblockUser(req.userId!, req.params.id as string);
    res.json({ unblocked: true });
  } catch (err) {
    console.error("[DM] unblockUser error:", err);
    res.status(500).json({ error: "Failed to unblock user" });
  }
}
