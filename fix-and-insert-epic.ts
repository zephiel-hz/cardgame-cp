import { db } from "./server/db.ts";
import { cards } from "./shared/schema.ts";
import { config } from "dotenv";
import { sql } from "drizzle-orm";

config({ path: ".env.local" });

async function fixAndInsert() {
  try {
    console.log("[Fix] Checking current cards...");
    const allCards = await db.select().from(cards);
    const maxId = Math.max(...allCards.map(c => c.id || 0));
    console.log("[Fix] Max ID in database:", maxId);
    
    // Reset sequence
    console.log("[Fix] Resetting sequence...");
    await db.execute(sql`SELECT setval('cards_id_seq', ${maxId + 1});`);
    console.log("[Fix] ✅ Sequence reset to", maxId + 1);
    
    // Now insert Epic cards via Drizzle (should auto-generate IDs)
    console.log("[Fix] Inserting Epic cards...");
    const epicCards = [
      { name: "Kartu Photo Challenge Ekstrem", tier: "Epic", durationMinutes: 120, description: "Target wajib kirim 10 foto pose kocak dalam 2 jam dengan caption lucu." },
      { name: "Kartu Panggilan Romantis Paksa", tier: "Epic", durationMinutes: 60, description: "Target harus dengarkan panggilan suara 1 jam penuh, boleh obrolan biasa." },
      { name: "Kartu Curhat Wajib Dengar", tier: "Epic", durationMinutes: 90, description: "Curhat sesuka hati selama 90 menit, target harus dengarkan dan membalas serius." },
      { name: "Kartu Surprise Date Plan", tier: "Epic", durationMinutes: 1440, description: "Rancang surprise date untuk 2 minggu, target gak perlu belanja tapi harus datang." },
    ];
    
    for (const card of epicCards) {
      await db.insert(cards).values(card);
      console.log(`[Fix] ✅ Inserted: ${card.name}`);
    }
    
    console.log("[Fix] Done!");
    process.exit(0);
  } catch (err) {
    console.error("[Fix] Error:", err);
    process.exit(1);
  }
}

fixAndInsert();
