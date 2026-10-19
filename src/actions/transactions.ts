"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { accounts, categories, scheduledPayments, transactions } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { uid } from "@/lib/context";
import { localToUtc, toLocalYmd } from "@/lib/format";
import { matchCategory } from "@/lib/email/parser";
import { linkTransactionManually, matchTransactionToPayment } from "@/lib/payment-matching";
import { ownedAccountId, ownedCategoryId } from "@/lib/queries";
import { appSettings } from "@/lib/settings";
import { fmt, getT } from "@/i18n/server";
import type { FormState } from "./types";

const optionalId = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().positive().nullable());

/** Devuelve el id si el pago programado es del usuario; null si no. */
async function ownedPaymentId(id: number | null | undefined): Promise<number | null> {
  if (!id) return null;
  const [row] = await db
    .select({ id: scheduledPayments.id })
    .from(scheduledPayments)
    .where(and(eq(scheduledPayments.id, id), eq(scheduledPayments.userId, uid())));
  return row?.id ?? null;
}

const txSchema = z.object({
  id: optionalId,
  type: z.enum(["expense", "income", "transfer"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: () => getT().transactions.errors.invalidDate }),
  amount: z.preprocess(
    (v) => Number(String(v ?? "").replace(/,/g, "")),
    z.number({ error: () => getT().transactions.errors.invalidAmount }).positive({ error: () => getT().transactions.errors.amountPositive }),
  ),
  currency: z.string().trim().length(3, { error: () => getT().transactions.errors.currencyLength }).transform((s) => s.toUpperCase()),
  merchant: z.string().trim().max(200).optional(),
  description: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
  accountId: optionalId,
  toAccountId: optionalId,
  categoryId: optionalId,
  // Pago programado que salda este movimiento ("" = ninguno; ausente = no se tocó)
  scheduledPaymentId: optionalId,
  returnTo: z.string().optional(),
});

export async function saveTransaction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  const t = getT();
  const parsed = txSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.common.errors.invalidData };
  const d = parsed.data;
  if (!appSettings().currencies.some((c) => c.code === d.currency)) {
    return { error: fmt(t.transactions.errors.currencyNotConfigured, { currency: d.currency }) };
  }
  if (d.type === "transfer" && !d.toAccountId) {
    return { error: t.transactions.errors.transferNeedsAccounts };
  }
  // Sin origen sólo si es un pago a tarjeta de crédito hecho desde fuera (efectivo, otro banco)
  if (d.type === "transfer" && !d.accountId) {
    const [to] = await db
      .select({ type: accounts.type })
      .from(accounts)
      .where(and(eq(accounts.id, d.toAccountId!), eq(accounts.userId, uid())));
    if (to?.type !== "credit_card") return { error: t.transactions.errors.transferNeedsAccounts };
  }
  if (d.type === "transfer" && d.accountId === d.toAccountId) {
    return { error: t.transactions.errors.transferSameAccount };
  }

  // Ids foráneos: deben ser del usuario actual (si no, se rechaza el formulario)
  const [accountId, toAccountId, ownCategoryId, paymentId] = await Promise.all([
    ownedAccountId(d.accountId),
    d.type === "transfer" ? ownedAccountId(d.toAccountId) : null,
    d.type === "transfer" ? null : ownedCategoryId(d.categoryId),
    ownedPaymentId(d.scheduledPaymentId),
  ]);
  if (
    (d.accountId && !accountId) ||
    (d.type === "transfer" && !toAccountId) ||
    (d.type !== "transfer" && d.categoryId && !ownCategoryId) ||
    (d.scheduledPaymentId && !paymentId)
  ) {
    return { error: t.common.errors.invalidData };
  }

  let categoryId = ownCategoryId;
  if (!categoryId && d.type !== "transfer") {
    const cats = await db
      .select()
      .from(categories)
      .where(and(eq(categories.userId, uid()), eq(categories.kind, d.type)));
    categoryId = matchCategory(cats, d.merchant, d.description)?.id ?? null;
  }

  const values = {
    type: d.type,
    amount: d.amount.toFixed(2),
    currency: d.currency,
    merchant: d.merchant || null,
    description: d.description || null,
    notes: d.notes || null,
    accountId,
    toAccountId: d.type === "transfer" ? toAccountId : null,
    categoryId,
  };

  const linkSent = formData.has("scheduledPaymentId");
  if (d.id) {
    const [existing] = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, d.id), eq(transactions.userId, uid())));
    if (!existing) return { error: t.transactions.errors.notFound };
    // Conserva la hora original si la fecha no cambió (relevante para las importadas por correo)
    const sameDay = toLocalYmd(existing.date) === d.date;
    await db
      .update(transactions)
      .set({ ...values, date: sameDay ? existing.date : localToUtc(d.date), ...(linkSent && !paymentId ? { scheduledPaymentId: null } : {}) })
      .where(and(eq(transactions.id, existing.id), eq(transactions.userId, uid())));
    if (linkSent && paymentId && paymentId !== existing.scheduledPaymentId) {
      await linkTransactionManually(existing.id, paymentId);
    }
  } else {
    const [created] = await db
      .insert(transactions)
      .values({ ...values, userId: uid(), date: localToUtc(d.date), source: "manual" })
      .returning({ id: transactions.id });
    // Elegido a mano, o detectado por las palabras clave del pago (ej. "ENEE")
    if (paymentId) await linkTransactionManually(created.id, paymentId);
    else await matchTransactionToPayment(created.id);
  }
  revalidatePath("/", "layout");
  redirect(d.returnTo && /^\/(?![/\\])/.test(d.returnTo) ? d.returnTo : "/transactions");
}

export async function deleteTransaction(formData: FormData) {
  await requireAuth();
  const id = Number(formData.get("id"));
  if (Number.isInteger(id)) await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, uid())));
  revalidatePath("/", "layout");
  const returnTo = String(formData.get("returnTo") ?? "");
  if (/^\/(?![/\\])/.test(returnTo)) redirect(returnTo);
}

export async function setTransactionCategory(formData: FormData) {
  await requireAuth();
  const id = Number(formData.get("id"));
  const raw = formData.get("categoryId");
  if (!Number.isInteger(id)) return;
  // La categoría debe ser del usuario; si no lo es, no se toca nada
  const categoryId = raw ? await ownedCategoryId(Number(raw)) : null;
  if (raw && !categoryId) return;
  await db
    .update(transactions)
    .set({ categoryId })
    .where(and(eq(transactions.id, id), eq(transactions.userId, uid())));
  revalidatePath("/", "layout");
}
