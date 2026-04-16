import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const rooms = [
  // Chill
  { name: "Late Night Feels",     category: "chill",          lastMessagePreview: "anyone else can't sleep? 😭" },
  { name: "Heartbreak Hotel",     category: "chill",          lastMessagePreview: "it's giving 3am sad playlist energy" },
  { name: "Lo-fi & Chill",        category: "chill",          lastMessagePreview: "drop your fav lofi playlist 🎧" },
  { name: "Overthinking Club",    category: "chill",          lastMessagePreview: "why do we do this to ourselves 😩" },

  // Entertainment
  { name: "Bollywood Obsessed",   category: "entertainment",  lastMessagePreview: "new song from Arijit just dropped 🔥" },
  { name: "Anime India",          category: "entertainment",  lastMessagePreview: "jujutsu kaisen S3 is insane" },
  { name: "K-Drama Addicts",      category: "entertainment",  lastMessagePreview: "just finished squid game S2 💀" },
  { name: "Meme Central",         category: "entertainment",  lastMessagePreview: "y'all need to see this one 😂" },
  { name: "Marvel vs DC",         category: "entertainment",  lastMessagePreview: "okay but deadpool 3 was GOATED" },

  // Sports
  { name: "Cricket Lounge",       category: "sports",         lastMessagePreview: "IPL tonight who's watching?" },
  { name: "Football Fanatics",    category: "sports",         lastMessagePreview: "messi or ronaldo? wrong answers only" },
  { name: "F1 Pitlane",           category: "sports",         lastMessagePreview: "max is dominating again 🏎️" },

  // Tech
  { name: "Tech & Startups",      category: "tech",           lastMessagePreview: "anyone building on AI right now?" },
  { name: "React Native Devs",    category: "tech",           lastMessagePreview: "expo SDK 54 is wild 🔥" },
  { name: "Side Project Gang",    category: "tech",           lastMessagePreview: "what's everyone shipping this week?" },
  { name: "AI & ML India",        category: "tech",           lastMessagePreview: "finetuned llama 3 on my laptop lol" },

  // Food
  { name: "Foodie India",         category: "food",           lastMessagePreview: "biryani vs butter chicken — final answer?" },
  { name: "Street Food Hunt",     category: "food",           lastMessagePreview: "best pani puri in your city? 🤤" },
  { name: "Midnight Cravings",    category: "food",           lastMessagePreview: "ordering maggi at 2am hits different" },

  // Study
  { name: "Study Grind",          category: "study",          lastMessagePreview: "pomodoro gang where you at 📚" },
  { name: "UPSC Warriors",        category: "study",          lastMessagePreview: "day 47 of revision 💪" },
  { name: "College Confessions",  category: "study",          lastMessagePreview: "3 assignments due tomorrow help 😭" },

  // City
  { name: "Mumbai Vibes",         category: "city",  city: "Mumbai",    lastMessagePreview: "local train survival tips lol" },
  { name: "Delhi Nights",         category: "city",  city: "Delhi",     lastMessagePreview: "best dhaba in south delhi?" },
  { name: "Bangalore Tech Hub",   category: "city",  city: "Bangalore", lastMessagePreview: "koramangala traffic is unreal 😤" },
  { name: "Hyderabad Diaries",    category: "city",  city: "Hyderabad", lastMessagePreview: "paradise biryani > everything" },
  { name: "Pune Peeps",           category: "city",  city: "Pune",      lastMessagePreview: "FC road or JM road tonight?" },
  { name: "Chennai Central",      category: "city",  city: "Chennai",   lastMessagePreview: "filter coffee supremacy ☕" },
  { name: "Kolkata Adda",         category: "city",  city: "Kolkata",   lastMessagePreview: "durga puja vibes year round 🙏" },
  { name: "Kochi Connect",        category: "city",  city: "Kochi",     lastMessagePreview: "fort kochi sunset anyone? 🌅" },
];

async function main() {
  // Find which rooms already exist (by name)
  const existingRooms = await prisma.room.findMany({ select: { name: true } });
  const existingNames = new Set(existingRooms.map((r) => r.name));

  const newRooms = rooms.filter((r) => !existingNames.has(r.name));

  if (newRooms.length === 0) {
    console.log(`All ${rooms.length} rooms already exist. Nothing to add.`);
    return;
  }

  await prisma.room.createMany({
    data: newRooms.map((r) => ({
      ...r,
      isSeed: true,
      lastActivityAt: new Date(Date.now() - Math.random() * 60 * 60 * 1000), // random within last hour
    })),
  });

  const total = await prisma.room.count();
  console.log(`✅ Added ${newRooms.length} new rooms. Total: ${total} rooms.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
