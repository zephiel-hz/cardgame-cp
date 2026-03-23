import { db } from "./server/db";
import { users } from "@shared/schema";

async function checkAndFixDatabase() {
  try {
    console.log("🔍 Checking database schema...");
    
    // Check if last_activity_at column exists
    const columnCheck = await db.execute(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'last_activity_at'
    `);
    
    console.log("Column exists:", columnCheck.rows && columnCheck.rows.length > 0);
    
    if (!columnCheck.rows || columnCheck.rows.length === 0) {
      console.log("❌ Column last_activity_at not found! Adding it now...");
      
      // Add the column
      await db.execute(
        `ALTER TABLE "users" ADD COLUMN "last_activity_at" timestamp NOT NULL DEFAULT now()`
      );
      console.log("✅ Column added successfully!");
      
      // Update existing users
      console.log("📝 Updating existing user records...");
      await db.execute(
        `UPDATE "users" SET "last_activity_at" = NOW() WHERE "last_activity_at" IS NULL`
      );
      console.log("✅ User records updated!");
    } else {
      console.log("✅ Column last_activity_at already exists");
      
      // Check how many users have NULL values
      const nullCheck = await db.execute(
        `SELECT COUNT(*) as count FROM "users" WHERE "last_activity_at" IS NULL`
      );
      
      const nullCount = nullCheck.rows?.[0]?.count || 0;
      console.log(`📊 Users with NULL last_activity_at: ${nullCount}`);
      
      if (nullCount > 0) {
        console.log("📝 Updating NULL records...");
        await db.execute(
          `UPDATE "users" SET "last_activity_at" = NOW() WHERE "last_activity_at" IS NULL`
        );
        console.log("✅ Records updated!");
      }
    }
    
    // Get all columns in users table
    const allColumns = await db.execute(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    console.log("\n📋 Users table columns:");
    allColumns.rows?.forEach((col: any) => {
      console.log(`   - ${col.column_name}: ${col.data_type}`);
    });
    
    console.log("\n✨ Database check complete!");
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

checkAndFixDatabase();
