import { db } from "./server/db.ts";
import { config } from "dotenv";
import { sql } from "drizzle-orm";

config({ path: ".env.local" });

async function insertEpicRaw() {
  try {
    console.log("[InsertEpic] Inserting Epic cards using raw SQL...");
    
    const results = await db.execute(sql`
      INSERT INTO "cards" (name, tier, "duration_minutes", description) VALUES
        ('Kartu Photo Challenge Ekstrem', 'Epic', 120, 'Target wajib kirim 10 foto pose kocak dalam 2 jam dengan caption lucu.'),
        ('Kartu Panggilan Romantis Paksa', 'Epic', 60, 'Target harus dengarkan panggilan suara 1 jam penuh, boleh obrolan biasa.'),
        ('Kartu Curhat Wajib Dengar', 'Epic', 90, 'Curhat sesuka hati selama 90 menit, target harus dengarkan dan membalas serius.'),
        ('Kartu Surprise Date Plan', 'Epic', 1440, 'Rancang surprise date untuk 2 minggu, target gak perlu belanja tapi harus datang.')
    `);
    
    console.log("[InsertEpic] ✅ Epic cards inserted!");
    process.exit(0);
  } catch (err) {
    console.error("[InsertEpic] Error:", err);
    process.exit(1);
  }
}

insertEpicRaw();
