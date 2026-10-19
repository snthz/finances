ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "statement_day" integer;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "due_day" integer;--> statement-breakpoint
ALTER TABLE "email_rules" ADD COLUMN IF NOT EXISTS "card_payment" boolean DEFAULT false NOT NULL;