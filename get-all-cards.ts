import { db } from "./server/db.ts";
import { cards } from "./shared/schema.ts";
import { config } from "dotenv";

config({ path: ".env.local" });

async function getAllCards() {
  try {
    console.log("[GetCards] Fetching all cards from database...\n");
    
    const allCards = await db.select().from(cards).orderBy(cards.id);
    
    if (allCards.length === 0) {
      console.log("❌ No cards found in database");
      process.exit(0);
    }
    
    console.log(`✅ Found ${allCards.length} cards\n`);
    
    // Group by tier
    const byTier: { [key: string]: typeof allCards } = {};
    allCards.forEach(card => {
      if (!byTier[card.tier]) byTier[card.tier] = [];
      byTier[card.tier].push(card);
    });
    
    // Display all cards
    allCards.forEach(card => {
      console.log(`Card ${card.id}: id=${card.id}, name="${card.name}", description="${card.description}", tier="${card.tier}", duration=${card.durationMinutes}`);
    });
    
    console.log("\n📊 Summary by tier:");
    Object.entries(byTier).forEach(([tier, tierCards]) => {
      console.log(`${tier}: ${tierCards.length} cards`);
    });
    
    console.log(`\n📈 Total: ${allCards.length} cards`);
    
    // Generate JSON translation template
    console.log("\n\n=== TRANSLATION FILE TEMPLATE (cards.json) ===\n");
    const translationTemplate: { [key: string]: { name: string; description: string } } = {};
    
    allCards.forEach(card => {
      translationTemplate[`card_${card.id}`] = {
        name: card.name,
        description: card.description
      };
    });
    
    console.log(JSON.stringify(translationTemplate, null, 2));
    
    process.exit(0);
  } catch (err) {
    console.error("[GetCards] Error:", err);
    process.exit(1);
  }
}

getAllCards();
