import { db } from "./server/db.ts";
import { users, cards as cardsSchema, userCards } from "./shared/schema.ts";
import { config } from "dotenv";
import { eq } from "drizzle-orm";

config({ path: ".env.local" });

async function directSeed() {
  try {
    console.log("[DirectSeed] Starting...");
    
    // Check existing users
    const existingUsers = await db.select().from(users);
    console.log("[DirectSeed] Existing users:", existingUsers.length);
    
    if (existingUsers.length === 0) {
      console.log("[DirectSeed] Inserting users...");
      await db.insert(users).values([
        { username: 'Priatna', pin: '1010' }, 
        { username: 'Cia', pin: '0412' },
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
      console.log("[DirectSeed] Inserting basic cards...");
      await db.insert(cardsSchema).values([
        { name: "Kartu PAP Random", tier: "Common", durationMinutes: 5, description: "Target wajib kirim foto selfie random saat itu juga!" },
        { name: "Kartu Mode Alien", tier: "Common", durationMinutes: 15, description: "Selama 15 menit, target balas chat wajib pakai tambahan kata aneh/typo." },
      ]);
      
      const afterCards = await db.select().from(cardsSchema);
      console.log("[DirectSeed] Cards after insert:", afterCards.length);
    }
    
    // Distribute cards to users
    const allUsers = await db.select().from(users);
    const commonCards = await db.select().from(cardsSchema).where(eq(cardsSchema.tier, "Common"));
    const rareCards = await db.select().from(cardsSchema).where(eq(cardsSchema.tier, "Rare"));
    
    // Check if user_cards already populated for this user
    const existingUserCards = await db.select().from(userCards);
    if (existingUserCards.length === 0 && commonCards.length > 0 && rareCards.length > 0) {
      console.log("[DirectSeed] Distributing cards to users...");
      const userCardsToInsert = [];
      
      allUsers.forEach((user, userIndex) => {
        // Add 5 common cards (rotated)
        for (let i = 0; i < 5; i++) {
          const cardIndex = (userIndex * 5 + i) % commonCards.length;
          userCardsToInsert.push({
            userId: user.id,
            cardId: commonCards[cardIndex].id,
            status: "inventory"
          });
        }
        
        // Add 3 rare cards (rotated)
        for (let i = 0; i < 3; i++) {
          const cardIndex = (userIndex * 3 + i) % rareCards.length;
          userCardsToInsert.push({
            userId: user.id,
            cardId: rareCards[cardIndex].id,
            status: "inventory"
          });
        }
      });
      
      if (userCardsToInsert.length > 0) {
        await db.insert(userCards).values(userCardsToInsert);
        console.log("[DirectSeed] ✅ Cards distributed:", userCardsToInsert.length);
      }
    } else if (existingUserCards.length > 0) {
      console.log("[DirectSeed] User cards already populated:", existingUserCards.length);
    }
    
    console.log("[DirectSeed] Done!");
    process.exit(0);
  } catch (err) {
    console.error("[DirectSeed] ERROR:", err);
    process.exit(1);
  }
}

directSeed();
