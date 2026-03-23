import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function runPendingMigrations() {
  try {
    console.log("[Migration] Starting migration runner...");
    
    // Run the replyToId migration
    await db.execute(sql`
      ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "reply_to_id" integer REFERENCES "messages"("id");
    `);
    
    console.log("[Migration] ✅ Successfully added reply_to_id column");
  } catch (err) {
    console.error("[Migration] Error:", err);
  }
}

runPendingMigrations();
