import { db } from "./server/db.ts";
import { cards } from "./shared/schema.ts";

async function listAllCards() {
  try {
    const allCards = await db.select().from(cards);
    
    console.log(`\n📊 TOTAL CARDS: ${allCards.length}\n`);
    
    allCards.forEach(card => {
      console.log(`card_${card.id}: "${card.name}" (${card.tier})`);
    });
    
    console.log(`\n=== COPY THIS FOR en.json ===\n`);
    
    allCards.forEach(card => {
      console.log(`"card_${card.id}": {
  "name": "${card.name.replace(/"/g, '\\"')}",
  "description": "${card.description.replace(/"/g, '\\"')}"
},`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

listAllCards();
