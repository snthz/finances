import Link from "next/link";
import { CurrencyTabs, MonthNav } from "@/components/month-nav";
import { StatTiles } from "@/components/stat-tiles";
import { ArrowLeftRight, CalendarClock, ChartPie, Flame, PiggyBank } from "lucide-react";
import { PaymentDueRow } from "@/components/payment-row";
import { paymentReminders } from "@/lib/payments";
import { Badge, Card, Empty, HBar, IconBubble, Notice, PageHeader } from "@/components/ui";
import { requireAuth } from "@/lib/auth";
import { budgetHistory, planFor, streak } from "@/lib/budget";
import { appSettings } from "@/lib/settings";
import { currentMonth, daysInMonth, formatDate, money, monthLabel, shiftMonth } from "@/lib/format";
import { accountBalances, budgetsStatus, getCurrencies, listTransactions, missingRates, monthSummary, spendingByCategory, type Scope } from "@/lib/queries";
import { CategoryIcon } from "@/components/category-icon";
import { fmt, getLocale, getT, plural } from "@/i18n/server";

type SP = Promise<{ month?: string; currency?: string }>;

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

  const [summary, prev, byCategory, balances, budgets, recent, missing] = await Promise.all([
    monthSummary(month, scope),
    monthSummary(prevMonth, scope),
    spendingByCategory(month, scope),
    accountBalances(),
    budgetsStatus(month),
    listTransactions({ month, currency: scope.currency }),
    scope.currency ? Promise.resolve([]) : missingRates(month),
  ]);

  const [history, reminders] = await Promise.all([budgetHistory(), paymentReminders()]);
  const monthPlan = planFor(history.plans, month);
  const monthResult = history.months.find((m) => m.ym === month);
  const budgetStreak = streak(history.months, "budgetMet");
  const savingsStreak = streak(history.months, "savingsMet");

  const days = daysInMonth(month);
  const elapsed = month === currentMonth() ? Number(new Date().toLocaleString("en-US", { timeZone: timezone, day: "numeric" })) : days;
  const dailyAvg = elapsed > 0 ? summary.expense / elapsed : 0;

  const maxCat = byCategory[0]?.total ?? 0;
  const uncategorized = byCategory.find((c) => c.id === null);
  const params = { month, currency: scope.currency };
  const statsHref = `/stats?${new URLSearchParams({ period: "month", date: `${month}-01`, ...(scope.currency ? { currency: scope.currency } : {}) })}`;

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
      <StatTiles
        spendingLabel={t.stats.monthSpending}
        expense={summary.expense}
        income={summary.income}
        prev={prev}
        currency={currency}
        vsLabel={t.delta.vsPrevious}
        noPrevious={t.delta.noPrevious}
        fourth={{ label: t.stats.dailyAverage, value: money(dailyAvg, currency), note: fmt(t.stats.projection, { amount: money(dailyAvg * days, currency) }) }}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title={t.byCategory.title}
          subtitle={monthLabel(month)}
          actions={
            uncategorized ? (
              <Link href={`/transactions?month=${month}&categoryId=none`}>
                <Badge tone="warn">{fmt(t.byCategory.uncategorized, { amount: money(uncategorized.total, currency) })}</Badge>
              </Link>
            ) : null
          }
        >
          {byCategory.length === 0 ? (
            <Empty>{t.noSpending}</Empty>
          ) : (
            <div className="space-y-1">
              {byCategory.slice(0, 5).map((c) => (
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
              {byCategory.length > 5 && (
                <HBar
                  label={t.byCategory.other}
                  value={byCategory.slice(5).reduce((a, b) => a + b.total, 0)}
                  max={maxCat}
                  display={money(byCategory.slice(5).reduce((a, b) => a + b.total, 0), currency)}
                  tone="muted"
                />
              )}
            </div>
          )}
          <Link href={statsHref} className="btn-subtle mt-4 flex h-10 w-full items-center justify-center gap-2 text-sm">
            <ChartPie className="size-4" /> {t.byCategory.viewStats}
          </Link>
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

        <Card title={t.balances.title} subtitle={t.balances.subtitle} actions={<Link href="/accounts" className="text-xs font-medium text-ink-2 hover:text-ink">{t.balances.viewAccounts}</Link>}>
          {balances.filter((b) => !b.archived && !b.linkedTo).length === 0 ? (
            <Empty>
              <Link className="font-medium text-ink underline" href="/accounts">{t.balances.empty}</Link>
            </Empty>
          ) : (
            <ul className="-mr-2 max-h-72 divide-y divide-line overflow-y-auto overscroll-contain pr-2">
              {balances.filter((b) => !b.archived && !b.linkedTo).map((b) => (
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
            <ul className="-mr-2 max-h-72 divide-y divide-line overflow-y-auto overscroll-contain pr-2">
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
