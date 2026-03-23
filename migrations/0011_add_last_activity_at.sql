ALTER TABLE "users" ADD COLUMN "last_activity_at" timestamp NOT NULL DEFAULT now();
