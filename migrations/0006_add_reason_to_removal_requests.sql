-- Add reason column to partnership_removal_requests (required field)
ALTER TABLE "partnership_removal_requests" ADD COLUMN "reason" text;

-- Update existing records with empty string default
UPDATE "partnership_removal_requests" SET "reason" = '' WHERE "reason" IS NULL;

-- Make reason column NOT NULL
ALTER TABLE "partnership_removal_requests" ALTER COLUMN "reason" SET NOT NULL;
