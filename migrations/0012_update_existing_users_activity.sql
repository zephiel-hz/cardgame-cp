-- Set lastActivityAt for all existing users with NULL values to current time
UPDATE "users" 
SET "last_activity_at" = NOW() 
WHERE "last_activity_at" IS NULL;
