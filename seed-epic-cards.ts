import { db } from "./server/db.ts";
import { cards } from "./shared/schema.ts";
import { config } from "dotenv";
import { eq } from "drizzle-orm";

config({ path: ".env.local" });

async function seedEpicCards() {
  try {
    console.log("[SeedEpic] Starting Epic cards seeding...");
    
    // Check if Epic cards exist
    const existingEpic = await db.select().from(cards).where(eq(cards.tier, "Epic"));
    console.log("[SeedEpic] Existing Epic cards:", existingEpic.length);
    
    if (existingEpic.length === 0) {
      console.log("[SeedEpic] Inserting Epic cards...");
      try {
        const epicCardData = [
          { name: "Kartu Photo Challenge Ekstrem", tier: "Epic" as const, durationMinutes: 120, description: "Target wajib kirim 10 foto pose kocak dalam 2 jam dengan caption lucu." },
          { name: "Kartu Panggilan Romantis Paksa", tier: "Epic" as const, durationMinutes: 60, description: "Target harus dengarkan panggilan suara 1 jam penuh, boleh obrolan biasa." },
          { name: "Kartu Curhat Wajib Dengar", tier: "Epic" as const, durationMinutes: 90, description: "Curhat sesuka hati selama 90 menit, target harus dengarkan dan membalas serius." },
          { name: "Kartu Surprise Date Plan", tier: "Epic" as const, durationMinutes: 1440, description: "Rancang surprise date untuk 2 minggu, target gak perlu belanja tapi harus datang." },
        ];
        
        // Insert one by one to avoid conflicts
        for (const card of epicCardData) {
          try {
            await db.insert(cards).values(card);
            console.log(`[SeedEpic] ✅ Inserted: ${card.name}`);
          } catch (e: any) {
            if (e.code === '23505') {
              console.log(`[SeedEpic] ⚠️ ${card.name} already exists, skipping`);
            } else {
              throw e;
            }
          }
        }
        console.log("[SeedEpic] ✅ Epic cards seeding completed!");
      } catch (err) {
        console.error("[SeedEpic] Insert error:", err);
        throw err;
      }
    } else {
      console.log("[SeedEpic] Epic cards already exist, skipping insertion");
    }
    
    // Display all tier counts
    const allCards = await db.select().from(cards);
    const common = allCards.filter(c => c.tier === "Common").length;
    const rare = allCards.filter(c => c.tier === "Rare").length;
    const epic = allCards.filter(c => c.tier === "Epic").length;
    const ssr = allCards.filter(c => c.tier === "SSR").length;
    
    console.log(`[SeedEpic] Card distribution: Common=${common}, Rare=${rare}, Epic=${epic}, SSR=${ssr}`);
    console.log("[SeedEpic] Done!");
    
    process.exit(0);
  } catch (err) {
    console.error("[SeedEpic] Error:", err);
    process.exit(1);
  }
}

seedEpicCards();
