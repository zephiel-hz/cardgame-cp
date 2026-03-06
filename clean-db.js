import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const { Pool } = pg;

async function cleanDatabase() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log("Cleaning database...");
    await pool.query("TRUNCATE TABLE gacha_logs CASCADE");
    await pool.query("TRUNCATE TABLE user_cards CASCADE");
    await pool.query("TRUNCATE TABLE notification_preferences CASCADE");
    await pool.query("TRUNCATE TABLE push_subscriptions CASCADE");
    await pool.query("TRUNCATE TABLE users CASCADE");
    console.log("✅ Database cleaned! All tables truncated.");
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

cleanDatabase();
