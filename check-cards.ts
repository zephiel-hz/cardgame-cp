import { db } from "./server/db.ts";
import { cards } from "./shared/schema.ts";
import { config } from "dotenv";

config({ path: ".env.local" });

async function checkCards() {
  try {
    console.log("[Check] Fetching all cards...");
    const allCards = await db.select().from(cards);
    
    // Group by tier
    const byTier: Record<string, any[]> = {};
    allCards.forEach(card => {
      if (!byTier[card.tier]) {
        byTier[card.tier] = [];
      }
      byTier[card.tier].push(card);
    });
    
    console.log("\n[Check] Cards by Tier:");
    Object.entries(byTier).forEach(([tier, cardList]) => {
      console.log(`  ${tier}: ${cardList.length} cards`);
      if (tier === "Epic") {
        cardList.forEach(c => console.log(`    - ${c.name}`));
      }
    });
    
    console.log("[Check] Total cards:", allCards.length);
    process.exit(0);
  } catch (err) {
    console.error("[Check] Error:", err);
    process.exit(1);
  }
}

checkCards();
