import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, categories, notifications, scheduledPayments, transactions, type ScheduledPayment } from "@/db/schema";
import { matchCategory } from "./email/parser";
import { formatYmd, localToUtc, money, toLocalYmd } from "./format";
import { getT, fmt } from "@/i18n/server";
import { advanceDue, diffDays, dueLabel, FREQUENCIES, type Frequency } from "./payments-shared";
import { appSettings, currencyInfo } from "./settings";
import { uid } from "./context";

export type PaymentView = ScheduledPayment & {
  accountName: string | null;
  toAccountName: string | null;
  daysLeft: number;
  /** Dentro de la ventana de recordatorios (o vencido): aparece en el Resumen */
  remind: boolean;
  /** Financiamientos: cuotas que faltan (incluida la próxima) y saldo pendiente */
  remainingInstallments: number | null;
  remainingAmount: number | null;
  /** Fecha estimada de la última cuota */
  endsOn: string | null;
};

export const today = () => toLocalYmd(new Date());

/** Monto en la moneda principal (null si no hay tasa). */
export function toBase(amount: number, currency: string) {
  if (currency === appSettings().baseCurrency) return amount;
  const rate = currencyInfo(currency)?.rate;
  return rate == null ? null : amount * rate;
}

function view(p: ScheduledPayment, names: Map<number, string>, now: string): PaymentView {
  const daysLeft = diffDays(p.nextDue, now);
  const window = Math.max(3, ...p.reminderDays);
  let remainingInstallments: number | null = null;
  let remainingAmount: number | null = null;
  let endsOn: string | null = null;
  if (p.kind === "financing" && p.totalInstallments && p.currentInstallment) {
    remainingInstallments = Math.max(0, p.totalInstallments - p.currentInstallment + 1);
    remainingAmount = p.amount ? remainingInstallments * Number(p.amount) : null;
    endsOn = p.nextDue;
    for (let i = 1; i < remainingInstallments && i < 600; i++) endsOn = advanceDue(endsOn, p.frequency, p.anchorDay);
  }
  return {
    ...p,
    accountName: p.accountId ? (names.get(p.accountId) ?? null) : null,
    toAccountName: p.toAccountId ? (names.get(p.toAccountId) ?? null) : null,
    daysLeft,
    remind: p.active && daysLeft <= window,
    remainingInstallments,
    remainingAmount,
    endsOn,
  };
}

async function accountNames() {
  const rows = await db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(eq(accounts.userId, uid()));
  return new Map(rows.map((r) => [r.id, r.name]));
}

export async function listPayments(): Promise<PaymentView[]> {
  const [rows, names] = await Promise.all([db.select().from(scheduledPayments).where(eq(scheduledPayments.userId, uid())).orderBy(asc(scheduledPayments.nextDue), asc(scheduledPayments.id)), accountNames()]);
  const now = today();
  return rows.map((p) => view(p, names, now));
}

/** Pagos vencidos o dentro de su ventana de recordatorio, para el Resumen. */
export async function paymentReminders() {
  const [rows, names] = await Promise.all([
    db
      .select()
      .from(scheduledPayments)
      .where(and(eq(scheduledPayments.userId, uid()), eq(scheduledPayments.active, true)))
      .orderBy(asc(scheduledPayments.nextDue)),
    accountNames(),
  ]);
  const now = today();
  return rows.map((p) => view(p, names, now)).filter((p) => p.remind);
}

/** Línea secundaria: "Cuota 13 de 60 · se carga a Visa BAC". Con `installment: false` omite la cuota. */
export function paymentDetail(p: PaymentView, { installment = true } = {}) {
  const t = getT().payments;
  const parts: string[] = [];
  if (p.kind === "financing") {
    if (p.subtype && t.financingTypes[p.subtype]) parts.push(t.financingTypes[p.subtype]);
    if (installment && p.currentInstallment && p.totalInstallments)
      parts.push(fmt(t.detail.installmentOf, { current: p.currentInstallment, total: p.totalInstallments }));
  }
  if (p.kind === "deposit") parts.push(fmt(t.detail.to, { name: p.toAccountName ?? p.destination ?? t.detail.otherAccount }));
  if (p.payMode === "auto") parts.push(p.accountName ? fmt(t.detail.chargedTo, { name: p.accountName }) : t.detail.autoCharge);
  else if (p.accountName && p.kind !== "deposit") parts.push(fmt(t.detail.from, { name: p.accountName }));
  const s = parts.join(" · ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function amountText(p: Pick<ScheduledPayment, "amount" | "currency">) {
  return p.amount ? money(p.amount, p.currency) : getT().payments.detail.variableAmount;
}

/** Totales para la cabecera de Pagos (en moneda principal). */
export function paymentTotals(list: PaymentView[]) {
  let monthly = 0;
  let debt = 0;
  let week = 0;
  let weekCount = 0;
  for (const p of list) {
    if (!p.active) continue;
    const amt = p.amount ? toBase(Number(p.amount), p.currency) : null;
    if (amt !== null) monthly += amt * (FREQUENCIES[p.frequency as Frequency]?.perMonth ?? 0);
    if (p.remainingAmount) debt += toBase(p.remainingAmount, p.currency) ?? 0;
    if (p.daysLeft <= 7) {
      weekCount++;
      if (amt !== null) week += amt;
    }
  }
  return { monthly, debt, week, weekCount };
}

// ─── Registro de pagos ─────────────────────────────────────────────────────────

/** Crea el movimiento de un pago: gasto, o transferencia/ingreso si es un depósito a una cuenta propia. */
export async function recordPaymentTransaction(p: ScheduledPayment, amount: number, ymd: string, accountId: number | null) {
  const userId = uid();
  // El pago tiene que ser del usuario actual
  if (p.userId !== userId) throw new Error("Pago no encontrado");
  // Los textos se guardan en el idioma actual
  const t = getT().payments.records;
  const installment =
    p.kind === "financing" && p.currentInstallment && p.totalInstallments ? fmt(t.installment, { current: p.currentInstallment, total: p.totalInstallments }) : null;
  const base = {
    date: localToUtc(ymd),
    amount: amount.toFixed(2),
    currency: p.currency,
    merchant: p.name,
    description: installment ?? (p.kind === "deposit" ? t.deposit : t.payment),
    source: "manual" as const,
    scheduledPaymentId: p.id,
    userId,
  };
  if (p.kind === "deposit" && p.toAccountId) {
    if (accountId && accountId !== p.toAccountId) {
      await db.insert(transactions).values({ ...base, type: "transfer", accountId, toAccountId: p.toAccountId });
    } else {
      await db.insert(transactions).values({ ...base, type: "income", accountId: p.toAccountId });
    }
    return;
  }
  let categoryId = p.categoryId;
  if (!categoryId) {
    const cats = await db
      .select()
      .from(categories)
      .where(and(eq(categories.userId, userId), eq(categories.kind, "expense")));
    categoryId = matchCategory(cats, p.name)?.id ?? null;
  }
  await db.insert(transactions).values({ ...base, type: "expense", accountId, categoryId });
}

/** Pasa al siguiente vencimiento (y a la siguiente cuota). Desactiva los de una vez y los financiamientos terminados. */
export async function advancePayment(p: ScheduledPayment): Promise<ScheduledPayment> {
  const userId = uid();
  if (p.userId !== userId) throw new Error("Pago no encontrado");
  const nextInstallment = p.currentInstallment ? p.currentInstallment + 1 : null;
  const finished = p.frequency === "once" || (p.kind === "financing" && !!p.totalInstallments && !!nextInstallment && nextInstallment > p.totalInstallments);
  const [updated] = await db
    .update(scheduledPayments)
    .set({
      nextDue: finished ? p.nextDue : advanceDue(p.nextDue, p.frequency, p.anchorDay),
      currentInstallment: finished && p.kind === "financing" ? p.totalInstallments : nextInstallment,
      active: !finished,
      lastPaidAt: new Date(),
    })
    .where(and(eq(scheduledPayments.id, p.id), eq(scheduledPayments.userId, userId)))
    .returning();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), eq(notifications.paymentId, p.id), isNull(notifications.readAt)));
  if (finished && p.kind === "financing") {
    const t = getT().payments.notify;
    await notify({
      key: `completed:${p.id}`,
      kind: "completed",
      title: fmt(t.completedTitle, { name: p.name }),
      body: p.totalInstallments ? fmt(t.completedBody, { total: p.totalInstallments }) : null,
      href: "/payments",
      paymentId: p.id,
    });
  }
  return updated;
}

// ─── Avisos ────────────────────────────────────────────────────────────────────

type NewNotification = { key: string; kind: string; title: string; body?: string | null; href?: string | null; paymentId?: number | null };

/** Crea el aviso si no existía. Los avisos anteriores del mismo pago se marcan como leídos. */
async function notify(n: NewNotification) {
  const userId = uid();
  const [row] = await db
    .insert(notifications)
    .values({ ...n, userId, body: n.body ?? null, href: n.href ?? null, paymentId: n.paymentId ?? null })
    .onConflictDoNothing({ target: [notifications.userId, notifications.key] })
    .returning({ id: notifications.id });
  if (row && n.paymentId) {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(eq(notifications.userId, userId), eq(notifications.paymentId, n.paymentId), isNull(notifications.readAt), ne(notifications.id, row.id)),
      );
  }
}

function reminderBody(p: ScheduledPayment, names: Map<number, string>) {
  const t = getT().payments;
  const parts = [amountText(p)];
  if (p.kind === "financing" && p.currentInstallment && p.totalInstallments)
    parts.push(fmt(t.notify.installmentShort, { current: p.currentInstallment, total: p.totalInstallments }));
  const acc = p.accountId ? names.get(p.accountId) : null;
  if (p.payMode === "auto") parts.push(acc ? fmt(t.detail.chargedTo, { name: acc }) : t.detail.autoCharge);
  else if (p.kind === "deposit")
    parts.push(fmt(t.notify.depositTo, { name: (p.toAccountId && names.get(p.toAccountId)) || p.destination || t.detail.otherAccount }));
  else parts.push(fmt(t.notify.payOn, { date: formatYmd(p.nextDue) }));
  return parts.join(" · ");
}

// Throttle por usuario (cada usuario tiene sus propios pagos)
const g = globalThis as unknown as { __paymentsCheckedAt?: Map<number, number> };
const checkedAt = (g.__paymentsCheckedAt ??= new Map<number, number>());

/**
 * Revisa los pagos activos: registra los cargos automáticos ya vencidos y crea los avisos de la campanita
 * (los días configurados antes, el mismo día y cuando un pago manual se vence).
 * Si el servidor estuvo apagado el día exacto de un aviso, se crea el más reciente que corresponda.
 */
export async function runPaymentScheduler({ force = false } = {}) {
  const userId = uid();
  const last = checkedAt.get(userId);
  if (!force && last && Date.now() - last < 5 * 60_000) return;
  checkedAt.set(userId, Date.now());
  const now = today();
  const [rows, names] = await Promise.all([
    db
      .select()
      .from(scheduledPayments)
      .where(and(eq(scheduledPayments.userId, userId), eq(scheduledPayments.active, true))),
    accountNames(),
  ]);
  // Los avisos se guardan en el idioma actual
  const t = getT().payments;

  for (let p of rows) {
    // Cargos automáticos: al día siguiente del vencimiento se da por cargado
    for (let guard = 0; p.active && p.payMode === "auto" && p.nextDue < now && guard < 24; guard++) {
      if (p.autoRecord && p.amount) await recordPaymentTransaction(p, Number(p.amount), p.nextDue, p.accountId);
      const acc = p.accountId ? names.get(p.accountId) : null;
      const inst = p.kind === "financing" && p.currentInstallment && p.totalInstallments ? ` · ${fmt(t.notify.installmentShort, { current: p.currentInstallment, total: p.totalInstallments })}` : "";
      await notify({
        key: `charged:${p.id}:${p.nextDue}`,
        kind: "charged",
        title: fmt(t.notify.chargedTitle, { name: p.name }),
        body: `${amountText(p)}${inst}${acc ? ` · ${acc}` : ""}${p.autoRecord && p.amount ? ` · ${t.notify.recorded}` : ""}`,
        href: "/payments",
        paymentId: p.id,
      });
      p = await advancePayment(p);
    }
    if (!p.active) continue;

    const left = diffDays(p.nextDue, now);
    if (left < 0) {
      await notify({
        key: `overdue:${p.id}:${p.nextDue}`,
        kind: "overdue",
        title: fmt(t.notify.overdueTitle, { name: p.name }),
        body: fmt(t.notify.overdueBody, { amount: amountText(p), date: formatYmd(p.nextDue) }),
        href: `/payments?pay=${p.id}`,
        paymentId: p.id,
      });
      continue;
    }
    const threshold = [...new Set(p.reminderDays)].filter((d) => d >= 0).sort((a, b) => a - b).find((d) => left <= d);
    if (threshold === undefined) continue;
    await notify({
      key: `due:${p.id}:${p.nextDue}:${threshold}`,
      kind: "reminder",
      title: fmt(t.notify.reminderTitle, { when: dueLabel(left, t.due), name: p.name }),
      body: reminderBody(p, names),
      href: p.payMode === "auto" ? "/payments" : `/payments?pay=${p.id}`,
      paymentId: p.id,
    });
  }

  // Limpieza: avisos leídos de hace más de 90 días
  await db
    .delete(notifications)
    .where(and(eq(notifications.userId, userId), isNotNull(notifications.readAt), lt(notifications.createdAt, sql`now() - interval '90 days'`)));
}

export type NotificationItem = { id: number; kind: string; title: string; body: string | null; href: string | null; read: boolean; createdAt: string };
export type NotificationsSnapshot = { unread: number; items: NotificationItem[] };

export async function notificationsSnapshot(limit = 30): Promise<NotificationsSnapshot> {
  const userId = uid();
  const [rows, [{ n }]] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(limit),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
  ]);
  return {
    unread: n,
    items: rows.map((r) => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, href: r.href, read: r.readAt !== null, createdAt: r.createdAt.toISOString() })),
  };
}

export async function markNotificationsRead(ids?: number[]) {
  if (ids && !ids.length) return;
  const mine = and(eq(notifications.userId, uid()), isNull(notifications.readAt));
  const where = ids ? and(inArray(notifications.id, ids), mine) : mine;
  await db.update(notifications).set({ readAt: new Date() }).where(where);
}
