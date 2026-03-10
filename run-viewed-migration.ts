import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { db } from "./server/db";

config({ path: ".env.local" });

async function runMigration() {
  try {
    console.log("Running migration: Adding viewed_as_new column to user_cards...");
    
    await db.execute(
      sql.raw(`ALTER TABLE "user_cards" ADD COLUMN "viewed_as_new" boolean NOT NULL DEFAULT true;`)
    );
    
    console.log("✓ Migration completed successfully!");
    process.exit(0);
  } catch (error: any) {
    console.error("Migration error:", error.message);
    // If column already exists, that's OK
    if (error.message?.includes("already exists")) {
      console.log("✓ Column already exists, skipping...");
      process.exit(0);
    }
    process.exit(1);
  }
}

runMigration();
