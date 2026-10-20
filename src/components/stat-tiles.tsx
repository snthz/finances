import { fmt, getT } from "@/i18n/server";
import { money } from "@/lib/format";

/** Variación porcentual frente al periodo anterior. */
export function Delta({ current, previous, upIsGood, inverted, vsLabel, noPrevious }: {
  current: number;
  previous: number;
  upIsGood: boolean;
  inverted?: boolean;
  vsLabel: string;
  noPrevious: string;
}) {
  const muted = inverted ? "text-bg/60" : "text-muted";
  if (!previous) return <span className={`text-xs ${muted}`}>{noPrevious}</span>;
  const pct = ((current - previous) / previous) * 100;
  const good = pct === 0 ? null : (pct > 0) === upIsGood;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${muted}`}>
      <span className={`rounded-md px-1.5 py-0.5 font-medium ${inverted ? "bg-bg/10 text-bg" : good === false ? "bg-bad/10 text-bad" : "bg-surface-2 text-ink"}`}>
        {pct > 0 ? "↑" : pct < 0 ? "↓" : "="} {Math.abs(pct).toFixed(0)}%
      </span>
      {vsLabel}
    </span>
  );
}

/** Fila de cifras: gasto (destacado), ingresos, balance neto y una cuarta cifra libre. */
export function StatTiles({ spendingLabel, expense, income, prev, currency, vsLabel, noPrevious, fourth }: {
  spendingLabel: string;
  expense: number;
  income: number;
  prev: { expense: number; income: number };
  currency: string;
  vsLabel: string;
  noPrevious: string;
  fourth: { label: string; value: string; note: React.ReactNode };
}) {
  const t = getT().dashboard.stats;
  const net = income - expense;
  const savingsRate = income > 0 ? (net / income) * 100 : null;
  const delta = { vsLabel, noPrevious };
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-5">
      <div className="col-span-2 min-w-0 rounded-2xl bg-ink p-5 text-bg shadow-pop">
        <div className="text-xs font-medium text-bg/60">{spendingLabel}</div>
        <div className="mt-1 text-4xl font-semibold tracking-tight break-words md:text-5xl">{money(expense, currency)}</div>
        <div className="mt-3">
          <Delta current={expense} previous={prev.expense} upIsGood={false} inverted {...delta} />
        </div>
      </div>
      <div className="card min-w-0 p-4 md:p-5">
        <div className="text-xs font-medium text-muted">{t.income}</div>
        <div className="mt-1 text-lg font-semibold tracking-tight break-words sm:text-xl xl:text-2xl">{money(income, currency)}</div>
        <div className="mt-2">
          <Delta current={income} previous={prev.income} upIsGood {...delta} />
        </div>
      </div>
      <div className="card min-w-0 p-4 md:p-5">
        <div className="text-xs font-medium text-muted">{t.net}</div>
        <div className={`mt-1 text-lg font-semibold tracking-tight break-words sm:text-xl xl:text-2xl ${net < 0 ? "text-bad" : ""}`}>{money(net, currency)}</div>
        <div className="mt-2 text-xs text-muted">{savingsRate === null ? t.noIncome : fmt(t.savingsRate, { pct: savingsRate.toFixed(0) })}</div>
      </div>
      <div className="card col-span-2 min-w-0 p-4 md:p-5 lg:col-span-1">
        <div className="text-xs font-medium text-muted">{fourth.label}</div>
        <div className="mt-1 text-lg font-semibold tracking-tight break-words sm:text-xl xl:text-2xl">{fourth.value}</div>
        <div className="mt-2 text-xs text-muted">{fourth.note}</div>
      </div>
    </div>
  );
}
