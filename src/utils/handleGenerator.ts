const adjectives = [
  "Night", "Chill", "Happy", "Sleepy", "Quiet", "Wild", "Cool", "Lazy",
  "Dreamy", "Sunny", "Moody", "Witty", "Brave", "Lost", "Cozy", "Bold",
  "Funky", "Mellow", "Peppy", "Sassy", "Zen", "Goofy", "Nerdy", "Fierce",
  "Chill", "Mystic", "Jolly", "Silent", "Cosmic", "Golden", "Lucky", "Stormy",
  "Hazy", "Fuzzy", "Snowy", "Starry", "Breezy", "Foggy", "Dusty", "Frosty",
];

const nouns = [
  "Owl", "Cat", "Fox", "Wolf", "Bear", "Panda", "Tiger", "Eagle",
  "Hawk", "Raven", "Phoenix", "Dragon", "Lion", "Deer", "Dolphin", "Koala",
  "Spark", "Cloud", "Moon", "Star", "Wave", "Storm", "Flame", "Echo",
  "Drift", "Pixel", "Byte", "Glitch", "Vibe", "Pulse", "Zen", "Nova",
  "Orbit", "Comet", "Bloom", "Frost", "Shade", "Mist", "Dawn", "Dusk",
];

const citySuffixes: Record<string, string> = {
  "Mumbai": "Mum",
  "Delhi": "Del",
  "Bangalore": "Blr",
  "Hyderabad": "Hyd",
  "Chennai": "Chn",
  "Kolkata": "Kol",
  "Pune": "Pun",
  "Ahmedabad": "Ahd",
  "Jaipur": "Jai",
  "Lucknow": "Lkn",
  "Kochi": "Kch",
  "Indore": "Ind",
  "Chandigarh": "Chd",
  "Goa": "Goa",
  "Vizag": "Viz",
  "Nagpur": "Ngp",
  "Bhopal": "Bpl",
  "Coimbatore": "Cbe",
};

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function generateHandle(city?: string | null): string {
  const adj = randomFrom(adjectives);
  const noun = randomFrom(nouns);
  const suffix = city && citySuffixes[city] ? citySuffixes[city] : randomFrom(Object.values(citySuffixes));
  return `${adj}${noun}_${suffix}`;
}

export function generateReferralCode(name?: string | null): string {
  const base = name ? name.replace(/\s+/g, "").substring(0, 8).toUpperCase() : "USER";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const suffix = Array.from({ length: 2 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `VIBE-${base}-${suffix}`;
}
