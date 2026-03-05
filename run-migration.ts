import pg from "pg";
import { config } from "dotenv";
import fs from "fs";

config({ path: ".env.local" });

const { Pool } = pg;

async function runMigration() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    const migrationSQL = fs.readFileSync("./migrations/0001_add_missing_columns.sql", "utf-8");
    console.log("Running migration...");
    console.log(migrationSQL);
    
    await pool.query(migrationSQL);
    console.log("✅ Migration applied successfully!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
