import { prisma } from "../../config/database";
import { generateHandle, generateReferralCode } from "../../utils/handleGenerator";

interface SetupProfileInput {
  userId: string;
  phone: string;
  name?: string;
  city?: string;
}

export async function setupProfile(input: SetupProfileInput) {
  const existing = await prisma.profile.findUnique({
    where: { id: input.userId },
  });

  if (existing) {
    return existing;
  }

  // Generate unique handle (retry if collision)
  let handle = generateHandle(input.city);
  let attempts = 0;
  while (attempts < 5) {
    const taken = await prisma.profile.findUnique({ where: { handle } });
    if (!taken) break;
    handle = generateHandle(input.city);
    attempts++;
  }

  const referralCode = generateReferralCode(input.name);

  const profile = await prisma.profile.create({
    data: {
      id: input.userId,
      phone: input.phone,
      name: input.name || null,
      handle,
      city: input.city || null,
      referralCode,
    },
  });

  return profile;
}

export async function getProfile(userId: string) {
  return prisma.profile.findUnique({
    where: { id: userId },
  });
}

export async function updateProfile(userId: string, data: { name?: string }) {
  return prisma.profile.update({
    where: { id: userId },
    data,
  });
}
