-- Run these SQL commands directly in your Supabase/Database console

-- Step 1: Add reason column (if not exists)
ALTER TABLE "partnership_removal_requests" ADD COLUMN IF NOT EXISTS "reason" text;

-- Step 2: Add rejection_reason column (if not exists)
ALTER TABLE "partnership_removal_requests" ADD COLUMN IF NOT EXISTS "rejection_reason" text;

-- Step 3: Update any existing NULL reasons to empty string
UPDATE "partnership_removal_requests" SET "reason" = '' WHERE "reason" IS NULL;

-- Step 4: Set reason as NOT NULL
ALTER TABLE "partnership_removal_requests" ALTER COLUMN "reason" SET NOT NULL;

-- Verify the table structure
\d partnership_removal_requests
