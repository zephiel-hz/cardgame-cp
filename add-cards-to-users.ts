import { db } from "./server/db.ts";
import { users, cards, userCards } from "./shared/schema.ts";
import { config } from "dotenv";
import { eq } from "drizzle-orm";

config({ path: ".env.local" });

async function addCardsToUsers() {
  try {
    console.log("[AddCards] Starting...");
    
    // Get all users
    const allUsers = await db.select().from(users);
    console.log("[AddCards] Users:", allUsers.length, allUsers.map(u => u.username));
    
    // Get all common and rare cards
    const commonCards = await db.select().from(cards).where(eq(cards.tier, "Common"));
    const rareCards = await db.select().from(cards).where(eq(cards.tier, "Rare"));
    const epicCards = await db.select().from(cards).where(eq(cards.tier, "Epic"));
    
    console.log("[AddCards] Common cards available:", commonCards.length);
    console.log("[AddCards] Rare cards available:", rareCards.length);
    console.log("[AddCards] Epic cards available:", epicCards.length);
    
    if (commonCards.length < 5 || rareCards.length < 3) {
      console.warn("[AddCards] ⚠️ Not enough cards! Need 5 common and 3 rare, but have", commonCards.length, "common and", rareCards.length, "rare");
      console.log("[AddCards] Will distribute available cards");
    }
    
    // Distribute cards to users
    const userCardsToInsert = [];
    
    allUsers.forEach((user, userIndex) => {
      console.log(`[AddCards] Adding cards to user: ${user.username} (ID: ${user.id})`);
      
      // Add 5 common cards (rotated for each user)
      for (let i = 0; i < 5; i++) {
        const cardIndex = (userIndex * 5 + i) % commonCards.length;
        userCardsToInsert.push({
          userId: user.id,
          cardId: commonCards[cardIndex].id,
          status: "inventory"
        });
        console.log(`  - Common: ${commonCards[cardIndex].name}`);
      }
      
      // Add 3 rare cards (rotated for each user)
      for (let i = 0; i < 3; i++) {
        const cardIndex = (userIndex * 3 + i) % rareCards.length;
        userCardsToInsert.push({
          userId: user.id,
          cardId: rareCards[cardIndex].id,
          status: "inventory"
        });
        console.log(`  - Rare: ${rareCards[cardIndex].name}`);
      }
      
      // Add 2 epic cards (rotated for each user)
      if (epicCards.length > 0) {
        for (let i = 0; i < 2; i++) {
          const cardIndex = (userIndex * 2 + i) % epicCards.length;
          userCardsToInsert.push({
            userId: user.id,
            cardId: epicCards[cardIndex].id,
            status: "inventory"
          });
          console.log(`  - Epic: ${epicCards[cardIndex].name}`);
        }
      }
    });
    
    console.log(`[AddCards] Total cards to insert: ${userCardsToInsert.length}`);
    
    // Insert all user cards
    if (userCardsToInsert.length > 0) {
      await db.insert(userCards).values(userCardsToInsert);
      console.log("[AddCards] ✅ All cards inserted successfully!");
    }
    
    // Verify
    const allUserCards = await db.select().from(userCards);
    console.log("[AddCards] Total user_cards in database:", allUserCards.length);
    
    process.exit(0);
  } catch (err) {
    console.error("[AddCards] ERROR:", err);
    process.exit(1);
  }
}

addCardsToUsers();
