import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications, scheduledPayments, transactions, type ScheduledPayment, type Transaction } from "@/db/schema";
import { fmt, getT } from "@/i18n/server";
import { uid } from "./context";
import { money, toLocalYmd } from "./format";
import { mailNotification } from "./mailer";
import { advancePayment } from "./payments";
import { addDays, FREQUENCIES, type Frequency } from "./payments-shared";

// Enlace automático entre movimientos y pagos programados: si un gasto trae en el comercio o la
// descripción una de las palabras clave del pago (ej. "ENEE" en "ENEE PAGOS X INTERNET"),
// se da por pagado el vencimiento actual y el movimiento queda vinculado.

export const normalizeText = (s: string | null | undefined) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();

/** Palabras clave normalizadas, sin duplicados ni demasiado cortas (evita falsos positivos). */
export function cleanKeywords(raw: string[]) {
  return Array.from(new Set(raw.map((k) => k.replace(/\s+/g, " ").trim()).filter((k) => normalizeText(k).length >= 3))).slice(0, 20);
}

/**
 * Cuántos días antes del vencimiento cuenta un movimiento como pago de ese vencimiento.
 * Mensual: 24 días (así el pago del mes anterior no salda el siguiente).
 */
export function matchWindowDays(frequency: string) {
  const f = FREQUENCIES[frequency as Frequency];
  if (!f || frequency === "once") return 45;
  const period = f.days ?? (f.months ?? 1) * 30;
  return Math.max(3, Math.min(60, Math.floor(period * 0.8)));
}

function matches(p: ScheduledPayment, tx: Pick<Transaction, "merchant" | "description" | "date">) {
  if (!p.matchKeywords.length) return false;
  const hay = normalizeText(`${tx.merchant ?? ""} ${tx.description ?? ""}`);
  if (!hay) return false;
  if (!p.matchKeywords.some((k) => hay.includes(normalizeText(k)))) return false;
  return toLocalYmd(tx.date) >= addDays(p.nextDue, -matchWindowDays(p.frequency));
}

/** Vincula el movimiento al pago, le pone la categoría del pago si no tenía y pasa al siguiente vencimiento. */
export async function settleWithTransaction(p: ScheduledPayment, tx: Transaction, how: "auto" | "manual") {
  const userId = uid();
  // Pago y movimiento tienen que ser del mismo usuario (el actual)
  if (p.userId !== userId || tx.userId !== userId) throw new Error("Pago o movimiento no encontrado");
  await db
    .update(transactions)
    .set({ scheduledPaymentId: p.id, ...(tx.categoryId || !p.categoryId || tx.type !== "expense" ? {} : { categoryId: p.categoryId }) })
    .where(and(eq(transactions.id, tx.id), eq(transactions.userId, userId)));
  const due = p.nextDue;
  await advancePayment(p);
  if (how === "auto") {
    const t = getT().payments.notify;
    const note = {
      kind: "paid",
      title: fmt(t.paidTitle, { name: p.name }),
      body: fmt(t.paidBody, { amount: money(tx.amount, tx.currency), merchant: tx.merchant || tx.description || t.paidFallback }),
      href: `/transactions?edit=${tx.id}`,
    };
    const [row] = await db
      .insert(notifications)
      .values({ ...note, userId, key: `matched:${p.id}:${due}`, paymentId: p.id })
      .onConflictDoNothing({ target: [notifications.userId, notifications.key] })
      .returning({ id: notifications.id });
    if (row) await mailNotification(note);
  }
}

/** Busca el pago que salda un movimiento recién creado (gastos y transferencias sin vincular). */
export async function matchTransactionToPayment(txId: number) {
  const userId = uid();
  const [tx] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, txId), eq(transactions.userId, userId)));
  if (!tx || tx.scheduledPaymentId || (tx.type !== "expense" && tx.type !== "transfer")) return null;
  const candidates = await db
    .select()
    .from(scheduledPayments)
    .where(
      and(
        eq(scheduledPayments.userId, userId),
        eq(scheduledPayments.active, true),
        sql`cardinality(${scheduledPayments.matchKeywords}) > 0`,
      ),
    )
    .orderBy(asc(scheduledPayments.nextDue));
  const p = candidates.find((c) => matches(c, tx));
  if (!p) return null;
  await settleWithTransaction(p, tx, "auto");
  return p;
}

/**
 * Al crear o editar un pago con palabras clave: si ya llegó un movimiento que lo salda
 * (dentro de la ventana del vencimiento actual), se aplica.
 */
export async function backfillPaymentMatch(paymentId: number) {
  const userId = uid();
  const [p] = await db
    .select()
    .from(scheduledPayments)
    .where(and(eq(scheduledPayments.id, paymentId), eq(scheduledPayments.userId, userId)));
  if (!p || !p.active || !p.matchKeywords.length) return null;
  const since = addDays(p.nextDue, -matchWindowDays(p.frequency));
  const recent = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.scheduledPaymentId),
        inArray(transactions.type, ["expense", "transfer"]),
        gte(transactions.date, sql`(${since}::date - interval '1 day')`),
      ),
    )
    .orderBy(desc(transactions.date))
    .limit(500);
  const tx = recent.find((t) => matches(p, t));
  if (!tx) return null;
  await settleWithTransaction(p, tx, "auto");
  return tx;
}

/** Últimos movimientos vinculados a un pago (historial en su ficha). */
export async function linkedTransactions(paymentId: number, limit = 6) {
  return db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, uid()), eq(transactions.scheduledPaymentId, paymentId)))
    .orderBy(desc(transactions.date))
    .limit(limit);
}

/** Pagos activos para el selector "Salda el pago…" del formulario de movimientos. */
export async function openPaymentsForLinking() {
  return db
    .select({ id: scheduledPayments.id, name: scheduledPayments.name, icon: scheduledPayments.icon, nextDue: scheduledPayments.nextDue })
    .from(scheduledPayments)
    .where(and(eq(scheduledPayments.userId, uid()), eq(scheduledPayments.active, true)))
    .orderBy(asc(scheduledPayments.nextDue));
}

/**
 * Vinculación manual desde un movimiento: salda el pago y, si el comercio no coincidía con
 * ninguna palabra clave, lo agrega para que la próxima vez se detecte solo.
 */
export async function linkTransactionManually(txId: number, paymentId: number) {
  const userId = uid();
  const [[tx], [p]] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, txId), eq(transactions.userId, userId))),
    db
      .select()
      .from(scheduledPayments)
      .where(and(eq(scheduledPayments.id, paymentId), eq(scheduledPayments.userId, userId))),
  ]);
  if (!tx || !p || tx.scheduledPaymentId === p.id) return;
  const label = (tx.merchant || "").trim();
  const hay = normalizeText(`${tx.merchant ?? ""} ${tx.description ?? ""}`);
  if (label && !p.matchKeywords.some((k) => hay.includes(normalizeText(k)))) {
    p.matchKeywords = cleanKeywords([...p.matchKeywords, label]);
    await db
      .update(scheduledPayments)
      .set({ matchKeywords: p.matchKeywords })
      .where(and(eq(scheduledPayments.id, p.id), eq(scheduledPayments.userId, userId)));
  }
  if (p.active) await settleWithTransaction(p, tx, "manual");
  else
    await db
      .update(transactions)
      .set({ scheduledPaymentId: p.id })
      .where(and(eq(transactions.id, tx.id), eq(transactions.userId, userId)));
}
