import { prisma } from "../../config/database";

export interface MessageWithMeta {
  id: string;
  content: string;
  type: string;
  createdAt: Date;
  roomId: string;
  senderId: string;
  sender: {
    id: string;
    name: string | null;
    handle: string;
    avatarUrl: string | null;
  } | null;
  reactions: { emoji: string; count: number; myReaction: boolean }[];
}

export async function getRoomMessages(
  roomId: string,
  userId: string,
  cursor?: string,
  limit = 20
): Promise<{ messages: MessageWithMeta[]; nextCursor: string | null }> {
  const messages = await prisma.message.findMany({
    where: {
      roomId,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    include: {
      reactions: { select: { userId: true, emoji: true } },
    },
  });

  const hasMore = messages.length > limit;
  const page = hasMore ? messages.slice(0, limit) : messages;

  // Fetch sender profiles
  const senderIds = [...new Set(page.map((m) => m.senderId))];
  const profiles = await prisma.profile.findMany({
    where: { id: { in: senderIds } },
    select: { id: true, name: true, handle: true, avatarUrl: true },
  });
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));

  const result: MessageWithMeta[] = page.map((msg) => {
    // Group reactions by emoji
    const grouped = new Map<string, { count: number; myReaction: boolean }>();
    for (const r of msg.reactions) {
      if (!grouped.has(r.emoji)) grouped.set(r.emoji, { count: 0, myReaction: false });
      const entry = grouped.get(r.emoji)!;
      entry.count++;
      if (r.userId === userId) entry.myReaction = true;
    }
    return {
      id: msg.id,
      content: msg.content,
      type: msg.type,
      createdAt: msg.createdAt,
      roomId: msg.roomId,
      senderId: msg.senderId,
      sender: profileMap[msg.senderId] ?? null,
      reactions: Array.from(grouped.entries()).map(([emoji, val]) => ({
        emoji,
        count: val.count,
        myReaction: val.myReaction,
      })),
    };
  });

  const nextCursor =
    hasMore ? page[page.length - 1]!.createdAt.toISOString() : null;

  return { messages: result, nextCursor };
}

export async function createMessage(data: {
  roomId: string;
  senderId: string;
  content: string;
  type?: string;
}): Promise<MessageWithMeta> {
  const msg = await prisma.message.create({
    data: {
      roomId: data.roomId,
      senderId: data.senderId,
      content: data.content,
      type: data.type ?? "user",
    },
  });

  // Update room lastActivityAt + preview
  await prisma.room.update({
    where: { id: data.roomId },
    data: {
      lastActivityAt: msg.createdAt,
      lastMessagePreview: data.content.substring(0, 60),
    },
  });

  const sender =
    data.type === "system"
      ? null
      : await prisma.profile.findUnique({
          where: { id: data.senderId },
          select: { id: true, name: true, handle: true, avatarUrl: true },
        });

  return {
    id: msg.id,
    content: msg.content,
    type: msg.type,
    createdAt: msg.createdAt,
    roomId: msg.roomId,
    senderId: msg.senderId,
    sender: sender ?? null,
    reactions: [],
  };
}

export async function toggleReaction(
  messageId: string,
  userId: string,
  emoji: string
): Promise<{ added: boolean }> {
  const existing = await prisma.reaction.findUnique({
    where: { messageId_userId_emoji: { messageId, userId, emoji } },
  });

  if (existing) {
    await prisma.reaction.delete({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
    });
    return { added: false };
  } else {
    await prisma.reaction.create({ data: { messageId, userId, emoji } });
    return { added: true };
  }
}

export async function getReactionSummary(
  messageId: string,
  userId: string
): Promise<{ emoji: string; count: number; myReaction: boolean }[]> {
  const reactions = await prisma.reaction.findMany({
    where: { messageId },
    select: { emoji: true, userId: true },
  });

  const grouped = new Map<string, { count: number; myReaction: boolean }>();
  for (const r of reactions) {
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
