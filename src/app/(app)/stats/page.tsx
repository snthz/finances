import { ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { CategoryIcon } from "@/components/category-icon";
import { CumulativeChart, DonutChart, TrendChart, ValueBarChart } from "@/components/charts";
import { CurrencyTabs, PeriodNav, PeriodTabs } from "@/components/month-nav";
import { StatTiles } from "@/components/stat-tiles";
import { Badge, Card, Empty, HBar, IconBubble, Notice, PageHeader } from "@/components/ui";
import { fmt, getT, plural } from "@/i18n/server";
import { initScope, requireAuth } from "@/lib/auth";
import { currencySymbol, formatDate, formatYmd, money, monthLabel, toLocalYmd } from "@/lib/format";
import { addDays, elapsedDays, isYmd, PERIOD_KINDS, periodBuckets, periodRange, shiftPeriod, weekdayOccurrences, type PeriodKind } from "@/lib/period";
import {
  getCurrencies,
  missingRates,
  monthSummary,
  periodSeries,
  periodTransactions,
  spendingByAccount,
  spendingByCategory,
  spendingByCurrency,
  spendingByWeekday,
  topMerchants,
  type Scope,
} from "@/lib/queries";
import { appSettings } from "@/lib/settings";

type SP = Promise<{ period?: string; date?: string; currency?: string }>;

export async function generateMetadata() {
  await initScope();
  return { title: getT().stats.title };
}

/** Las primeras `n` porciones y el resto sumado en una sola ("Otras"). */
function foldTail<T extends { value: number }>(rows: T[], n: number, other: (value: number) => T) {
  if (rows.length <= n + 1) return rows;
  return [...rows.slice(0, n), other(rows.slice(n).reduce((a, b) => a + b.value, 0))];
}

function periodLabel(kind: PeriodKind, from: string, to: string) {
  switch (kind) {
    case "day":
      return formatYmd(from, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    case "week":
      return `${formatYmd(from, { day: "numeric", month: "short" })} – ${formatYmd(to, { day: "numeric", month: "short", year: "2-digit" })}`;
    case "month":
      return monthLabel(from.slice(0, 7));
    case "year":
      return from.slice(0, 4);
  }
}

export default async function StatsPage({ searchParams }: { searchParams: SP }) {
  await requireAuth();
  const T = getT();
  const t = T.stats;
  const sp = await searchParams;
  const today = toLocalYmd(new Date());
  const kind: PeriodKind = PERIOD_KINDS.includes(sp.period as PeriodKind) ? (sp.period as PeriodKind) : "month";
  // Una fecha futura se lleva al periodo actual
  const anchor = isYmd(sp.date) && sp.date <= today ? sp.date : today;
  const range = periodRange(kind, anchor);
  const prevRange = periodRange(kind, shiftPeriod(kind, anchor, -1));

  const currencies = await getCurrencies();
  const { baseCurrency } = appSettings();
  const scope: Scope = sp.currency && currencies.includes(sp.currency) ? { currency: sp.currency } : {};
  const currency = scope.currency ?? baseCurrency;
  const symbol = currencySymbol(currency);
  const buckets = periodBuckets(kind, range);
  const prevBuckets = periodBuckets(kind, prevRange);

  const [summary, prev, byCategory, prevByCategory, byAccount, merchants, byCurrency, series, prevSeries, weekdays, txs, missing] = await Promise.all([
    monthSummary(range, scope),
    monthSummary(prevRange, scope),
    spendingByCategory(range, scope),
    spendingByCategory(prevRange, scope),
    spendingByAccount(range, scope),
    topMerchants(range, scope),
    spendingByCurrency(range),
    buckets ? periodSeries(range, scope, buckets.unit) : Promise.resolve([]),
    prevBuckets ? periodSeries(prevRange, scope, prevBuckets.unit) : Promise.resolve([]),
    kind === "month" || kind === "year" ? spendingByWeekday(range, scope) : Promise.resolve([]),
    kind === "day" ? periodTransactions(range, scope, { order: "date", limit: 50 }) : periodTransactions(range, scope, { order: "amount", limit: 6 }),
    scope.currency ? Promise.resolve([]) : missingRates(range),
  ]);

  // Promedio diario sobre los días transcurridos; proyección sólo si el periodo está en curso
  const elapsed = elapsedDays(range, today);
  const totalDays = elapsedDays(range, range.to);
  const dailyAvg = elapsed > 0 ? summary.expense / elapsed : 0;
  const inProgress = today >= range.from && today < range.to;
  const params = { period: kind, date: anchor, currency: scope.currency };
  // Los enlaces a Movimientos sólo filtran por mes
  const txMonth = kind === "month" ? range.from.slice(0, 7) : null;

  const fourth =
    kind === "day"
      ? {
          label: t.kpi.transactions,
          value: String(summary.count),
          note: fmt(t.kpi.avgExpense, { amount: money(summary.expenseCount ? summary.expense / summary.expenseCount : 0, currency) }),
        }
      : {
          label: T.dashboard.stats.dailyAverage,
          value: money(dailyAvg, currency),
          note: inProgress ? fmt(t.kpi.projection, { amount: money(dailyAvg * totalDays, currency) }) : fmt(t.kpi.elapsed, { n: elapsed }),
        };

  // Barras por día o por mes
  const bucketLabel = (key: string) => {
    if (kind === "year") return { label: formatYmd(`${key}-01`, { month: "short" }), title: monthLabel(key) };
    if (kind === "week") return { label: formatYmd(key, { weekday: "short" }), title: formatYmd(key, { weekday: "long", day: "numeric", month: "long" }) };
    return { label: String(Number(key.slice(8))), title: formatYmd(key, { weekday: "short", day: "numeric", month: "long" }) };
  };
  const seriesData = (buckets?.keys ?? []).map((key) => {
    const r = series.find((s) => s.key === key);
    return { ...bucketLabel(key), income: r?.income ?? 0, expense: r?.expense ?? 0 };
  });

  // Acumulado: el periodo actual se corta en hoy; el anterior se alinea por posición (día 1 con día 1…)
  const cumulative = (() => {
    if (!buckets || !prevBuckets) return [];
    const cut = buckets.unit === "day" ? today : today.slice(0, 7);
    const len = Math.max(buckets.keys.length, prevBuckets.keys.length);
    let cur = 0;
    let before = 0;
    return Array.from({ length: len }, (_, i) => {
      const key = buckets.keys[i];
      const prevKey = prevBuckets.keys[i];
      if (key && key <= cut) cur += series.find((s) => s.key === key)?.expense ?? 0;
      if (prevKey) before += prevSeries.find((s) => s.key === prevKey)?.expense ?? 0;
      const labels = key ? bucketLabel(key) : { label: String(i + 1), title: undefined };
      return {
        ...labels,
        prevTitle: prevKey ? bucketLabel(prevKey).title : undefined,
        current: key && key <= cut ? cur : null,
        previous: prevKey ? before : null,
      };
    });
  })();

  // Promedio por día de la semana (lunes primero), sobre los días ya transcurridos
  const weekdayData = (() => {
    if (!weekdays.length || elapsed === 0) return [];
    const occ = weekdayOccurrences({ from: range.from, to: addDays(range.from, elapsed - 1) });
    const monday = "2024-01-01";
    return occ.map((n, i) => {
      const w = weekdays.find((d) => d.dow === i + 1);
      const day = addDays(monday, i);
      return {
        label: formatYmd(day, { weekday: "short" }),
        title: formatYmd(day, { weekday: "long" }),
        value: n > 0 ? (w?.total ?? 0) / n : 0,
        note: plural(n, t.weekday.days),
      };
    });
  })();

  const categoryDonut = foldTail(
    byCategory.map((c) => ({
      key: String(c.id ?? "none"),
      name: c.name,
      value: c.total,
      display: money(c.total, currency),
      href: txMonth ? `/transactions?month=${txMonth}&categoryId=${c.id ?? "none"}` : undefined,
    })),
    5,
    (value) => ({ key: "other", name: t.other, value, display: money(value, currency), href: undefined }),
  );

  const methodTotals = new Map<string, number>();
  for (const a of byAccount) methodTotals.set(a.type ?? "none", (methodTotals.get(a.type ?? "none") ?? 0) + a.total);
  const methodDonut = foldTail(
    [...methodTotals]
      .sort((a, b) => b[1] - a[1])
      .map(([type, value]) => ({ key: type, name: type === "none" ? t.methods.unassigned : (T.common.accountTypes[type] ?? type), value, display: money(value, currency) })),
    5,
    (value) => ({ key: "other", name: t.other, value, display: money(value, currency) }),
  );

  const compareRows = (() => {
    const rows = new Map<string, { name: string; icon: string | null; now: number; before: number }>();
    for (const c of byCategory) rows.set(String(c.id), { name: c.name, icon: c.icon, now: c.total, before: 0 });
    for (const c of prevByCategory) {
      const r = rows.get(String(c.id));
      if (r) r.before = c.total;
      else rows.set(String(c.id), { name: c.name, icon: c.icon, now: 0, before: c.total });
    }
    return [...rows.values()].sort((a, b) => b.now - a.now || b.before - a.before).slice(0, 8);
  })();

  const maxAcc = byAccount[0]?.total ?? 0;
  const maxMerchant = merchants[0]?.total ?? 0;
  const label = periodLabel(kind, range.from, range.to);
  const vsLabel = t.delta.vsPrevious[kind];

  return (
    <>
      <PageHeader
        title={t.title}
        subtitle={fmt(t.subtitle, {
          count: plural(summary.count, T.dashboard.txCount),
          scope: scope.currency ? fmt(T.dashboard.onlyCurrency, { currency: scope.currency }) : fmt(T.dashboard.allConverted, { currency: baseCurrency }),
        })}
        actions={
          <>
            <PeriodTabs kind={kind} basePath="/stats" params={params} />
            <CurrencyTabs currencies={currencies} current={scope.currency} base={baseCurrency} basePath="/stats" params={params} />
            <PeriodNav kind={kind} anchor={anchor} today={today} label={label} basePath="/stats" params={params} />
          </>
        }
      />

      {missing.length > 0 && (
        <Notice>
          {fmt(T.dashboard.missingRates.text, { list: missing.map((m) => `${m.currency} (${m.count})`).join(", ") })}{" "}
          <Link href="/settings?tab=monedas" className="font-medium underline">{T.dashboard.missingRates.link}</Link>
        </Notice>
      )}

      <StatTiles
        spendingLabel={t.kpi.spending[kind]}
        expense={summary.expense}
        income={summary.income}
        prev={prev}
        currency={currency}
        vsLabel={vsLabel}
        noPrevious={t.delta.noPrevious}
        fourth={fourth}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {buckets && (
          <Card className="lg:col-span-2" title={t.series.title} subtitle={buckets.unit === "day" ? t.series.byDay : t.series.byMonth}>
            <TrendChart data={seriesData} symbol={symbol} />
          </Card>
        )}

        <Card title={t.categories.title} subtitle={label}>
          {categoryDonut.length === 0 ? (
            <Empty>{t.noSpending}</Empty>
          ) : (
            <DonutChart data={categoryDonut} total={money(summary.expense, currency)} centerLabel={t.categories.total} aria={t.categories.aria} />
          )}
        </Card>

        {cumulative.length > 0 && (
          <Card className="lg:col-span-2" title={t.cumulative.title} subtitle={t.cumulative.subtitle}>
            <CumulativeChart data={cumulative} symbol={symbol} labels={{ current: t.cumulative.current, previous: t.cumulative.previous }} />
          </Card>
        )}

        <Card title={t.methods.title} subtitle={t.methods.subtitle}>
          {methodDonut.length === 0 ? (
            <Empty>{t.noSpending}</Empty>
          ) : (
            <DonutChart data={methodDonut} total={money(summary.expense, currency)} centerLabel={t.categories.total} aria={t.methods.aria} />
          )}
        </Card>

        {weekdayData.length > 0 && (
          <Card className="lg:col-span-2" title={t.weekday.title} subtitle={t.weekday.subtitle}>
            <ValueBarChart data={weekdayData} symbol={symbol} seriesLabel={t.weekday.series} />
          </Card>
        )}

        <Card title={t.merchants.title} subtitle={label}>
          {merchants.length === 0 ? (
            <Empty>{t.noSpending}</Empty>
          ) : (
            <div className="-mr-2 max-h-72 space-y-1 overflow-y-auto overscroll-contain pr-2">
              {merchants.map((m) => (
                <HBar
                  key={m.name}
                  label={m.name}
                  value={m.total}
                  max={maxMerchant}
                  display={money(m.total, currency)}
                  tone="muted"
                  href={txMonth ? `/transactions?month=${txMonth}&q=${encodeURIComponent(m.name)}` : undefined}
                  extra={<div className="mt-0.5 text-[11px] text-muted">{plural(m.count, t.merchants.purchases)}</div>}
                />
              ))}
            </div>
          )}
        </Card>

        {kind === "day" && (
          <Card className="lg:col-span-2" title={t.dayTransactions.title} subtitle={label}>
            {txs.length === 0 ? <Empty>{t.empty}</Empty> : <TxList rows={txs} withTime />}
          </Card>
        )}

        {kind !== "day" && (
          <Card className="lg:col-span-2" title={t.compare.title} subtitle={`${label} · ${vsLabel}`}>
            {compareRows.length === 0 ? (
              <Empty>{t.noSpending}</Empty>
            ) : (
              <div className="-mx-5 overflow-x-auto">
                <table className="w-full min-w-[28rem] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-muted">
                      <th className="px-5 pb-2 font-medium">{t.compare.category}</th>
                      <th className="px-2 pb-2 text-right font-medium">{t.compare.current}</th>
                      <th className="px-2 pb-2 text-right font-medium">{t.compare.previous}</th>
                      <th className="px-5 pb-2 text-right font-medium">{t.compare.change}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {compareRows.map((r) => {
                      const pct = r.before > 0 ? ((r.now - r.before) / r.before) * 100 : null;
                      return (
                        <tr key={r.name}>
                          <td className="px-5 py-2.5">
                            <span className="flex min-w-0 items-center gap-2">
                              <CategoryIcon name={r.icon} className="size-4 shrink-0 text-ink-2" />
                              <span className="truncate">{r.name}</span>
                            </span>
                          </td>
                          <td className="tabular px-2 py-2.5 text-right">{money(r.now, currency)}</td>
                          <td className="tabular px-2 py-2.5 text-right text-ink-2">{money(r.before, currency)}</td>
                          <td className="px-5 py-2.5 text-right">
                            {pct === null ? (
                              <Badge>{t.compare.new}</Badge>
                            ) : (
                              <span className={`tabular inline-block rounded-md px-1.5 py-0.5 text-xs font-medium ${pct > 0 ? "bg-bad/10 text-bad" : "bg-surface-2 text-ink"}`}>
                                {pct > 0 ? "↑" : pct < 0 ? "↓" : "="} {Math.abs(pct).toFixed(0)}%
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        <Card title={t.accounts.title} subtitle={label}>
          {byAccount.length === 0 ? (
            <Empty>{t.noSpending}</Empty>
          ) : (
            <div className="-mr-2 max-h-72 space-y-1 overflow-y-auto overscroll-contain pr-2">
              {byAccount.map((a) => (
                <HBar
                  key={`${a.id}-${a.name}`}
                  label={
                    <span>
                      {a.name}
                      {a.identifiers?.length ? <span className="ml-1.5 text-xs text-muted">•••• {a.identifiers.join(", ")}</span> : null}
                    </span>
                  }
                  value={a.total}
                  max={maxAcc}
                  display={money(a.total, currency)}
                  href={txMonth ? `/transactions?month=${txMonth}&accountId=${a.id ?? "none"}` : undefined}
                  extra={<div className="mt-0.5 text-[11px] text-muted">{plural(a.count, T.dashboard.txCount)}{a.type ? ` · ${T.common.accountTypes[a.type]}` : ""}</div>}
                />
              ))}
            </div>
          )}
        </Card>

        {kind !== "day" && (
          <Card title={t.largest.title} subtitle={label}>
            {txs.length === 0 ? <Empty>{t.noSpending}</Empty> : <TxList rows={txs} />}
          </Card>
        )}

        {byCurrency.length > 1 && (
          <Card title={t.byCurrency.title} subtitle={fmt(t.byCurrency.subtitle, { currency: baseCurrency })}>
            <ul className="divide-y divide-line">
              {byCurrency.map((c) => (
                <li key={c.currency} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <Link href={`/stats?${new URLSearchParams({ period: kind, date: anchor, currency: c.currency })}`} className="min-w-0">
                    <span className="block">{money(c.total, c.currency)}</span>
                    <span className="text-[11px] text-muted">{plural(c.count, T.dashboard.txCount)} · {c.currency}</span>
                  </Link>
                  <span className="tabular shrink-0 text-ink-2">
                    {c.converted === null ? <Badge tone="warn">{t.byCurrency.noRate}</Badge> : `≈ ${money(c.converted)}`}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}

function TxList({ rows, withTime }: { rows: Awaited<ReturnType<typeof periodTransactions>>; withTime?: boolean }) {
  return (
    <ul className="-mr-2 max-h-96 divide-y divide-line overflow-y-auto overscroll-contain pr-2">
      {rows.map(({ tx, categoryIcon, categoryName, accountName }) => (
        <li key={tx.id} className="flex items-center justify-between gap-3 py-2 text-sm">
          <span className="flex min-w-0 items-center gap-3">
            <IconBubble size="sm">{tx.type === "transfer" ? <ArrowLeftRight className="size-3.5" /> : <CategoryIcon name={categoryIcon} className="size-3.5" />}</IconBubble>
            <span className="min-w-0">
              <span className="block truncate">{tx.merchant || tx.description || "—"}</span>
              <span className="block truncate text-[11px] text-muted">
                {formatDate(tx.date, withTime ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "short" })}
                {categoryName ? ` · ${categoryName}` : ""}
                {accountName ? ` · ${accountName}` : ""}
              </span>
            </span>
          </span>
          <span className="tabular shrink-0 font-medium">
            {tx.type === "income" ? "+" : "−"}
            {money(tx.amount, tx.currency)}
          </span>
        </li>
      ))}
    </ul>
  );
}
