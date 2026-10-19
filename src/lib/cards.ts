import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, transactions, type Account } from "@/db/schema";
import { uid } from "./context";
import { listPayments, today, type PaymentView } from "./payments";
import { addDays, diffDays, dueDateAfter, lastStatementDate } from "./payments-shared";
import { bucketize, cardCurrencyList } from "./card-currencies";
import { appSettings, currencyRate } from "./settings";

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
  // Cada moneda de la tarjeta tiene su saldo; un cargo en otra moneda va al saldo en la moneda adicional
  const list = cardCurrencyList(card.currency, card.extraCurrencies);
  const buckets = bucketize(
    list,
    currencyRate,
    ["balance", "atStatement", "spent", "paid"] as const,
    rows.map((r) => ({ currency: r.currency, balance: Number(r.balance), atStatement: Number(r.atStatement), spent: Number(r.spent), paid: Number(r.paid) })),
  );
  for (const p of mine) if (!buckets.has(p.currency)) buckets.set(p.currency, { balance: 0, atStatement: 0, spent: 0, paid: 0 });

  const currencies: CardCurrency[] = [];
  for (const [currency, r] of buckets) {
    // Saldo inicial (negativo = deuda) de cada moneda
    const initial = currency === card.currency ? Number(card.initialBalance) : Number(card.extraInitialBalances?.[currency] ?? 0);
    const debt = round(-(initial + r.balance));
    const financed = round(mine.filter((p) => p.currency === currency).reduce((acc, p) => acc + (p.remainingAmount ?? 0), 0));
    const paid = round(r.paid);
    const statementDebt = statement ? Math.max(0, round(-(initial + r.atStatement))) : null;
    const c: CardCurrency = {
      currency,
      debt,
      financed,
      total: round(Math.max(0, debt) + financed),
      statementDebt,
      payoff: statementDebt === null ? null : Math.max(0, round(statementDebt - paid)),
      spent: round(r.spent),
      paid,
    };
    // Las monedas de la tarjeta siempre se muestran; las sueltas sólo si tienen algo
    if (list.includes(currency) || c.debt !== 0 || c.financed || c.spent || c.paid || c.payoff) currencies.push(c);
  }

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
