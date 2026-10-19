-- Multiusuario: cada fila pertenece a un usuario. Los datos existentes pasan al primer usuario.
CREATE TABLE "user_settings" (
	"user_id" integer NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_id" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarded_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "users" SET "onboarded_at" = "created_at";
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_google_id_unique" UNIQUE("google_id");
--> statement-breakpoint
ALTER TABLE "budget_plans" DROP CONSTRAINT "budget_plans_effective_from_unique";
--> statement-breakpoint
ALTER TABLE "email_accounts" DROP CONSTRAINT "email_accounts_address_unique";
--> statement-breakpoint
ALTER TABLE "email_messages" DROP CONSTRAINT "email_messages_message_id_unique";
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_key_unique";
--> statement-breakpoint
DROP INDEX "email_messages_received_idx";
--> statement-breakpoint
DROP INDEX "notifications_created_idx";
--> statement-breakpoint
DROP INDEX "scheduled_payments_due_idx";
--> statement-breakpoint
DROP INDEX "transactions_date_idx";
--> statement-breakpoint
ALTER TABLE "currencies" DROP CONSTRAINT "currencies_pkey";
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "user_id" integer;
--> statement-breakpoint
UPDATE "accounts" SET "user_id" = (SELECT min("id") FROM "users");
--> statement-breakpoint
ALTER TABLE "budget_plans" ADD COLUMN "user_id" integer;
--> statement-breakpoint
UPDATE "budget_plans" SET "user_id" = (SELECT min("id") FROM "users");
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "user_id" integer;
--> statement-breakpoint
UPDATE "categories" SET "user_id" = (SELECT min("id") FROM "users");
--> statement-breakpoint
ALTER TABLE "currencies" ADD COLUMN "user_id" integer;
--> statement-breakpoint
UPDATE "currencies" SET "user_id" = (SELECT min("id") FROM "users");
--> statement-breakpoint
ALTER TABLE "email_accounts" ADD COLUMN "user_id" integer;
--> statement-breakpoint
UPDATE "email_accounts" SET "user_id" = (SELECT min("id") FROM "users");
--> statement-breakpoint
ALTER TABLE "email_messages" ADD COLUMN "user_id" integer;
--> statement-breakpoint
UPDATE "email_messages" SET "user_id" = (SELECT min("id") FROM "users");
--> statement-breakpoint
ALTER TABLE "email_rules" ADD COLUMN "user_id" integer;
--> statement-breakpoint
UPDATE "email_rules" SET "user_id" = (SELECT min("id") FROM "users");
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "user_id" integer;
--> statement-breakpoint
UPDATE "notifications" SET "user_id" = (SELECT min("id") FROM "users");
--> statement-breakpoint
ALTER TABLE "scheduled_payments" ADD COLUMN "user_id" integer;
--> statement-breakpoint
UPDATE "scheduled_payments" SET "user_id" = (SELECT min("id") FROM "users");
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "user_id" integer;
--> statement-breakpoint
UPDATE "transactions" SET "user_id" = (SELECT min("id") FROM "users");
--> statement-breakpoint
DELETE FROM "notifications" WHERE "user_id" IS NULL;
--> statement-breakpoint
DELETE FROM "transactions" WHERE "user_id" IS NULL;
--> statement-breakpoint
DELETE FROM "email_messages" WHERE "user_id" IS NULL;
--> statement-breakpoint
DELETE FROM "email_rules" WHERE "user_id" IS NULL;
--> statement-breakpoint
DELETE FROM "scheduled_payments" WHERE "user_id" IS NULL;
--> statement-breakpoint
DELETE FROM "budget_plans" WHERE "user_id" IS NULL;
--> statement-breakpoint
DELETE FROM "email_accounts" WHERE "user_id" IS NULL;
--> statement-breakpoint
DELETE FROM "accounts" WHERE "user_id" IS NULL;
--> statement-breakpoint
DELETE FROM "categories" WHERE "user_id" IS NULL;
--> statement-breakpoint
DELETE FROM "currencies" WHERE "user_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "budget_plans" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "currencies" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "email_accounts" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "email_messages" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "email_rules" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "scheduled_payments" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "currencies" ADD CONSTRAINT "currencies_user_id_code_pk" PRIMARY KEY("user_id","code");
--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "budget_plans" ADD CONSTRAINT "budget_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "currencies" ADD CONSTRAINT "currencies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_rules" ADD CONSTRAINT "email_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "scheduled_payments" ADD CONSTRAINT "scheduled_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "email_messages_received_idx" ON "email_messages" USING btree ("user_id","received_at");
--> statement-breakpoint
CREATE INDEX "notifications_created_idx" ON "notifications" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "scheduled_payments_due_idx" ON "scheduled_payments" USING btree ("user_id","next_due");
--> statement-breakpoint
CREATE INDEX "transactions_date_idx" ON "transactions" USING btree ("user_id","date");
--> statement-breakpoint
ALTER TABLE "budget_plans" ADD CONSTRAINT "budget_plans_user_month_unique" UNIQUE("user_id","effective_from");
--> statement-breakpoint
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_user_address_unique" UNIQUE("user_id","address");
--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_user_message_unique" UNIQUE("user_id","message_id");
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_key_unique" UNIQUE("user_id","key");
--> statement-breakpoint
INSERT INTO "user_settings" ("user_id", "key", "value") SELECT (SELECT min("id") FROM "users"), "key", "value" FROM "settings" WHERE "key" <> 'auth.secret' AND EXISTS (SELECT 1 FROM "users");
--> statement-breakpoint
DELETE FROM "settings" WHERE "key" <> 'auth.secret';
