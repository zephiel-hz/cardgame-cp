CREATE TABLE IF NOT EXISTS "message_reactions" (
    "id" serial PRIMARY KEY NOT NULL,
    "message_id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "emoji" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    FOREIGN KEY ("message_id") REFERENCES "messages"("id"),
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
);

-- Add unique constraint to ensure one reaction per user per message
CREATE UNIQUE INDEX "message_user_reaction_unique" ON "message_reactions" ("message_id", "user_id");
