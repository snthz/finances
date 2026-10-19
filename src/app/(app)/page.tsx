import Link from "next/link";
import { DailyChart, TrendChart } from "@/components/charts";
import { CurrencyTabs, MonthNav } from "@/components/month-nav";
import { ArrowLeftRight, CalendarClock, Flame, PiggyBank } from "lucide-react";
import { PaymentDueRow } from "@/components/payment-row";
import { paymentReminders } from "@/lib/payments";
import { Badge, Card, Empty, HBar, IconBubble, Notice, PageHeader } from "@/components/ui";
import { requireAuth } from "@/lib/auth";
import { budgetHistory, planFor, streak } from "@/lib/budget";
import { appSettings } from "@/lib/settings";
import { currentMonth, daysInMonth, formatDate, money, monthLabel, shiftMonth } from "@/lib/format";
import {
  accountBalances,
  budgetsStatus,
  dailySpending,
  getCurrencies,
  listTransactions,
  missingRates,
  monthlyTrend,
  monthSummary,
  spendingByAccount,
  spendingByCategory,
  spendingByCurrency,
  topMerchants,
  type Scope,
} from "@/lib/queries";
import { currencySymbol } from "@/lib/format";
import { CategoryIcon } from "@/components/category-icon";
import { fmt, getLocale, getT, plural } from "@/i18n/server";

type SP = Promise<{ month?: string; currency?: string }>;

function Delta({ current, previous, upIsGood, inverted }: { current: number; previous: number; upIsGood: boolean; inverted?: boolean }) {
  const t = getT().dashboard;
  const muted = inverted ? "text-bg/60" : "text-muted";
  if (!previous) return <span className={`text-xs ${muted}`}>{t.delta.noPrevious}</span>;
  const pct = ((current - previous) / previous) * 100;
  const good = pct === 0 ? null : (pct > 0) === upIsGood;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${muted}`}>
      <span className={`rounded-md px-1.5 py-0.5 font-medium ${inverted ? "bg-bg/10 text-bg" : good === false ? "bg-bad/10 text-bad" : "bg-surface-2 text-ink"}`}>
        {pct > 0 ? "↑" : pct < 0 ? "↓" : "="} {Math.abs(pct).toFixed(0)}%
      </span>
      {t.delta.vsPrevious}
    </span>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  await requireAuth();
  const t = getT().dashboard;
  // En español los meses van en minúscula dentro de una frase
  const lower = (s: string) => (getLocale() === "es" ? s.toLowerCase() : s);
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : currentMonth();
  const currencies = await getCurrencies();
  const { baseCurrency, timezone } = appSettings();
  // Sin parámetro: todo consolidado en la moneda base
  const scope: Scope = sp.currency && currencies.includes(sp.currency) ? { currency: sp.currency } : {};
  const currency = scope.currency ?? baseCurrency;
  const prevMonth = shiftMonth(month, -1);

  const [summary, prev, byCategory, daily, trend, byAccount, merchants, balances, budgets, recent, byCurrency, missing] = await Promise.all([
    monthSummary(month, scope),
    monthSummary(prevMonth, scope),
    spendingByCategory(month, scope),
    dailySpending(month, scope),
    monthlyTrend(shiftMonth(month, -11), month, scope),
    spendingByAccount(month, scope),
    topMerchants(month, scope),
    accountBalances(),
    budgetsStatus(month),
    listTransactions({ month, currency: scope.currency }),
    spendingByCurrency(month),
    scope.currency ? Promise.resolve([]) : missingRates(month),
  ]);

  const [history, reminders] = await Promise.all([budgetHistory(), paymentReminders()]);
  const monthPlan = planFor(history.plans, month);
  const monthResult = history.months.find((m) => m.ym === month);
  const budgetStreak = streak(history.months, "budgetMet");
  const savingsStreak = streak(history.months, "savingsMet");

  const net = summary.income - summary.expense;
  const savingsRate = summary.income > 0 ? (net / summary.income) * 100 : null;
  const days = daysInMonth(month);
  const elapsed = month === currentMonth() ? Number(new Date().toLocaleString("en-US", { timeZone: timezone, day: "numeric" })) : days;
  const dailyAvg = elapsed > 0 ? summary.expense / elapsed : 0;

  const dailyData = Array.from({ length: days }, (_, i) => ({ day: i + 1, total: daily.find((d) => d.day === i + 1)?.total ?? 0 }));
  const trendData = Array.from({ length: 12 }, (_, i) => {
    const ym = shiftMonth(month, i - 11);
    const r = trend.find((x) => x.ym === ym);
    return { label: monthLabel(ym, "short"), income: r?.income ?? 0, expense: r?.expense ?? 0 };
  });
  const maxCat = byCategory[0]?.total ?? 0;
  const maxAcc = byAccount[0]?.total ?? 0;
  const maxMerchant = merchants[0]?.total ?? 0;
  const peakDay = dailyData.reduce((a, b) => (b.total > a.total ? b : a), { day: 0, total: 0 });
  const uncategorized = byCategory.find((c) => c.id === null);
  const params = { month, currency: scope.currency };
  const symbol = currencySymbol(currency);

  return (
    <>
      <PageHeader
        title={t.title}
        subtitle={fmt(t.subtitle, {
          count: plural(summary.count, t.txCount),
          month: lower(monthLabel(month)),
          scope: scope.currency ? fmt(t.onlyCurrency, { currency: scope.currency }) : fmt(t.allConverted, { currency: baseCurrency }),
        })}
        actions={
          <>
            <CurrencyTabs currencies={currencies} current={scope.currency} base={baseCurrency} basePath="/" params={params} />
            <MonthNav month={month} basePath="/" params={params} />
          </>
        }
      />

      {missing.length > 0 && (
        <Notice>
          {fmt(t.missingRates.text, { list: missing.map((m) => `${m.currency} (${m.count})`).join(", ") })}{" "}
          <Link href="/settings?tab=monedas" className="font-medium underline">{t.missingRates.link}</Link>
        </Notice>
      )}

      {/* Recordatorios de pagos: vencidos y dentro de su ventana de aviso */}
      {reminders.length > 0 && (
        <Card
          className="mb-4"
          padded={false}
          title={
            <span className="flex items-center gap-2">
              <CalendarClock className="size-4" /> {t.reminders.title}
            </span>
          }
          subtitle={(() => {
            const overdue = reminders.filter((r) => r.daysLeft < 0).length;
            const n = reminders.length;
            return `${plural(n, t.reminders.upcoming)}${overdue ? ` · ${plural(overdue, t.reminders.overdue)}` : ""}`;
          })()}
          actions={<Link href="/payments" className="text-xs font-medium text-ink-2 hover:text-ink">{t.reminders.viewPayments}</Link>}
        >
          <ul className="divide-y divide-line border-t border-line">
            {reminders.slice(0, 6).map((p) => (
              <PaymentDueRow key={p.id} p={p} back="/" />
            ))}
          </ul>
          {reminders.length > 6 && (
            <Link href="/payments" className="block border-t border-line px-5 py-3 text-center text-xs font-medium text-ink-2 hover:text-ink">
              {fmt(t.reminders.viewMore, { n: reminders.length - 6 })}
            </Link>
          )}
        </Card>
      )}

      {/* Cifras principales */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-5">
        <div className="col-span-2 min-w-0 rounded-2xl bg-ink p-5 text-bg shadow-pop">
          <div className="text-xs font-medium text-bg/60">{t.stats.monthSpending}</div>
          <div className="tabular mt-1 text-4xl font-semibold tracking-tight break-words md:text-5xl">{money(summary.expense, currency)}</div>
          <div className="mt-3">
            <Delta current={summary.expense} previous={prev.expense} upIsGood={false} inverted />
          </div>
        </div>
        <div className="card min-w-0 p-4 md:p-5">
          <div className="text-xs font-medium text-muted">{t.stats.income}</div>
          <div className="tabular mt-1 text-lg font-semibold tracking-tight break-words sm:text-xl xl:text-2xl">{money(summary.income, currency)}</div>
          <div className="mt-2">
            <Delta current={summary.income} previous={prev.income} upIsGood />
          </div>
        </div>
        <div className="card min-w-0 p-4 md:p-5">
          <div className="text-xs font-medium text-muted">{t.stats.net}</div>
          <div className={`tabular mt-1 text-lg font-semibold tracking-tight break-words sm:text-xl xl:text-2xl ${net < 0 ? "text-bad" : ""}`}>{money(net, currency)}</div>
          <div className="mt-2 text-xs text-muted">
            {savingsRate === null ? t.stats.noIncome : fmt(t.stats.savingsRate, { pct: savingsRate.toFixed(0) })}
          </div>
        </div>
        <div className="card col-span-2 min-w-0 p-4 md:p-5 lg:col-span-1">
          <div className="text-xs font-medium text-muted">{t.stats.dailyAverage}</div>
          <div className="tabular mt-1 text-lg font-semibold tracking-tight break-words sm:text-xl xl:text-2xl">{money(dailyAvg, currency)}</div>
          <div className="mt-2 text-xs text-muted">
            {fmt(t.stats.projection, { amount: money(dailyAvg * days, currency) })}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title={t.trend.title}
          subtitle={t.trend.subtitle}
        >
          <TrendChart data={trendData} symbol={symbol} />
        </Card>

        <Card title={t.byCategory.title} subtitle={monthLabel(month)} actions={uncategorized ? <Link href={`/transactions?month=${month}&categoryId=none`}><Badge tone="warn">{fmt(t.byCategory.uncategorized, { amount: money(uncategorized.total, currency) })}</Badge></Link> : null}>
          {byCategory.length === 0 ? (
            <Empty>{t.noSpending}</Empty>
          ) : (
            <div className="space-y-1">
              {byCategory.slice(0, 8).map((c) => (
                <HBar
                  key={c.id ?? "none"}
                  label={<span className="flex items-center gap-2"><CategoryIcon name={c.icon} className="size-4 shrink-0 text-ink-2" />{c.name}</span>}
                  value={c.total}
                  max={maxCat}
                  display={`${money(c.total, currency)} · ${((c.total / summary.expense) * 100).toFixed(0)}%`}
                  tone={c.id === null ? "muted" : "ink"}
                  href={`/transactions?month=${month}&categoryId=${c.id ?? "none"}`}
                />
              ))}
              {byCategory.length > 8 && (
                <HBar
                  label={t.byCategory.other}
                  value={byCategory.slice(8).reduce((a, b) => a + b.total, 0)}
                  max={maxCat}
                  display={money(byCategory.slice(8).reduce((a, b) => a + b.total, 0), currency)}
                  tone="muted"
                />
              )}
            </div>
          )}
        </Card>

        <Card
          className="lg:col-span-2"
          title={t.daily.title}
          subtitle={peakDay.total > 0 ? fmt(t.daily.peak, { day: peakDay.day, amount: money(peakDay.total, currency) }) : monthLabel(month)}
        >
          <DailyChart data={dailyData} symbol={symbol} monthName={lower(monthLabel(month).split(" ")[0])} />
        </Card>

        <Card title={t.byAccount.title} subtitle={t.byAccount.subtitle}>
          {byAccount.length === 0 ? (
            <Empty>{t.noSpending}</Empty>
          ) : (
            <div className="space-y-1">
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
                  href={a.id ? `/transactions?month=${month}&accountId=${a.id}` : `/transactions?month=${month}&accountId=none`}
                  extra={<div className="mt-0.5 text-[11px] text-muted">{plural(a.count, t.txCount)}{a.type ? ` · ${getT().common.accountTypes[a.type]}` : ""}</div>}
                />
              ))}
            </div>
          )}
        </Card>

        <Card title={t.merchants.title} subtitle={monthLabel(month)}>
          {merchants.length === 0 ? (
            <Empty>{t.noSpending}</Empty>
          ) : (
            <div className="space-y-1">
              {merchants.map((m) => (
                <HBar
                  key={m.name}
                  label={m.name}
                  value={m.total}
                  max={maxMerchant}
                  display={money(m.total, currency)}
                  tone="muted"
                  href={`/transactions?month=${month}&q=${encodeURIComponent(m.name)}`}
                  extra={<div className="mt-0.5 text-[11px] text-muted">{plural(m.count, t.merchants.purchases)}</div>}
                />
              ))}
            </div>
          )}
        </Card>

        <Card
          title={t.budget.title}
          subtitle={fmt(t.budget.subtitle, { month: monthLabel(month), currency: baseCurrency })}
          actions={<Link href="/budget" className="text-xs font-medium text-ink-2 hover:text-ink">{t.budget.view}</Link>}
        >
          {!monthPlan?.monthlyLimit && budgets.length === 0 ? (
            <Empty>
              <Link className="font-medium text-ink underline" href="/budget?edit=1">{t.budget.create}</Link>
            </Empty>
          ) : (
            <div className="space-y-4">
              {monthPlan?.monthlyLimit && (() => {
                const lim = Number(monthPlan.monthlyLimit);
                const spentAll = monthResult?.spent ?? 0;
                const over = spentAll > lim;
                return (
                  <div>
                    <div className="mb-1.5 flex items-baseline justify-between gap-2">
                      <span className="tabular text-lg font-semibold">{money(spentAll)}</span>
                      <span className="tabular text-sm text-muted">{fmt(t.budget.of, { amount: money(lim) })}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (spentAll / lim) * 100)}%`, background: over ? "var(--bad)" : "var(--ink)" }} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                      <span className="flex items-center gap-1"><Flame className="size-3.5" /> {fmt(t.budget.budgetStreak, { n: budgetStreak.current })}</span>
                      <span className="flex items-center gap-1"><PiggyBank className="size-3.5" /> {fmt(t.budget.savingsStreak, { n: savingsStreak.current })}</span>
                    </div>
                  </div>
                );
              })()}
              {budgets.slice(0, 4).map((b) => {
                const pct = b.budget > 0 ? (b.spent / b.budget) * 100 : 0;
                return (
                  <div key={b.id}>
                    <div className="mb-1 flex justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2"><CategoryIcon name={b.icon} className="size-4 text-ink-2" />{b.name}</span>
                      <span className="tabular text-ink-2">{money(b.spent)} / {money(b.budget)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: pct >= 100 ? "var(--bad)" : pct >= 80 ? "var(--warn)" : "var(--ink)" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {byCurrency.length > 1 && (
          <Card title={t.byCurrency.title} subtitle={fmt(t.byCurrency.subtitle, { currency: baseCurrency })}>
            <ul className="divide-y divide-line">
              {byCurrency.map((c) => (
                <li key={c.currency} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <Link href={`/?month=${month}&currency=${c.currency}`} className="min-w-0">
                    <span className="block">{money(c.total, c.currency)}</span>
                    <span className="text-[11px] text-muted">{plural(c.count, t.txCount)} · {c.currency}</span>
                  </Link>
                  <span className="tabular shrink-0 text-ink-2">
                    {c.converted === null ? <Badge tone="warn">{t.byCurrency.noRate}</Badge> : `≈ ${money(c.converted)}`}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card title={t.balances.title} subtitle={t.balances.subtitle} actions={<Link href="/accounts" className="text-xs font-medium text-ink-2 hover:text-ink">{t.balances.viewAccounts}</Link>}>
          {balances.filter((b) => !b.archived).length === 0 ? (
            <Empty>
              <Link className="font-medium text-ink underline" href="/accounts">{t.balances.empty}</Link>
            </Empty>
          ) : (
            <ul className="divide-y divide-line">
              {balances.filter((b) => !b.archived).map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{b.name}</span>
                  <span className={`tabular shrink-0 text-right ${b.balance < 0 ? "text-bad" : ""}`}>
                    {money(b.balance, b.currency)}
                    {/* Tarjetas con saldo en otra moneda (ej. compras en dólares) */}
                    {b.others.map((o) => (
                      <span key={o.currency} className={`block text-xs ${o.balance < 0 ? "text-bad" : "text-muted"}`}>
                        {money(o.balance, o.currency)}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t.recent.title} actions={<Link href={`/transactions?month=${month}`} className="text-xs font-medium text-ink-2 hover:text-ink">{t.recent.viewAll}</Link>}>
          {recent.rows.length === 0 ? (
            <Empty>{t.recent.empty}</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {recent.rows.slice(0, 7).map(({ tx, categoryIcon }) => (
                <li key={tx.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-3">
                    <IconBubble size="sm">{tx.type === "transfer" ? <ArrowLeftRight className="size-3.5" /> : <CategoryIcon name={categoryIcon} className="size-3.5" />}</IconBubble>
                    <span className="min-w-0">
                      <span className="block truncate">{tx.merchant || tx.description || "—"}</span>
                      <span className="text-[11px] text-muted">{formatDate(tx.date, { day: "2-digit", month: "short" })}</span>
                    </span>
                  </span>
                  <span className={`tabular shrink-0 font-medium ${tx.type === "transfer" ? "text-muted" : ""}`}>
                    {tx.type === "income" ? "+" : tx.type === "expense" ? "−" : ""}
                    {money(tx.amount, tx.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
