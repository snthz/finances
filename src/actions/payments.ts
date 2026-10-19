"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { notifications, scheduledPayments } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { uid } from "@/lib/context";
import { backfillPaymentMatch, cleanKeywords } from "@/lib/payment-matching";
import { advancePayment, markNotificationsRead, recordPaymentTransaction, runPaymentScheduler, today } from "@/lib/payments";
import { getT, fmt } from "@/i18n/server";
import { advanceDue, FINANCING_TYPES, FREQUENCIES, nextOccurrenceOfDay } from "@/lib/payments-shared";
import { ownedAccountId, ownedCategoryId } from "@/lib/queries";
import { appSettings } from "@/lib/settings";
import type { FormState } from "./types";

const optionalId = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().positive().nullable());
const optionalInt = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().nullable());
const optionalAmount = z.preprocess(
  (v) => (String(v ?? "").trim() === "" ? null : Number(String(v).replace(/,/g, ""))),
  z
    .number({ error: () => getT().payments.errors.invalidAmount })
    .positive({ error: () => getT().payments.errors.amountPositive })
    .nullable(),
);

const paymentSchema = z.object({
  id: optionalId,
  kind: z.enum(["financing", "service", "deposit", "other"]),
  subtype: z.string().optional(),
  name: z.string().trim().min(1, { error: () => getT().payments.errors.nameRequired }).max(100),
  icon: z.string().trim().max(40).catch("receipt"),
  amount: optionalAmount,
  currency: z.string().trim().length(3).transform((s) => s.toUpperCase()),
  frequency: z.enum(Object.keys(FREQUENCIES) as [string, ...string[]]),
  day: optionalInt,
  date: z.string().optional(),
  payMode: z.enum(["auto", "manual"]),
  accountId: optionalId,
  destMode: z.enum(["own", "external"]).optional(),
  toAccountId: optionalId,
  destination: z.string().trim().max(200).optional(),
  categoryId: optionalId,
  totalInstallments: optionalInt,
  currentInstallment: optionalInt,
  reminderDays: z.string().optional(),
  matchKeywords: z.string().optional(),
  autoRecord: z.preprocess((v) => v === "on", z.boolean()),
  notes: z.string().trim().max(1000).optional(),
  returnTo: z.string().optional(),
});

// Pagos: sólo se aceptan los del usuario actual
async function ownedPayment(id: number) {
  const [row] = await db
    .select()
    .from(scheduledPayments)
    .where(and(eq(scheduledPayments.id, id), eq(scheduledPayments.userId, uid())));
  return row;
}

const back = (raw: unknown, fallback = "/payments") => {
  const s = String(raw ?? "");
  return /^\/(?![/\\])/.test(s) ? s : fallback;
};

export async function savePayment(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  const t = getT();
  const e = t.payments.errors;
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.common.errors.invalidData };
  const d = parsed.data;
  if (!appSettings().currencies.some((c) => c.code === d.currency)) return { error: fmt(e.addCurrencyFirst, { code: d.currency }) };
  const existing = d.id ? await ownedPayment(d.id) : undefined;
  if (d.id && !existing) return { error: e.notFound };
  // Cuentas y categoría del formulario: sólo si son del usuario
  const [accountId, ownedToAccountId, categoryId] = await Promise.all([
    ownedAccountId(d.accountId),
    ownedAccountId(d.toAccountId),
    ownedCategoryId(d.categoryId),
  ]);
  if ((d.accountId && !accountId) || (d.toAccountId && !ownedToAccountId) || (d.categoryId && !categoryId)) {
    return { error: t.common.errors.invalidData };
  }
  const now = today();

  // Financiamiento: cuota fija y número de cuotas
  let totalInstallments: number | null = null;
  let currentInstallment: number | null = null;
  if (d.kind === "financing") {
    if (!d.amount) return { error: e.installmentAmountRequired };
    if (!d.totalInstallments || d.totalInstallments < 1 || d.totalInstallments > 600) return { error: e.totalInstallmentsRequired };
    const cur = d.currentInstallment ?? 1;
    if (cur < 1 || cur > d.totalInstallments) return { error: fmt(e.currentInstallmentRange, { total: d.totalInstallments }) };
    totalInstallments = d.totalInstallments;
    currentInstallment = cur;
  }

  // Próximo vencimiento: por día del mes (mensual) o por fecha
  let nextDue: string;
  let anchorDay: number | null = null;
  if (d.frequency === "monthly") {
    if (!d.day || d.day < 1 || d.day > 31) return { error: e.dayRequired };
    anchorDay = d.day;
    // Si no cambió el día, conserva el vencimiento actual (puede estar vencido sin pagar)
    nextDue = existing && existing.frequency === "monthly" && existing.anchorDay === d.day ? existing.nextDue : nextOccurrenceOfDay(d.day, now);
  } else {
    if (!d.date || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return { error: e.dateRequired };
    nextDue = d.date;
    anchorDay = FREQUENCIES[d.frequency as keyof typeof FREQUENCIES].months ? Number(d.date.slice(8, 10)) : null;
  }
  if (d.payMode === "auto" && nextDue < now && nextDue !== existing?.nextDue) {
    return { error: e.autoDatePast };
  }

  // Depósitos: a una cuenta propia o a terceros
  const isDeposit = d.kind === "deposit";
  const toAccountId = isDeposit && d.destMode !== "external" ? ownedToAccountId : null;
  const destination = isDeposit && d.destMode === "external" ? d.destination || null : null;
  if (isDeposit && !toAccountId && !destination) return { error: e.depositTargetRequired };
  if (toAccountId && toAccountId === accountId) return { error: e.sameAccount };

  const reminderDays = Array.from(
    new Set(
      (d.reminderDays ?? "")
        .split(",")
        .map((s) => Number(s))
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 30),
    ),
  ).sort((a, b) => a - b);

  const values = {
    kind: d.kind,
    subtype: d.kind === "financing" && d.subtype && (FINANCING_TYPES as readonly string[]).includes(d.subtype) ? d.subtype : null,
    name: d.name,
    icon: d.icon || "receipt",
    amount: d.amount === null ? null : d.amount.toFixed(2),
    currency: d.currency,
    frequency: d.kind === "financing" && d.frequency === "once" ? "monthly" : d.frequency,
    anchorDay,
    nextDue,
    payMode: d.payMode,
    accountId,
    toAccountId,
    destination,
    categoryId: toAccountId ? null : categoryId,
    totalInstallments,
    currentInstallment,
    reminderDays,
    autoRecord: d.payMode === "auto" && d.autoRecord,
    matchKeywords: cleanKeywords((d.matchKeywords ?? "").split(",")),
    notes: d.notes || null,
  };

  let paymentId = existing?.id;
  if (existing) {
    // Un financiamiento terminado que se corrige con cuotas pendientes vuelve a estar activo
    const reactivate = d.kind === "financing" && !existing.active && existing.currentInstallment === existing.totalInstallments && currentInstallment! < totalInstallments!;
    await db
      .update(scheduledPayments)
      .set({ ...values, ...(reactivate ? { active: true } : {}) })
      .where(and(eq(scheduledPayments.id, existing.id), eq(scheduledPayments.userId, uid())));
  } else {
    [{ id: paymentId }] = await db
      .insert(scheduledPayments)
      .values({ ...values, userId: uid() })
      .returning({ id: scheduledPayments.id });
  }
  // Si el cobro ya llegó antes de configurar las palabras clave, se aplica ahora
  if (paymentId && values.matchKeywords.length) await backfillPaymentMatch(paymentId);
  await runPaymentScheduler({ force: true });
  revalidatePath("/", "layout");
  redirect(back(d.returnTo));
}

export async function deletePayment(formData: FormData) {
  await requireAuth();
  const id = Number(formData.get("id"));
  if (Number.isInteger(id)) await db.delete(scheduledPayments).where(and(eq(scheduledPayments.id, id), eq(scheduledPayments.userId, uid())));
  revalidatePath("/", "layout");
  redirect(back(formData.get("returnTo")));
}

/** Pausa o reanuda. Al reanudar, los vencimientos que quedaron atrás se saltan sin cobrarse. */
export async function togglePaymentActive(formData: FormData) {
  await requireAuth();
  const id = Number(formData.get("id"));
  const p = Number.isInteger(id) ? await ownedPayment(id) : undefined;
  if (p) {
    let nextDue = p.nextDue;
    if (!p.active && p.payMode === "auto" && p.frequency !== "once") {
      const now = today();
      for (let i = 0; nextDue < now && i < 600; i++) nextDue = advanceDue(nextDue, p.frequency, p.anchorDay);
    }
    await db
      .update(scheduledPayments)
      .set({ active: !p.active, nextDue })
      .where(and(eq(scheduledPayments.id, p.id), eq(scheduledPayments.userId, uid())));
    // Al pausar, sus avisos pendientes dejan de contar en la campanita
    if (p.active)
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(and(eq(notifications.userId, uid()), eq(notifications.paymentId, p.id), isNull(notifications.readAt)));
    await runPaymentScheduler({ force: true });
  }
  revalidatePath("/", "layout");
  redirect(back(formData.get("returnTo")));
}

const paySchema = z.object({
  id: z.coerce.number().int().positive(),
  amount: optionalAmount,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: () => getT().payments.errors.invalidDate }),
  accountId: optionalId,
  record: z.preprocess((v) => v === "on", z.boolean()),
  returnTo: z.string().optional(),
});

/** Marca el vencimiento actual como pagado (opcionalmente registra el movimiento) y pasa al siguiente. */
export async function markPaymentPaid(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  const t = getT();
  const parsed = paySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.common.errors.invalidData };
  const d = parsed.data;
  const p = await ownedPayment(d.id);
  if (!p) return { error: t.payments.errors.notFound };
  if (d.record) {
    if (!d.amount) return { error: t.payments.errors.paidAmountRequired };
    const accountId = await ownedAccountId(d.accountId);
    if (d.accountId && !accountId) return { error: t.common.errors.invalidData };
    await recordPaymentTransaction(p, d.amount, d.date, accountId);
  }
  await advancePayment(p);
  await runPaymentScheduler({ force: true });
  revalidatePath("/", "layout");
  redirect(back(d.returnTo));
}

// ─── Campanita ────────────────────────────────────────────────────────────────

export async function readNotifications(ids?: number[]) {
  await requireAuth();
  await markNotificationsRead(ids?.filter((n) => Number.isInteger(n)));
}
