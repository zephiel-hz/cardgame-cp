CREATE TABLE IF NOT EXISTS "messages_new" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" integer NOT NULL,
	"recipient_id" integer NOT NULL,
	"content" text NOT NULL,
	"reply_to_id" integer,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"read_at" timestamp,
	FOREIGN KEY ("sender_id") REFERENCES "users"("id"),
	FOREIGN KEY ("recipient_id") REFERENCES "users"("id"),
	FOREIGN KEY ("reply_to_id") REFERENCES "messages"("id")
);

ALTER TABLE "users" ADD COLUMN "public_key" text;
