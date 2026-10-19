CREATE TYPE "public"."payment_kind" AS ENUM('financing', 'service', 'deposit', 'other');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"href" text,
	"payment_id" integer,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "scheduled_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" "payment_kind" DEFAULT 'service' NOT NULL,
	"subtype" text,
	"name" text NOT NULL,
	"icon" text DEFAULT 'receipt' NOT NULL,
	"amount" numeric(14, 2),
	"currency" varchar(3) NOT NULL,
	"frequency" text DEFAULT 'monthly' NOT NULL,
	"anchor_day" integer,
	"next_due" date NOT NULL,
	"pay_mode" text DEFAULT 'manual' NOT NULL,
	"account_id" integer,
	"to_account_id" integer,
	"destination" text,
	"category_id" integer,
	"total_installments" integer,
	"current_installment" integer,
	"reminder_days" integer[] DEFAULT '{0,1,2,3}'::int[] NOT NULL,
	"auto_record" boolean DEFAULT false NOT NULL,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"last_paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_payment_id_scheduled_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."scheduled_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_payments" ADD CONSTRAINT "scheduled_payments_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_payments" ADD CONSTRAINT "scheduled_payments_to_account_id_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_payments" ADD CONSTRAINT "scheduled_payments_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_created_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "scheduled_payments_due_idx" ON "scheduled_payments" USING btree ("next_due");