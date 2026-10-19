CREATE TABLE "budget_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"effective_from" varchar(7) NOT NULL,
	"monthly_limit" numeric(14, 2),
	"savings_target" numeric(14, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_plans_effective_from_unique" UNIQUE("effective_from")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "is_savings" boolean DEFAULT false NOT NULL;