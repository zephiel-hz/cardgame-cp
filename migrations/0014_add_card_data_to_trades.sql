-- Add columns to store actual card data in trades
ALTER TABLE "card_trades"
ADD COLUMN IF NOT EXISTS "initiator_offering_card_data" jsonb,
ADD COLUMN IF NOT EXISTS "recipient_offering_card_data" jsonb;
