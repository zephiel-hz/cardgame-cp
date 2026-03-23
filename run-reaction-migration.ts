import { config } from "dotenv";
import * as fs from "fs";
import * as path from "path";
import pg from "pg";

config({ path: ".env.local" });

const client = new pg.Client({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  try {
    await client.connect();
    console.log("✓ Connected to database");

    const migrationPath = path.join("migrations", "0009_add_message_reactions.sql");
    
    if (!fs.existsSync(migrationPath)) {
      console.error("❌ Migration file not found:", migrationPath);
      process.exit(1);
    }

    const migrationContent = fs.readFileSync(migrationPath, "utf-8");
    console.log("\nRunning migration: 0009_add_message_reactions.sql");
    
    // Split by semicolons and execute each statement
    const statements = migrationContent
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    for (const statement of statements) {
      try {
        await client.query(statement);
        console.log(`  ✓ Executed statement`);
      } catch (err: any) {
        // Ignore "already exists" errors
        if (
          err.message.includes("already exists") ||
          err.message.includes("duplicate")
        ) {
          console.log(`  ℹ Skipped (already exists)`);
        } else {
          throw err;
        }
      }
    }

    console.log("\n✓ Migration completed successfully!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
