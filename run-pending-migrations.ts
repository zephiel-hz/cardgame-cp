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

async function runMigrations() {
  try {
    await client.connect();
    console.log("✓ Connected to database");

    const migrations = [
      "0005_partnership_removal_requests.sql",
      "0006_add_reason_to_removal_requests.sql",
      "0007_add_rejection_reason.sql",
    ];

    for (const migration of migrations) {
      const migrationPath = path.join("migrations", migration);
      if (fs.existsSync(migrationPath)) {
        const migrationContent = fs.readFileSync(migrationPath, "utf-8");
        console.log(`\nRunning migration: ${migration}`);
        
        // Split by semicolons and execute each statement
        const statements = migrationContent
          .split(";")
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.startsWith("--"));

        for (const statement of statements) {
          try {
            await client.query(statement);
            console.log(`  ✓ Executed`);
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
      }
    }

    console.log("\n✅ All migrations completed!");
    await client.end();
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigrations();
