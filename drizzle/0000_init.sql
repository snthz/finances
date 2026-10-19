CREATE TYPE "public"."account_type" AS ENUM('bank', 'credit_card', 'debit_card', 'cash', 'wallet', 'other');--> statement-breakpoint
CREATE TYPE "public"."category_kind" AS ENUM('expense', 'income');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('parsed', 'unmatched', 'ignored', 'error');--> statement-breakpoint
CREATE TYPE "public"."tx_source" AS ENUM('manual', 'email');--> statement-breakpoint
CREATE TYPE "public"."tx_type" AS ENUM('expense', 'income', 'transfer');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" "account_type" DEFAULT 'bank' NOT NULL,
	"institution" text,
	"currency" varchar(3) NOT NULL,
	"identifiers" text[] DEFAULT '{}'::text[] NOT NULL,
	"initial_balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"color" varchar(9) DEFAULT '#2a78d6' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" "category_kind" DEFAULT 'expense' NOT NULL,
	"color" varchar(9) DEFAULT '#2a78d6' NOT NULL,
	"icon" text DEFAULT '•' NOT NULL,
	"monthly_budget" numeric(14, 2),
	"keywords" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "currencies" (
	"code" varchar(3) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"rate" numeric(20, 10),
	"auto_rate" boolean DEFAULT true NOT NULL,
	"rate_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"mailbox" text,
	"uid" integer,
	"from_address" text,
	"subject" text,
	"received_at" timestamp with time zone NOT NULL,
	"body" text,
	"status" "email_status" NOT NULL,
	"rule_id" integer,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_messages_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
CREATE TABLE "email_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"ignore" boolean DEFAULT false NOT NULL,
	"from_pattern" text,
	"subject_pattern" text,
	"body_pattern" text,
	"type" "tx_type" DEFAULT 'expense' NOT NULL,
	"amount_regex" text,
	"merchant_regex" text,
	"identifier_regex" text,
	"currency_regex" text,
	"default_currency" varchar(3),
	"account_id" integer,
	"category_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"type" "tx_type" NOT NULL,
	"currency" varchar(3) NOT NULL,
	"description" text,
	"merchant" text,
	"notes" text,
	"account_id" integer,
	"to_account_id" integer,
	"category_id" integer,
	"source" "tx_source" DEFAULT 'manual' NOT NULL,
	"email_message_id" integer,
	"detected_identifier" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_rule_id_email_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."email_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_rules" ADD CONSTRAINT "email_rules_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_rules" ADD CONSTRAINT "email_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_to_account_id_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_email_message_id_email_messages_id_fk" FOREIGN KEY ("email_message_id") REFERENCES "public"."email_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_messages_received_idx" ON "email_messages" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "transactions_date_idx" ON "transactions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "transactions_account_idx" ON "transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "transactions_category_idx" ON "transactions" USING btree ("category_id");