"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { accounts, transactions } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { uid } from "@/lib/context";
import { localToUtc } from "@/lib/format";
import { matchTransactionToPayment } from "@/lib/payment-matching";
import { ownedAccountId } from "@/lib/queries";
import { appSettings } from "@/lib/settings";
import { fmt, getT } from "@/i18n/server";
import type { FormState } from "./types";

const optionalId = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().positive().nullable());

const cardPaymentSchema = z.object({
  cardId: z.preprocess(Number, z.number().int().positive()),
  amount: z.preprocess(
    (v) => Number(String(v ?? "").replace(/,/g, "")),
    z.number({ error: () => getT().transactions.errors.invalidAmount }).positive({ error: () => getT().transactions.errors.amountPositive }),
  ),
  currency: z.string().trim().length(3).transform((s) => s.toUpperCase()),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: () => getT().transactions.errors.invalidDate }),
  fromAccountId: optionalId,
  returnTo: z.string().optional(),
});

/** Registra un pago a la tarjeta: transferencia desde una cuenta propia (o desde fuera) hacia la tarjeta. */
export async function recordCardPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  const t = getT();
  const parsed = cardPaymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.common.errors.invalidData };
  const d = parsed.data;
  if (!appSettings().currencies.some((c) => c.code === d.currency)) {
    return { error: fmt(t.transactions.errors.currencyNotConfigured, { currency: d.currency }) };
  }
  const [card] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, d.cardId), eq(accounts.userId, uid()), eq(accounts.type, "credit_card")));
  const fromAccountId = await ownedAccountId(d.fromAccountId);
  if (!card || (d.fromAccountId && !fromAccountId) || fromAccountId === card.id) return { error: t.common.errors.invalidData };

  const [created] = await db
    .insert(transactions)
    .values({
      userId: uid(),
      date: localToUtc(d.date),
      amount: d.amount.toFixed(2),
      type: "transfer",
      currency: d.currency,
      description: fmt(t.cards.paymentDescription, { name: card.name }),
      accountId: fromAccountId,
      toAccountId: card.id,
      source: "manual",
    })
    .returning({ id: transactions.id });
  // Si hay un pago programado para esta tarjeta (por palabras clave), queda saldado
  await matchTransactionToPayment(created.id);
  revalidatePath("/", "layout");
  redirect(d.returnTo && /^\/(?![/\\])/.test(d.returnTo) ? d.returnTo : "/payments");
}
