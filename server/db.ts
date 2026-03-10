import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { config } from "dotenv";

config({ path: ".env.local" });

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure connection pool with proper timeout settings for production
const poolConfig: pg.PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  // Connection pool settings
  max: 20, // Maximum 20 concurrent connections
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 10000, // 10 second timeout for acquiring a connection
  application_name: 'cardgame-app',
  // Statement timeout (5 minutes)
  statement_timeout: 300000,
};

export const pool = new Pool(poolConfig);

// Handle pool errors
pool.on('error', (err) => {
  console.error('[Pool Error] Unexpected error on idle client', err);
});

export const db = drizzle(pool, { schema });
