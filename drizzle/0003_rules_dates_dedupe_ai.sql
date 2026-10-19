ALTER TYPE "public"."email_status" ADD VALUE 'duplicate';--> statement-breakpoint
ALTER TABLE "email_messages" ADD COLUMN "ai_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_rules" ADD COLUMN "date_regex" text;--> statement-breakpoint
ALTER TABLE "email_rules" ADD COLUMN "dedupe_regex" text;--> statement-breakpoint
ALTER TABLE "email_rules" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "dedupe_key" text;--> statement-breakpoint
CREATE INDEX "transactions_dedupe_idx" ON "transactions" USING btree ("dedupe_key");