import "server-only";
import { and, eq, like, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiUsage, userSettings } from "@/db/schema";
import { uid } from "./context";
import { toLocalYmd } from "./format";
import { addDays } from "./payments-shared";
import { appSettings } from "./settings";

const num = (v: unknown) => Number(v ?? 0);

/** Lo que ha costado la IA del usuario (en USD): totales, últimos 30 días y por modelo. */
export async function aiCostSummary(days = 30) {
  const userId = uid();
  const tz = appSettings().timezone;
  const today = toLocalYmd(new Date());
  const from = addDays(today, -(days - 1));
  const local = sql`(${aiUsage.createdAt} at time zone ${tz})::date`;
  const mine = eq(aiUsage.userId, userId);

  const [[totals], daily, byModel, legacy] = await Promise.all([
    db
      .select({
        cost: sql<string>`coalesce(sum(${aiUsage.costUsd}), 0)`,
        month: sql<string>`coalesce(sum(${aiUsage.costUsd}) filter (where to_char(${local}, 'YYYY-MM') = ${today.slice(0, 7)}), 0)`,
        calls: sql<number>`count(*)::int`,
        rules: sql<number>`count(distinct ${aiUsage.emailMessageId})::int`,
        unpriced: sql<number>`(count(*) filter (where ${aiUsage.costUsd} is null))::int`,
        first: sql<string | null>`to_char(min(${local}), 'YYYY-MM-DD')`,
      })
      .from(aiUsage)
      .where(mine),
    db
      .select({
        day: sql<string>`to_char(${local}, 'YYYY-MM-DD')`,
        cost: sql<string>`coalesce(sum(${aiUsage.costUsd}), 0)`,
        calls: sql<number>`count(*)::int`,
        tokens: sql<number>`sum(${aiUsage.inputTokens} + ${aiUsage.cacheReadTokens} + ${aiUsage.cacheWriteTokens} + ${aiUsage.outputTokens})::int`,
      })
      .from(aiUsage)
      .where(and(mine, sql`${local} >= ${from}::date`))
      .groupBy(sql`1`),
    db
      .select({
        model: aiUsage.model,
        calls: sql<number>`count(*)::int`,
        input: sql<number>`sum(${aiUsage.inputTokens} + ${aiUsage.cacheReadTokens} + ${aiUsage.cacheWriteTokens})::int`,
        output: sql<number>`sum(${aiUsage.outputTokens})::int`,
        cost: sql<string | null>`sum(${aiUsage.costUsd})`,
      })
      .from(aiUsage)
      .where(mine)
      .groupBy(aiUsage.model)
      .orderBy(sql`sum(${aiUsage.costUsd}) desc nulls last`),
    // Reglas pedidas antes de que se registraran tokens (sólo se contaban por día)
    db
      .select({ key: userSettings.key, value: userSettings.value })
      .from(userSettings)
      .where(and(eq(userSettings.userId, userId), like(userSettings.key, "ai.usage.%"))),
  ]);

  // Un día por barra, con cero en los días sin uso
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const series = Array.from({ length: days }, (_, i) => {
    const day = addDays(from, i);
    const d = byDay.get(day);
    return { day, cost: num(d?.cost), calls: num(d?.calls), tokens: num(d?.tokens) };
  });

  const first = totals?.first ?? null;
  const untracked = legacy
    .filter((r) => !first || r.key.slice("ai.usage.".length) < first)
    .reduce((acc, r) => acc + num(r.value), 0);

  const rules = num(totals?.rules);
  const cost = num(totals?.cost);
  return {
    cost,
    month: num(totals?.month),
    calls: num(totals?.calls),
    rules,
    perRule: rules ? cost / rules : null,
    unpriced: num(totals?.unpriced),
    untracked,
    series,
    byModel: byModel.map((m) => ({ model: m.model, calls: num(m.calls), input: num(m.input), output: num(m.output), cost: m.cost === null ? null : num(m.cost) })),
  };
}
