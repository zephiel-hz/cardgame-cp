import * as dotenv from "dotenv";
import { db } from "./server/db.ts";
import { eq } from "drizzle-orm";
import { users, userCards } from "./shared/schema.ts";

dotenv.config({ path: ".env.local" });

async function checkCards() {
  try {
    console.log("\n=== USER CARDS DEBUG ===\n");
    
    // Get all users
    const allUsers = await db.query.users.findMany();
    console.log("All users:");
    allUsers.forEach(u => {
      console.log(`  ID: ${u.id}, Username: ${u.username}, Partner: ${u.partnerId}`);
    });
    
    // Get all active cards
    console.log("\nAll cards with status='active':");
    const allActiveCards = await db.query.userCards.findMany({
      where: eq(userCards.status, "active"),
      with: { card: true, user: true }
    });
    
    if (allActiveCards.length === 0) {
      console.log("  No active cards in database!");
    } else {
      allActiveCards.forEach(uc => {
        console.log(`  Card ID: ${uc.id}`);
        console.log(`    User: ${uc.user.username} (ID: ${uc.userId})`);
        console.log(`    Card: ${uc.card.name}`);
        console.log(`    Activated: ${uc.activatedAt}`);
        console.log(`    Expires: ${uc.expiresAt}`);
        console.log(`    Now: ${new Date().toISOString()}`);
        if (uc.expiresAt) {
          const diff = new Date(uc.expiresAt).getTime() - Date.now();
          console.log(`    Time remaining: ${diff}ms (${(diff/1000/60).toFixed(1)} minutes)`);
        }
      });
    }
    
    // Check user 17 specifically
    console.log("\nUser 17 (testacc2) details:");
    const user17 = await db.query.users.findFirst({
      where: eq(users.id, 17)
    });
    if (user17) {
      console.log(`  Username: ${user17.username}`);
      console.log(`  Partner ID: ${user17.partnerId}`);
      
      if (user17.partnerId) {
        const partner = await db.query.users.findFirst({
          where: eq(users.id, user17.partnerId)
        });
        if (partner) {
          console.log(`  Partner: ${partner.username} (ID: ${partner.id})`);
          
          // Get partner's active cards
          const partnerCards = await db.query.userCards.findMany({
            where: eq(userCards.userId, partner.id),
            with: { card: true }
          });
          console.log(`  Partner's ALL cards: ${partnerCards.length}`);
          
          partnerCards.forEach(uc => {
            console.log(`    - ${uc.card.name} (Status: ${uc.status}, Expires: ${uc.expiresAt})`);
          });
          
          // Filter for active
          const partnerActiveCards = partnerCards.filter(c => c.status === 'active');
          console.log(`  Partner's ACTIVE cards: ${partnerActiveCards.length}`);
          
          partnerActiveCards.forEach(uc => {
            const expiresAt = new Date(uc.expiresAt).getTime();
            const now = Date.now();
            const isStillActive = expiresAt > now;
            console.log(`    - ${uc.card.name} (Expires: ${uc.expiresAt}, Still active: ${isStillActive})`);
          });
        }
      } else {
        console.log("  User has NO PARTNER!");
      }
    } else {
      console.log("  User 17 not found!");
    }
    
  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit(0);
  }
}

checkCards();
