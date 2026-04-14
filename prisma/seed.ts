import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const rooms = [
  { name: "Late Night Feels",   category: "chill",         lastMessagePreview: "anyone else can't sleep? 😭" },
  { name: "Bollywood Obsessed", category: "entertainment",  lastMessagePreview: "new song from Arijit just dropped 🔥" },
  { name: "Cricket Lounge",     category: "sports",        lastMessagePreview: "IPL tonight who's watching?" },
  { name: "Tech & Startups",    category: "tech",          lastMessagePreview: "anyone building on AI right now?" },
  { name: "Foodie India",       category: "food",          lastMessagePreview: "biryani vs butter chicken — final answer?" },
  { name: "Study Grind",        category: "study",         lastMessagePreview: "pomodoro gang where you at 📚" },
  { name: "Mumbai Vibes",       category: "city",          city: "Mumbai", lastMessagePreview: "local train survival tips lol" },
  { name: "Delhi Nights",       category: "city",          city: "Delhi",  lastMessagePreview: "best dhaba in south delhi?" },
  { name: "Anime India",        category: "entertainment",  lastMessagePreview: "jujutsu kaisen S3 is insane" },
  { name: "Heartbreak Hotel",   category: "chill",         lastMessagePreview: "it's giving 3am sad playlist energy" },
];

async function main() {
  // Only seed if no rooms exist yet
  const existing = await prisma.room.count();
  if (existing > 0) {
    console.log(`Rooms already seeded (${existing} rooms). Skipping.`);
    return;
  }

  await prisma.room.createMany({
    data: rooms.map((r) => ({
      ...r,
      isSeed: true,
      lastActivityAt: new Date(Date.now() - Math.random() * 20 * 60 * 1000),
    })),
  });

  const count = await prisma.room.count();
  console.log(`✅ Seeded ${count} rooms.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
