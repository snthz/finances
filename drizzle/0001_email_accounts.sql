CREATE TABLE "email_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"address" text NOT NULL,
	"host" text DEFAULT 'imap.gmail.com' NOT NULL,
	"port" integer DEFAULT 993 NOT NULL,
	"password_enc" text NOT NULL,
	"mailbox" text DEFAULT 'Finanzas' NOT NULL,
	"realtime" boolean DEFAULT true NOT NULL,
	"initial_days" integer DEFAULT 60 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_accounts_address_unique" UNIQUE("address")
);
--> statement-breakpoint
ALTER TABLE "email_messages" ADD COLUMN "email_account_id" integer;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_email_account_id_email_accounts_id_fk" FOREIGN KEY ("email_account_id") REFERENCES "public"."email_accounts"("id") ON DELETE set null ON UPDATE no action;