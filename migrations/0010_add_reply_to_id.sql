ALTER TABLE "messages" ADD COLUMN "reply_to_id" integer REFERENCES "messages"("id");
