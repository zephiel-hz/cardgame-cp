import "dotenv/config.js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { messages } from "./shared/schema.ts";
import { sql } from "drizzle-orm";

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

async function queryMessages() {
  try {
    const result = await db
      .select({
        id: messages.id,
        senderId: messages.senderId,
        recipientId: messages.recipientId,
        content: messages.content,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(
        sql`${messages.senderId} IN (16, 17) OR ${messages.recipientId} IN (16, 17)`
      )
      .orderBy(sql`${messages.id} DESC`)
      .limit(15);

    console.log("\n=== MESSAGES BETWEEN testacc1 (16) and testacc2 (17) ===\n");
    result.forEach((msg, idx) => {
      const contentLength = msg.content.length;
      const isLikelyEncrypted = contentLength > 50;
      console.log(
        `[${idx + 1}] ID: ${msg.id} | From: ${msg.senderId} → To: ${msg.recipientId} | Length: ${contentLength} | ${isLikelyEncrypted ? "🔒 ENCRYPTED" : "📄 PLAINTEXT"}`
      );
      console.log(`     Content: ${msg.content.substring(0, 80)}${msg.content.length > 80 ? "..." : ""}`);
      console.log();
    });

    await client.end();
  } catch (err) {
    console.error("Query error:", err);
    process.exit(1);
  }
}

queryMessages();
