import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, transactions, type Account } from "@/db/schema";
import { uid } from "./context";
import { listPayments, today, type PaymentView } from "./payments";
import { addDays, diffDays, dueDateAfter, lastStatementDate } from "./payments-shared";
import { appSettings } from "./settings";

// Estado de las tarjetas de crédito. El pago de una tarjeta es una transferencia hacia ella
// (desde otra cuenta propia o desde fuera), así no cuenta como gasto: el gasto ya se contó en cada compra.

/** Lo que se debe en una moneda de la tarjeta (las tarjetas pueden tener saldo en lempiras y en dólares). */
export type CardCurrency = {
  currency: string;
  /** Saldo de contado: compras y cuotas ya cargadas menos pagos. Negativo = saldo a favor */
  debt: number;
  /** Cuotas pendientes de los financiamientos (extra, intra…) cargados a esta tarjeta */
  financed: number;
  /** Contado + financiado */
  total: number;
  /** Saldo al último corte (null si la tarjeta no tiene día de corte) */
  statementDebt: number | null;
  /** Lo que falta pagar del estado de cuenta para no pagar intereses */
  payoff: number | null;
  /** Gastado y pagado desde el último corte (o en el mes, sin día de corte) */
  spent: number;
  paid: number;
};

export type CardSummary = {
  account: Account;
  /** Último corte, inicio del ciclo actual y fecha límite de pago (YYYY-MM-DD) */
  statement: string | null;
  cycleStart: string;
  due: string | null;
  daysLeft: number | null;
  currencies: CardCurrency[];
  financings: PaymentView[];
  lastPayment: { amount: number; currency: string; date: Date } | null;
};

const round = (n: number) => Math.round(n * 100) / 100;

async function summarize(card: Account, financings: PaymentView[], now: string): Promise<CardSummary> {
  const userId = uid();
  const tz = appSettings().timezone;
  const statement = card.statementDay ? lastStatementDate(card.statementDay, now) : null;
  const cycleStart = statement ? addDays(statement, 1) : `${now.slice(0, 7)}-01`;
  const due = statement && card.dueDay ? dueDateAfter(statement, card.dueDay) : null;

  const local = sql`(${transactions.date} at time zone ${tz})::date`;
  // Entra a la tarjeta (pagos, devoluciones) suma; compras y retiros restan
  const signed = sql`case when ${transactions.toAccountId} = ${card.id} or (${transactions.type} = 'income' and ${transactions.accountId} = ${card.id}) then ${transactions.amount} else -${transactions.amount} end`;
  const [rows, [last]] = await Promise.all([
    db
      .select({
        currency: transactions.currency,
        balance: sql<string>`coalesce(sum(${signed}), 0)`,
        atStatement: statement ? sql<string>`coalesce(sum(${signed}) filter (where ${local} <= ${statement}::date), 0)` : sql<string>`0`,
        spent: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} = 'expense' and ${local} >= ${cycleStart}::date), 0)`,
        paid: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.toAccountId} = ${card.id} and ${local} >= ${cycleStart}::date), 0)`,
      })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), sql`(${transactions.accountId} = ${card.id} or ${transactions.toAccountId} = ${card.id})`))
      .groupBy(transactions.currency),
    db
      .select({ amount: transactions.amount, currency: transactions.currency, date: transactions.date })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.type, "transfer"), eq(transactions.toAccountId, card.id)))
      .orderBy(desc(transactions.date))
      .limit(1),
  ]);

  const mine = financings.filter((p) => p.accountId === card.id);
  const codes = new Set([card.currency, ...rows.map((r) => r.currency), ...mine.map((p) => p.currency)]);
  const currencies: CardCurrency[] = [];
  for (const currency of codes) {
    const r = rows.find((x) => x.currency === currency);
    // El saldo inicial (negativo = deuda) está en la moneda de la cuenta
    const initial = currency === card.currency ? Number(card.initialBalance) : 0;
    const debt = round(-(initial + Number(r?.balance ?? 0)));
    const financed = round(mine.filter((p) => p.currency === currency).reduce((acc, p) => acc + (p.remainingAmount ?? 0), 0));
    const paid = round(Number(r?.paid ?? 0));
    const statementDebt = statement ? Math.max(0, round(-(initial + Number(r?.atStatement ?? 0)))) : null;
    const c: CardCurrency = {
      currency,
      debt,
      financed,
      total: round(Math.max(0, debt) + financed),
      statementDebt,
      payoff: statementDebt === null ? null : Math.max(0, round(statementDebt - paid)),
      spent: round(Number(r?.spent ?? 0)),
      paid,
    };
    // Monedas sin nada que mostrar (ej. un único cargo en dólares ya pagado) no se listan
    if (currency === card.currency || c.debt !== 0 || c.financed || c.spent || c.paid || c.payoff) currencies.push(c);
  }
  currencies.sort((a, b) => Number(b.currency === card.currency) - Number(a.currency === card.currency) || a.currency.localeCompare(b.currency));

  return {
    account: card,
    statement,
    cycleStart,
    due,
    daysLeft: due ? diffDays(due, now) : null,
    currencies,
    financings: mine,
    lastPayment: last ? { amount: Number(last.amount), currency: last.currency, date: last.date } : null,
  };
}

/** Resumen de cada tarjeta de crédito activa: contado, financiado, pago del ciclo y último pago. */
export async function creditCardSummaries(): Promise<CardSummary[]> {
  const cards = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, uid()), eq(accounts.type, "credit_card"), eq(accounts.archived, false)))
    .orderBy(asc(accounts.name));
  if (!cards.length) return [];
  const financings = (await listPayments()).filter((p) => p.kind === "financing" && p.active && p.accountId);
  const now = today();
  return Promise.all(cards.map((c) => summarize(c, financings, now)));
}
