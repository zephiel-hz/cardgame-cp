// Direct SQL migration for message_reactions table
import { sql } from "drizzle-orm";
import { db } from "./server/db";

async function applyMigration() {
  try {
    console.log("🔄 Creating message_reactions table...");
    
    // Create table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "message_reactions" (
        "id" serial PRIMARY KEY NOT NULL,
        "message_id" integer NOT NULL,
        "user_id" integer NOT NULL,
        "emoji" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        FOREIGN KEY ("message_id") REFERENCES "messages"("id"),
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
      )
    `);
    
    console.log("✓ Table created");
    
    // Create unique index
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "message_user_reaction_unique" 
      ON "message_reactions" ("message_id", "user_id")
    `);
    
    console.log("✓ Unique index created");
    console.log("✅ Migration completed successfully!");
    process.exit(0);
  } catch (err: any) {
    if (err.message?.includes("already exists") || err.message?.includes("duplicate")) {
      console.log("ℹ️  Table already exists, skipping...");
      console.log("✅ Migration completed!");
      process.exit(0);
    }
    console.error("❌ Migration failed:", err.message);
    console.error(err);
    process.exit(1);
  }
}

applyMigration();
