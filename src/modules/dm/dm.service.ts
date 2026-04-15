import { prisma } from "../../config/database";

export interface DmReactionSummary {
  emoji: string;
  count: number;
  myReaction: boolean;
}

export interface DmReplyPreview {
  id: string;
  content: string;
  sender: { id: string; name: string | null; handle: string; avatarUrl: string | null } | null;
}

export interface DmMessageWithMeta {
  id: string;
  threadId: string;
  senderId: string;
  content: string;
  createdAt: Date;
  sender: {
    id: string;
    name: string | null;
    handle: string;
    avatarUrl: string | null;
  } | null;
  reactions: DmReactionSummary[];
  replyTo: DmReplyPreview | null;
}

export interface ThreadWithMeta {
  id: string;
  otherUser: {
    id: string;
    name: string | null;
    handle: string;
    avatarUrl: string | null;
  };
  lastMessage: string | null;
  lastMessageAt: Date | null;
  unread: boolean;
}

function buildReactions(
  rawReactions: { userId: string; emoji: string }[],
  userId: string
): DmReactionSummary[] {
  const grouped = new Map<string, { count: number; myReaction: boolean }>();
  for (const r of rawReactions) {
    if (!grouped.has(r.emoji)) grouped.set(r.emoji, { count: 0, myReaction: false });
    const entry = grouped.get(r.emoji)!;
    entry.count++;
    if (r.userId === userId) entry.myReaction = true;
  }
  return Array.from(grouped.entries()).map(([emoji, val]) => ({
    emoji,
    count: val.count,
    myReaction: val.myReaction,
  }));
}

// Always store user1Id as the lexicographically smaller UUID for uniqueness
export async function getOrCreateThread(
  userAId: string,
  userBId: string
): Promise<{ id: string; isNew: boolean }> {
  const [user1Id, user2Id] =
    userAId < userBId ? [userAId, userBId] : [userBId, userAId];

  const existing = await prisma.dmThread.findUnique({
    where: { user1Id_user2Id: { user1Id, user2Id } },
  });

  if (existing) return { id: existing.id, isNew: false };

  const thread = await prisma.dmThread.create({ data: { user1Id, user2Id } });
  return { id: thread.id, isNew: true };
}

export async function getThread(threadId: string) {
  return prisma.dmThread.findUnique({ where: { id: threadId } });
}

export async function getMessageThread(messageId: string) {
  return prisma.dmMessage.findUnique({
    where: { id: messageId },
    include: { thread: true },
  });
}

export async function getThreads(userId: string): Promise<ThreadWithMeta[]> {
  const threads = await prisma.dmThread.findMany({
    where: { OR: [{ user1Id: userId }, { user2Id: userId }] },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const otherIds = threads.map((t) =>
    t.user1Id === userId ? t.user2Id : t.user1Id
  );
  const profiles = await prisma.profile.findMany({
    where: { id: { in: otherIds } },
    select: { id: true, name: true, handle: true, avatarUrl: true },
  });
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));

  return threads.map((t) => {
    const otherId = t.user1Id === userId ? t.user2Id : t.user1Id;
    const lastMsg = t.messages[0] ?? null;
    return {
      id: t.id,
      otherUser: profileMap[otherId] ?? { id: otherId, name: null, handle: otherId, avatarUrl: null },
      lastMessage: lastMsg?.content ?? null,
      lastMessageAt: lastMsg?.createdAt ?? null,
      unread: false,
    };
  });
}

export async function getThreadMessages(
  threadId: string,
  userId: string,
  cursor?: string,
  limit = 20
): Promise<{ messages: DmMessageWithMeta[]; nextCursor: string | null }> {
  const messages = await prisma.dmMessage.findMany({
    where: {
      threadId,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    include: {
      reactions: { select: { userId: true, emoji: true } },
      replyTo: { select: { id: true, content: true, senderId: true } },
    },
  });

  const hasMore = messages.length > limit;
  const page = hasMore ? messages.slice(0, limit) : messages;

  // Collect all profile IDs: message senders + reply-to senders
  const senderIds = [...new Set([
    ...page.map((m) => m.senderId),
    ...page.filter((m) => m.replyTo).map((m) => m.replyTo!.senderId),
  ])];
  const profiles = await prisma.profile.findMany({
    where: { id: { in: senderIds } },
    select: { id: true, name: true, handle: true, avatarUrl: true },
  });
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));

  const result: DmMessageWithMeta[] = page.map((msg) => ({
    id: msg.id,
    threadId: msg.threadId,
    senderId: msg.senderId,
    content: msg.content,
    createdAt: msg.createdAt,
    sender: profileMap[msg.senderId] ?? null,
    reactions: buildReactions(msg.reactions, userId),
    replyTo: msg.replyTo
      ? { id: msg.replyTo.id, content: msg.replyTo.content, sender: profileMap[msg.replyTo.senderId] ?? null }
      : null,
  }));

  const nextCursor = hasMore ? page[page.length - 1]!.createdAt.toISOString() : null;
  return { messages: result, nextCursor };
}

export async function createDmMessage(
  threadId: string,
  senderId: string,
  content: string,
  replyToId?: string
): Promise<DmMessageWithMeta> {
  const msg = await prisma.dmMessage.create({
    data: { threadId, senderId, content, ...(replyToId ? { replyToId } : {}) },
  });

  const sender = await prisma.profile.findUnique({
    where: { id: senderId },
    select: { id: true, name: true, handle: true, avatarUrl: true },
  });

  let replyTo: DmReplyPreview | null = null;
  if (replyToId) {
    const replied = await prisma.dmMessage.findUnique({
      where: { id: replyToId },
      select: { id: true, content: true, senderId: true },
    });
    if (replied) {
      const replySender = await prisma.profile.findUnique({
        where: { id: replied.senderId },
        select: { id: true, name: true, handle: true, avatarUrl: true },
      });
      replyTo = { id: replied.id, content: replied.content, sender: replySender ?? null };
    }
  }

  return {
    id: msg.id,
    threadId: msg.threadId,
    senderId: msg.senderId,
    content: msg.content,
    createdAt: msg.createdAt,
    sender: sender ?? null,
    reactions: [],
    replyTo,
  };
}

export async function toggleDmReaction(
  messageId: string,
  userId: string,
  emoji: string
): Promise<{ added: boolean }> {
  // One reaction per user per message — find any existing reaction by this user
  const existing = await prisma.dmReaction.findFirst({
    where: { messageId, userId },
  });

  if (existing) {
    // Always remove the old reaction first
    await prisma.dmReaction.delete({
      where: { messageId_userId_emoji: { messageId, userId, emoji: existing.emoji } },
    });
    if (existing.emoji === emoji) {
      // Same emoji tapped again → toggled off
      return { added: false };
    }
    // Different emoji → replace with new one
    await prisma.dmReaction.create({ data: { messageId, userId, emoji } });
    return { added: true };
  }

  await prisma.dmReaction.create({ data: { messageId, userId, emoji } });
  return { added: true };
}

export async function getDmReactionSummary(
  messageId: string,
  userId: string
): Promise<DmReactionSummary[]> {
  const reactions = await prisma.dmReaction.findMany({
    where: { messageId },
    select: { emoji: true, userId: true },
  });
  return buildReactions(reactions, userId);
}

export async function getRawDmReactions(
  messageId: string
): Promise<{ userId: string; emoji: string }[]> {
  return prisma.dmReaction.findMany({
    where: { messageId },
    select: { userId: true, emoji: true },
  });
}

// Either direction blocked
export async function isBlocked(userId1: string, userId2: string): Promise<boolean> {
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userId1, blockedId: userId2 },
        { blockerId: userId2, blockedId: userId1 },
      ],
    },
  });
  return !!block;
}

// Directional: did blockerId specifically block blockedId?
export async function iBlockedUser(blockerId: string, blockedId: string): Promise<boolean> {
  const block = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId } },
  });
  return !!block;
}

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  await prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    create: { blockerId, blockedId },
    update: {},
  });
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  await prisma.block.deleteMany({ where: { blockerId, blockedId } });
}
