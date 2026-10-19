ALTER TABLE "email_messages" ADD COLUMN "duplicate_of_id" integer;--> statement-breakpoint
ALTER TABLE "email_messages" ADD COLUMN "duplicate_confirmed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_duplicate_of_id_transactions_id_fk" FOREIGN KEY ("duplicate_of_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Duplicados ya marcados: el id del movimiento original venía en el texto del error ("… #123")
UPDATE "email_messages" m SET "duplicate_of_id" = t."id"
FROM "transactions" t
WHERE m."status" = 'duplicate' AND m."duplicate_of_id" IS NULL
  AND t."user_id" = m."user_id" AND t."id"::text = substring(m."error" from '#(\d+)');
