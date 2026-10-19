ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "extra_currencies" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "extra_initial_balances" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
-- Tarjetas que ya tienen cargos en otra moneda: se asume el saldo en dólares (lo usual en tarjetas bimoneda)
UPDATE "accounts" a SET "extra_currencies" = '{USD}'
WHERE a."type" = 'credit_card' AND a."currency" <> 'USD' AND cardinality(a."extra_currencies") = 0
  AND EXISTS (
    SELECT 1 FROM "transactions" t
    WHERE t."user_id" = a."user_id" AND (t."account_id" = a."id" OR t."to_account_id" = a."id") AND t."currency" <> a."currency"
  );
