import { pool, db } from "./server/db.ts";
import { users, cards as cardsSchema } from "./shared/schema.ts";
import { config } from "dotenv";

config({ path: ".env.local" });

async function directSeed() {
  try {
    console.log("[DirectSeed] Starting...");
    
    // Check existing users
    const existingUsers = await db.select().from(users);
    console.log("[DirectSeed] Existing users:", existingUsers.length);
    
    if (existingUsers.length === 0) {
      console.log("[DirectSeed] Inserting 2 users...");
      await db.insert(users).values([
        { username: 'kwahsotoo', pin: '1234' },
        { username: 'visimisi', pin: '5678' }
      ]);
      
      const afterInsert = await db.select().from(users);
      console.log("[DirectSeed] Users after insert:", afterInsert.length, afterInsert.map(u => u.username));
    }
    
    // Check existing cards
    const existingCards = await db.select().from(cardsSchema);
    console.log("[DirectSeed] Existing cards:", existingCards.length);
    
    if (existingCards.length === 0) {
      console.log("[DirectSeed] Inserting cards...");
      await db.insert(cardsSchema).values([
        { name: "Kartu PAP Random", tier: "Common", durationMinutes: 5, description: "Target wajib kirim foto selfie random saat itu juga!" },
        { name: "Kartu Mode Alien", tier: "Common", durationMinutes: 15, description: "Selama 15 menit, target balas chat wajib pakai tambahan kata aneh/typo." },
      ]);
      
      const afterCards = await db.select().from(cardsSchema);
      console.log("[DirectSeed] Cards after insert:", afterCards.length);
    }
    
    console.log("[DirectSeed] Done!");
    process.exit(0);
  } catch (err) {
    console.error("[DirectSeed] ERROR:", err);
    process.exit(1);
  }
}

directSeed();
