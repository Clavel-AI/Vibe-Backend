import { prisma } from "../../config/database";
import { getRoomMemberCount } from "../../socket/index";

export type ActivityStatus = "active" | "recent" | "quiet";

function getActivityStatus(lastActivityAt: Date): ActivityStatus {
  const diffMs = Date.now() - lastActivityAt.getTime();
  const diffMin = diffMs / 1000 / 60;
  if (diffMin < 2) return "active";
  if (diffMin < 10) return "recent";
  return "quiet";
}

export async function getRooms() {
  const rooms = await prisma.room.findMany({
    orderBy: { lastActivityAt: "desc" },
  });
  return rooms.map((room) => ({
    ...room,
    memberCount: getRoomMemberCount(room.id),
    activityStatus: getActivityStatus(room.lastActivityAt),
  }));
}

export async function getRoomById(id: string, userId?: string) {
  const room = await prisma.room.findUnique({ where: { id } });
  if (!room) return null;

  const isMember = userId
    ? !!(await prisma.roomMember.findUnique({
        where: { roomId_userId: { roomId: id, userId } },
      }))
    : false;

  return {
    ...room,
    memberCount: getRoomMemberCount(room.id),
    activityStatus: getActivityStatus(room.lastActivityAt),
    isMember,
  };
}

export async function isMember(roomId: string, userId: string): Promise<boolean> {
  const record = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });
  return !!record;
}

// Returns true if this was a NEW join (first time)
export async function joinRoom(
  roomId: string,
  userId: string
): Promise<{ isNew: boolean }> {
  const existing = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });
  if (existing) return { isNew: false };

  await prisma.roomMember.create({ data: { roomId, userId } });
  return { isNew: true };
}

export async function leaveRoom(roomId: string, userId: string): Promise<void> {
  await prisma.roomMember.deleteMany({
    where: { roomId, userId },
  });
}
