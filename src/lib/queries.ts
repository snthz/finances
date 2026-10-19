import "server-only";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { accounts, categories, currencies, transactions, type TxType } from "@/db/schema";
import { getT } from "@/i18n/server";
import { uid } from "./context";
import { appSettings } from "./settings";

const tz = () => appSettings().timezone;
const t = transactions;

const inMonth = (ym: string) => sql`to_char(${t.date} AT TIME ZONE ${tz()}, 'YYYY-MM') = ${ym}`;
/** Filtro obligatorio: sólo movimientos del usuario actual. */
const mine = () => eq(t.userId, uid());
// Joins defensivos: la cuenta/categoría unida también debe ser del usuario
const joinCategory = () => and(eq(categories.id, t.categoryId), eq(categories.userId, uid()));
const joinAccount = () => and(eq(accounts.id, t.accountId), eq(accounts.userId, uid()));
const num = (v: unknown) => Number(v ?? 0);

/**
 * Ámbito de moneda: con `currency` se usan montos originales de esa moneda;
 * sin ella (consolidado) todo se convierte a la moneda base con la tasa de cada moneda.
 */
export type Scope = { currency?: string };

function rateOf(code: SQL | typeof t.currency) {
  return sql`(select ${currencies.rate} from ${currencies} where ${currencies.code} = ${code} and ${currencies.userId} = ${uid()})`;
}

function amt(scope: Scope) {
  return scope.currency ? sql`${t.amount}` : sql`(${t.amount} * coalesce(${rateOf(t.currency)}, 0))`;
}

function scopeWhere(scope: Scope) {
  return scope.currency ? eq(t.currency, scope.currency) : undefined;
}

export function scopeCurrency(scope: Scope) {
  return scope.currency ?? appSettings().baseCurrency;
}

/** Monedas con movimientos o cuentas, más las configuradas. */
export async function getCurrencies() {
  const used = await db.execute<{ currency: string }>(
    sql`select currency from transactions where user_id = ${uid()} union select currency from accounts where user_id = ${uid()}`,
  );
  const set = new Set([...appSettings().currencies.map((c) => c.code), ...used.map((r) => r.currency)]);
  set.add(appSettings().baseCurrency);
  return [...set].sort();
}

/** Monedas usadas en el mes que no tienen tasa (quedan fuera del consolidado). */
export async function missingRates(ym?: string) {
  const rows = await db.execute<{ currency: string; n: number }>(sql`
    select t.currency, count(*)::int as n from transactions t
    left join currencies c on c.code = t.currency and c.user_id = t.user_id
    where t.user_id = ${uid()} and c.rate is null ${ym ? sql`and to_char(t.date at time zone ${tz()}, 'YYYY-MM') = ${ym}` : sql``}
    group by 1
  `);
  return rows.map((r) => ({ currency: r.currency, count: num(r.n) }));
}

export async function monthSummary(ym: string, scope: Scope) {
  const a = amt(scope);
  const [row] = await db
    .select({
      income: sql<string>`coalesce(sum(${a}) filter (where ${t.type} = 'income'), 0)`,
      expense: sql<string>`coalesce(sum(${a}) filter (where ${t.type} = 'expense'), 0)`,
      count: sql<number>`count(*) filter (where ${t.type} <> 'transfer')`,
    })
    .from(t)
    .where(and(mine(), inMonth(ym), scopeWhere(scope)));
  return { income: num(row?.income), expense: num(row?.expense), count: num(row?.count) };
}

export async function spendingByCategory(ym: string, scope: Scope) {
  const a = amt(scope);
  const rows = await db
    .select({
      id: categories.id,
      name: sql<string>`coalesce(${categories.name}, ${getT().transactions.noCategory})`,
      color: categories.color,
      icon: categories.icon,
      budget: categories.monthlyBudget,
      total: sql<string>`sum(${a})`,
    })
    .from(t)
    .leftJoin(categories, joinCategory())
    .where(and(mine(), inMonth(ym), scopeWhere(scope), eq(t.type, "expense")))
    .groupBy(categories.id)
    .orderBy(desc(sql`sum(${a})`));
  return rows.map((r) => ({ ...r, total: num(r.total), budget: r.budget === null ? null : num(r.budget) })).filter((r) => r.total > 0);
}

/** Presupuestos: siempre en moneda base, contra el gasto consolidado. */
export async function budgetsStatus(ym: string) {
  const spent = await spendingByCategory(ym, {});
  const cats = await db.select().from(categories).where(and(eq(categories.userId, uid()), sql`${categories.monthlyBudget} is not null and ${categories.monthlyBudget} > 0`));
  return cats.map((c) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    color: c.color,
    budget: num(c.monthlyBudget),
    spent: spent.find((s) => s.id === c.id)?.total ?? 0,
  }));
}

export async function dailySpending(ym: string, scope: Scope) {
  const a = amt(scope);
  const rows = await db
    .select({
      day: sql<number>`extract(day from ${t.date} AT TIME ZONE ${tz()})::int`,
      total: sql<string>`sum(${a})`,
    })
    .from(t)
    .where(and(mine(), inMonth(ym), scopeWhere(scope), eq(t.type, "expense")))
    .groupBy(sql`1`);
  return rows.map((r) => ({ day: num(r.day), total: num(r.total) }));
}

export async function monthlyTrend(fromYm: string, toYm: string, scope: Scope) {
  const a = amt(scope);
  const rows = await db
    .select({
      ym: sql<string>`to_char(${t.date} AT TIME ZONE ${tz()}, 'YYYY-MM')`,
      income: sql<string>`coalesce(sum(${a}) filter (where ${t.type} = 'income'), 0)`,
      expense: sql<string>`coalesce(sum(${a}) filter (where ${t.type} = 'expense'), 0)`,
    })
    .from(t)
    .where(and(mine(), scopeWhere(scope), sql`to_char(${t.date} AT TIME ZONE ${tz()}, 'YYYY-MM') between ${fromYm} and ${toYm}`))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  return rows.map((r) => ({ ym: r.ym, income: num(r.income), expense: num(r.expense) }));
}

/** Gastos por cuenta/tarjeta; si no hay cuenta asociada agrupa por últimos 4 detectados. */
export async function spendingByAccount(ym: string, scope: Scope) {
  const a = amt(scope);
  const label = sql<string>`coalesce(${accounts.name}, case when ${t.detectedIdentifier} is not null then '•••• ' || ${t.detectedIdentifier} else 'Sin cuenta' end)`;
  const rows = await db
    .select({
      id: accounts.id,
      name: label,
      type: accounts.type,
      identifiers: accounts.identifiers,
      total: sql<string>`sum(${a})`,
      count: sql<number>`count(*)`,
    })
    .from(t)
    .leftJoin(accounts, joinAccount())
    .where(and(mine(), inMonth(ym), scopeWhere(scope), eq(t.type, "expense")))
    .groupBy(accounts.id, label)
    .orderBy(desc(sql`sum(${a})`));
  return rows.map((r) => ({ ...r, total: num(r.total), count: num(r.count) }));
}

/** Desglose del gasto del mes por moneda original (y su equivalente en base). */
export async function spendingByCurrency(ym: string) {
  const rows = await db
    .select({
      currency: t.currency,
      total: sql<string>`sum(${t.amount})`,
      converted: sql<string | null>`sum(${t.amount} * ${rateOf(t.currency)})`,
      count: sql<number>`count(*)`,
    })
    .from(t)
    .where(and(mine(), inMonth(ym), eq(t.type, "expense")))
    .groupBy(t.currency)
    .orderBy(desc(sql`sum(${t.amount})`));
  return rows.map((r) => ({ currency: r.currency, total: num(r.total), converted: r.converted === null ? null : num(r.converted), count: num(r.count) }));
}

export async function topMerchants(ym: string, scope: Scope, limit = 8) {
  const a = amt(scope);
  // Sin texto queda null (agrupado) y se etiqueta en JS, así el GROUP BY no depende de un parámetro
  const name = sql<string | null>`coalesce(nullif(trim(${t.merchant}), ''), nullif(trim(${t.description}), ''))`;
  const rows = await db
    .select({ name, total: sql<string>`sum(${a})`, count: sql<number>`count(*)` })
    .from(t)
    .where(and(mine(), inMonth(ym), scopeWhere(scope), eq(t.type, "expense")))
    .groupBy(name)
    .orderBy(desc(sql`sum(${a})`))
    .limit(limit);
  const noDescription = getT().transactions.noDescription;
  return rows.map((r) => ({ name: r.name ?? noDescription, total: num(r.total), count: num(r.count) }));
}

export async function accountBalances() {
  const rows = await db.execute<{
    id: number;
    name: string;
    type: string;
    currency: string;
    color: string;
    identifiers: string[];
    institution: string | null;
    archived: boolean;
    is_savings: boolean;
    balance: string;
    month_expense: string;
    rate: string | null;
  }>(sql`
    select a.id, a.name, a.type, a.currency, a.color, a.identifiers, a.institution, a.archived, a.is_savings,
      (select rate from currencies c where c.code = a.currency and c.user_id = a.user_id) as rate,
      a.initial_balance
        + coalesce(sum(t.amount) filter (where t.type = 'income' and t.account_id = a.id), 0)
        - coalesce(sum(t.amount) filter (where t.type = 'expense' and t.account_id = a.id), 0)
        - coalesce(sum(t.amount) filter (where t.type = 'transfer' and t.account_id = a.id), 0)
        + coalesce(sum(t.amount) filter (where t.type = 'transfer' and t.to_account_id = a.id), 0)
        as balance,
      coalesce(sum(t.amount) filter (
        where t.type = 'expense' and t.account_id = a.id
          and to_char(t.date at time zone ${tz()}, 'YYYY-MM') = to_char(now() at time zone ${tz()}, 'YYYY-MM')
      ), 0) as month_expense
    from accounts a
    left join transactions t on t.user_id = a.user_id and (t.account_id = a.id or t.to_account_id = a.id)
    where a.user_id = ${uid()}
    group by a.id
    order by a.archived, a.name
  `);
  return rows.map((r) => ({
    ...r,
    isSavings: r.is_savings,
    balance: num(r.balance),
    monthExpense: num(r.month_expense),
    rate: r.rate === null ? null : num(r.rate),
  }));
}

export type TxFilters = {
  month?: string;
  accountId?: number | "none";
  categoryId?: number | "none";
  type?: TxType;
  q?: string;
  currency?: string;
  page?: number;
};

export const PAGE_SIZE = 50;

export async function listTransactions(f: TxFilters) {
  const conds: SQL[] = [mine()];
  if (f.month) conds.push(inMonth(f.month));
  if (f.accountId === "none") conds.push(sql`${t.accountId} is null`);
  else if (f.accountId) conds.push(eq(t.accountId, f.accountId));
  if (f.categoryId === "none") conds.push(sql`${t.categoryId} is null and ${t.type} <> 'transfer'`);
  else if (f.categoryId) conds.push(eq(t.categoryId, f.categoryId));
  if (f.type) conds.push(eq(t.type, f.type));
  if (f.currency) conds.push(eq(t.currency, f.currency));
  if (f.q) {
    const like = `%${f.q}%`;
    conds.push(or(ilike(t.merchant, like), ilike(t.description, like), ilike(t.notes, like))!);
  }
  const where = and(...conds);
  const toAcc = alias(accounts, "to_acc");
  const page = Math.max(1, f.page ?? 1);
  const a = amt({ currency: f.currency });

  const [rows, [agg]] = await Promise.all([
    db
      .select({
        tx: t,
        accountName: accounts.name,
        toAccountName: toAcc.name,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        categoryColor: categories.color,
      })
      .from(t)
      .leftJoin(accounts, joinAccount())
      .leftJoin(toAcc, and(eq(toAcc.id, t.toAccountId), eq(toAcc.userId, uid())))
      .leftJoin(categories, joinCategory())
      .where(where)
      .orderBy(desc(t.date), desc(t.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({
        count: sql<number>`count(*)`,
        income: sql<string>`coalesce(sum(${a}) filter (where ${t.type} = 'income'), 0)`,
        expense: sql<string>`coalesce(sum(${a}) filter (where ${t.type} = 'expense'), 0)`,
      })
      .from(t)
      .where(where),
  ]);
  return {
    rows,
    total: num(agg?.count),
    income: num(agg?.income),
    expense: num(agg?.expense),
    /** Moneda en que están expresados income/expense */
    totalsCurrency: f.currency ?? appSettings().baseCurrency,
    page,
    pages: Math.max(1, Math.ceil(num(agg?.count) / PAGE_SIZE)),
  };
}

export async function allAccounts() {
  return db.select().from(accounts).where(eq(accounts.userId, uid())).orderBy(asc(accounts.archived), asc(accounts.name));
}

export async function allCategories() {
  return db.select().from(categories).where(eq(categories.userId, uid())).orderBy(asc(categories.kind), asc(categories.name));
}

// --- Validación de ids que llegan de formularios/URLs: sólo se aceptan si son del usuario actual ---

/** Devuelve el id si la cuenta es del usuario; null si no existe o es de otro. */
export async function ownedAccountId(id: number | null | undefined): Promise<number | null> {
  if (!id || !Number.isInteger(id)) return null;
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, uid())));
  return row?.id ?? null;
}

/** Devuelve el id si la categoría es del usuario; null si no existe o es de otra persona. */
export async function ownedCategoryId(id: number | null | undefined): Promise<number | null> {
  if (!id || !Number.isInteger(id)) return null;
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, uid())));
  return row?.id ?? null;
}
