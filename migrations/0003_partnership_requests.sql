-- Create partnership_requests table
CREATE TABLE IF NOT EXISTS "partnership_requests" (
  "id" serial PRIMARY KEY,
  "from_user_id" integer NOT NULL REFERENCES "users"("id"),
  "to_user_id" integer NOT NULL REFERENCES "users"("id"),
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamp NOT NULL DEFAULT NOW(),
  "responded_at" timestamp
);

-- Create index on to_user_id for querying pending requests
CREATE INDEX IF NOT EXISTS "partnership_requests_to_user_idx" ON "partnership_requests"("to_user_id", "status");
