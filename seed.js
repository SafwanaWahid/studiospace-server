import "dotenv/config";
import { MongoClient } from "mongodb";
const email = process.env.SEED_OWNER_EMAIL;
if (!email || !process.env.MONGODB_URI)
  throw new Error("Set MONGODB_URI and SEED_OWNER_EMAIL in .env first.");
const client = new MongoClient(process.env.MONGODB_URI);
try {
  await client.connect();
  const db = client.db(process.env.DB_NAME || "studiospace");
  const user = await db.collection("user").findOne({ email });
  if (!user)
    throw new Error(
      "Register the host account on the website first, then set SEED_OWNER_EMAIL to that email.",
    );
  const sample = [
    [
      "The Daylight Loft",
      "Photo Studio",
      65,
      100,
      12,
      "Dhanmondi, Dhaka",
      "photo-1758613655724-233871324ba6",
      ["Natural light", "Wi-Fi", "Changing room", "Lighting equipment"],
      "A bright, open loft for portraits, fashion stories, and product photography. Large windows bring soft natural light throughout the day. A changing area and flexible furniture help you make the space your own. Please discuss backdrop and equipment needs before arrival.",
    ],
    [
      "Frame One Production Stage",
      "Film Stage",
      120,
      200,
      25,
      "Tejgaon, Dhaka",
      "photo-1745193308101-faf4ddc81ad3",
      ["Wi-Fi", "Air conditioning", "Lighting equipment", "Parking"],
      "A versatile production space for interviews, branded films, and small creative crews. There is room to build a set and work comfortably between takes. Confirm lighting, loading access, and any sound requirements with the host before your session.",
    ],
    [
      "The Conversation Room",
      "Podcast Lounge",
      40,
      50,
      4,
      "Banani, Dhaka",
      "photo-1478737270239-2f02b77fc618",
      ["Microphones", "Soundproofing", "Wi-Fi", "Air conditioning"],
      "An intimate recording lounge for thoughtful interviews and focused conversations. A quiet environment helps guests settle in and find their voice. Contact your host to agree microphone arrangements and recording support.",
    ],
    [
      "Afterhours Sound Suite",
      "Music Suite",
      55,
      100,
      6,
      "Uttara, Dhaka",
      "photo-1598488035139-bdbb2231ce04",
      ["Microphones", "Soundproofing", "Wi-Fi", "Power outlets"],
      "A focused room for vocal recording, listening sessions, and small music collaborations. Comfortable seating and a calm atmosphere make long creative sessions easier. Bring your session files and confirm any instrument or equipment requirements in advance.",
    ],
    [
      "Common Ground Workshop",
      "Workshop",
      35,
      50,
      15,
      "Mirpur, Dhaka",
      "photo-1513364776144-60967b0f800f",
      ["Natural light", "Wi-Fi", "Kitchen", "Restroom"],
      "A welcoming workshop space for art sessions, craft meetups, and hands-on creative learning. Shared tables can be rearranged for your group. Please agree on materials, cleaning, and setup time with the host before booking.",
    ],
    [
      "Colour Room Studio",
      "Photo Studio",
      80,
      120,
      10,
      "Gulshan, Dhaka",
      "photo-1765372860684-69f0e2524694",
      [
        "Seamless backdrop",
        "Lighting equipment",
        "Air conditioning",
        "Changing room",
      ],
      "A flexible portrait and product photography space with a clean aesthetic and room to experiment. Arrange the studio to suit your creative direction. Ask the host about included backdrops and available lighting before the shoot.",
    ],
  ];
  for (const [index, row] of sample.entries()) {
    const [
      title,
      category,
      hourlyRate,
      deposit,
      capacity,
      location,
      image,
      amenities,
      overview,
    ] = row;
    await db.collection("studios").updateOne(
      { seedKey: `studiospace-${index}`, ownerEmail: email },
      {
        $setOnInsert: {
          seedKey: `studiospace-${index}`,
          title,
          category,
          hourlyRate,
          deposit,
          capacity,
          location,
          images: [
            `https://images.unsplash.com/${image}?auto=format&fit=crop&w=1500&q=85`,
          ],
          amenities,
          overview,
          ownerId: String(user._id),
          ownerName: user.name,
          ownerEmail: email,
          ownerImage: user.image || "",
          rating: 0,
          reviewCount: 0,
          bookingVersion: 0,
          createdAt: new Date(Date.now() + index),
        },
      },
      { upsert: true },
    );
  }
  console.log(
    "Six illustrative studio listings created. Existing sample listings were preserved.",
  );
} finally {
  await client.close();
}
