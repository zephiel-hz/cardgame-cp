-- Add created_at column to user_cards table
ALTER TABLE "user_cards" ADD COLUMN "created_at" timestamp NOT NULL DEFAULT NOW();
