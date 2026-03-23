-- Create card_trades table for trading functionality
CREATE TABLE IF NOT EXISTS "card_trades" (
  "id" serial PRIMARY KEY,
  "initiator_id" integer NOT NULL REFERENCES "users"("id"),
  "recipient_id" integer NOT NULL REFERENCES "users"("id"),
  "initiator_offering_card_ids" jsonb NOT NULL,
  "recipient_offering_card_ids" jsonb,
  "message" text,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamp NOT NULL DEFAULT NOW(),
  "responded_at" timestamp,
  "completed_at" timestamp,
  "expires_at" timestamp NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS "card_trades_recipient_pending" 
  ON "card_trades"("recipient_id", "status") 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS "card_trades_initiator_id" 
  ON "card_trades"("initiator_id");

CREATE INDEX IF NOT EXISTS "card_trades_status" 
  ON "card_trades"("status");

-- Add locked_in_trade status to user_cards if not exists
-- Note: We'll handle this in a separate migration or in code
ALTER TABLE "user_cards" 
ADD COLUMN IF NOT EXISTS "trade_id" integer REFERENCES "card_trades"("id");

CREATE INDEX IF NOT EXISTS "user_cards_trade_id" 
  ON "user_cards"("trade_id");
