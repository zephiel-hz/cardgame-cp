import { db } from "./server/db.ts";
import { users, userCards } from "./shared/schema.ts";
import { config } from "dotenv";

config({ path: ".env.local" });

async function checkDatabase() {
  try {
    console.log("[Check] Checking database...");
    
    const allUsers = await db.select().from(users);
    console.log("[Check] Total users:", allUsers.length);
    allUsers.forEach(u => console.log(`  - ${u.username} (ID: ${u.id})`));
    
    const allUserCards = await db.select().from(userCards);
    console.log("[Check] Total user_cards:", allUserCards.length);
    
    // Count cards per user
    const cardsPerUser = {};
    allUserCards.forEach(uc => {
      if (!cardsPerUser[uc.userId]) cardsPerUser[uc.userId] = 0;
      cardsPerUser[uc.userId]++;
    });
    
    console.log("[Check] Cards per user:");
    Object.keys(cardsPerUser).forEach(userId => {
      const user = allUsers.find(u => u.id == userId);
      console.log(`  - ${user?.username}: ${cardsPerUser[userId]} cards`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error("[Check] ERROR:", err);
    process.exit(1);
  }
}

checkDatabase();
