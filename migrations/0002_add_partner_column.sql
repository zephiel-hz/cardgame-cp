-- Add partner column to users table for partner pairing feature
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "partner_id" integer REFERENCES "users"("id");
