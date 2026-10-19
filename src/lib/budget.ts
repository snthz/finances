import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { budgetPlans, type BudgetPlan } from "@/db/schema";
import { currentMonth, shiftMonth } from "./format";
import { uid } from "./context";
import { accountBalances, monthlyTrend } from "./queries";
import { appSettings, getSetting } from "./settings";
import { getT } from "@/i18n/server";

export const GOAL_KEYS = { name: "budget.goalName", amount: "budget.goalAmount" } as const;

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export type MonthResult = {
  ym: string;
  /** El mes ya terminó (cuenta para las rachas) */
  closed: boolean;
  limit: number | null;
  spent: number;
  /** true/false si hay límite; null si no había plan ese mes */
  budgetMet: boolean | null;
  savingsTarget: number | null;
  saved: number;
  savingsMet: boolean | null;
};

export type Streak = { current: number; best: number };

export async function getPlans() {
  return db.select().from(budgetPlans).where(eq(budgetPlans.userId, uid())).orderBy(asc(budgetPlans.effectiveFrom));
}

/** Plan vigente en un mes: el último cuyo inicio es anterior o igual. */
export function planFor(plans: BudgetPlan[], ym: string) {
  let found: BudgetPlan | undefined;
  for (const p of plans) if (p.effectiveFrom <= ym) found = p;
  return found;
}

/**
 * Ahorro neto por mes (en moneda principal): lo que entra a cuentas de ahorro menos lo que sale.
 * Las transferencias entre dos cuentas de ahorro no cuentan.
 */
async function savingsByMonth(fromYm: string, toYm: string) {
  const tz = appSettings().timezone;
  const userId = uid();
  const rows = await db.execute<{ ym: string; net: string }>(sql`
    with s as (select id from accounts where is_savings and user_id = ${userId}),
    t as (
      select tr.*, coalesce((select rate from currencies c where c.code = tr.currency and c.user_id = tr.user_id), 0) as rate,
        to_char(tr.date at time zone ${tz}, 'YYYY-MM') as ym
      from transactions tr
      where tr.user_id = ${userId}
    )
    select ym, sum(
      case
        when type = 'income' and account_id in (select id from s) then amount * rate
        when type = 'expense' and account_id in (select id from s) then -amount * rate
        when type = 'transfer' and to_account_id in (select id from s) and (account_id is null or account_id not in (select id from s)) then amount * rate
        when type = 'transfer' and account_id in (select id from s) and (to_account_id is null or to_account_id not in (select id from s)) then -amount * rate
        else 0
      end
    ) as net
    from t
    where ym between ${fromYm} and ${toYm}
    group by ym
  `);
  return new Map(rows.map((r) => [r.ym, Number(r.net ?? 0)]));
}

/** Resultados mes a mes desde que existe un plan (máx. 24 meses) hasta el mes actual. */
export async function budgetHistory(): Promise<{ plans: BudgetPlan[]; months: MonthResult[] }> {
  const plans = await getPlans();
  const now = currentMonth();
  if (!plans.length) return { plans, months: [] };
  let from = plans[0].effectiveFrom;
  if (from < shiftMonth(now, -23)) from = shiftMonth(now, -23);
  const [trend, savings] = await Promise.all([monthlyTrend(from, now, {}), savingsByMonth(from, now)]);

  const months: MonthResult[] = [];
  for (let ym = from; ym <= now; ym = shiftMonth(ym, 1)) {
    const plan = planFor(plans, ym);
    const limit = num(plan?.monthlyLimit);
    const savingsTarget = num(plan?.savingsTarget);
    const spent = trend.find((t) => t.ym === ym)?.expense ?? 0;
    const saved = savings.get(ym) ?? 0;
    const closed = ym < now;
    months.push({
      ym,
      closed,
      limit,
      spent,
      // Un mes en curso sólo cuenta como "no cumplido" si ya se pasó del límite
      budgetMet: limit === null ? null : closed ? spent <= limit : spent > limit ? false : null,
      savingsTarget,
      saved,
      savingsMet: savingsTarget === null ? null : saved >= savingsTarget ? true : closed ? false : null,
    });
  }
  return { plans, months };
}

/** Racha actual (meses seguidos cumplidos hasta el último mes cerrado) y mejor racha. */
export function streak(months: MonthResult[], key: "budgetMet" | "savingsMet"): Streak {
  let best = 0;
  let run = 0;
  for (const m of months) {
    if (!m.closed) continue;
    if (m[key] === true) best = Math.max(best, ++run);
    else if (m[key] === false) run = 0;
  }
  // La racha actual se cuenta hacia atrás desde el último mes cerrado
  let current = 0;
  for (let i = months.length - 1; i >= 0; i--) {
    const m = months[i];
    if (!m.closed) {
      // El mes en curso suma si ya se cumplió (meta de ahorro) y rompe la racha si ya se excedió
      if (m[key] === true) current++;
      else if (m[key] === false) break;
      continue;
    }
    if (m[key] === true) current++;
    else break;
  }
  return { current, best: Math.max(best, current) };
}

export async function savingsOverview() {
  const balances = await accountBalances();
  const savings = balances.filter((b) => b.isSavings && !b.archived);
  const total = savings.reduce((acc, b) => acc + (b.rate === null ? 0 : b.balance * b.rate), 0);
  const [goalName, goalAmount] = await Promise.all([getSetting(GOAL_KEYS.name), getSetting(GOAL_KEYS.amount)]);
  return {
    accounts: savings,
    total,
    goal: goalAmount && Number(goalAmount) > 0 ? { name: goalName || getT().budget.defaultGoalName, amount: Number(goalAmount) } : null,
  };
}
