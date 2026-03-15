-- Create partnership_removal_requests table
CREATE TABLE IF NOT EXISTS "partnership_removal_requests" (
  "id" serial PRIMARY KEY,
  "initiator_id" integer NOT NULL REFERENCES "users"("id"),
  "partner_id" integer NOT NULL REFERENCES "users"("id"),
  "initiator_accepted" boolean NOT NULL DEFAULT true,
  "partner_accepted" boolean,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamp NOT NULL DEFAULT NOW(),
  "responded_at" timestamp
);

-- Create indexes for querying pending removal requests
CREATE INDEX IF NOT EXISTS "partnership_removal_requests_partner_idx" ON "partnership_removal_requests"("partner_id", "status");
CREATE INDEX IF NOT EXISTS "partnership_removal_requests_initiator_idx" ON "partnership_removal_requests"("initiator_id", "status");
