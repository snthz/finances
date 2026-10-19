import { Check, CreditCard } from "lucide-react";
import Link from "next/link";
import { fmt, getT } from "@/i18n/server";
import type { CardCurrency, CardSummary } from "@/lib/cards";
import { formatDate, formatYmd, money } from "@/lib/format";
import { dueLabel } from "@/lib/payments-shared";
import { DateBlock } from "./payment-row";
import { IconBubble } from "./ui";

/** "L 1,000.00 + $ 20.00" con las monedas que tienen valor (o 0 en la moneda de la tarjeta). */
function amounts(list: CardCurrency[], pick: (c: CardCurrency) => number | null, fallbackCurrency: string) {
  const parts = list.filter((c) => (pick(c) ?? 0) > 0).map((c) => money(pick(c) ?? 0, c.currency));
  return parts.length ? parts.join(" + ") : money(0, fallbackCurrency);
}

/** Estado de una tarjeta de crédito: deuda total (contado + financiado), pago de contado del ciclo y pagos. */
export function CreditCardPanel({ s }: { s: CardSummary }) {
  const dict = getT();
  const t = dict.cards;
  const a = s.account;
  const payoffLeft = s.currencies.some((c) => (c.payoff ?? 0) > 0);
  const hadStatementDebt = s.currencies.some((c) => (c.statementDebt ?? 0) > 0);
  const overdue = payoffLeft && s.daysLeft !== null && s.daysLeft < 0;

  return (
    <div className="card flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <IconBubble>
            <CreditCard className="size-4.5" />
          </IconBubble>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold">{a.name}</div>
            <div className="truncate text-xs text-muted">
              {[a.institution, a.identifiers.length ? `•••• ${a.identifiers.join(", ")}` : null].filter(Boolean).join(" · ") || dict.common.accountTypes.credit_card}
            </div>
          </div>
        </div>
        <Link href={`/payments?payCard=${a.id}`} scroll={false} className="inline-flex h-8 shrink-0 items-center rounded-full bg-ink px-3.5 text-xs font-medium text-bg transition active:scale-95">
          {t.pay}
        </Link>
      </div>

      {/* Deuda por moneda: cada saldo de la tarjeta (ej. lempiras y dólares) por separado */}
      <div className="mt-4 text-xs font-medium text-muted">{t.totalOwed}</div>
      <div className={`mt-0.5 grid gap-4 ${s.currencies.length > 1 ? "grid-cols-2" : ""}`}>
        {s.currencies.map((c) => (
          <div key={c.currency} className="min-w-0">
            <div className="tabular text-2xl font-semibold tracking-tight break-words">{money(c.total, c.currency)}</div>
            <div className="tabular mt-1 space-y-0.5 text-xs text-muted">
              <div>
                {c.debt < 0 ? t.inFavor : t.purchases} <span className="text-ink-2">{money(Math.abs(c.debt), c.currency)}</span>
              </div>
              {c.financed > 0 && (
                <div>
                  {t.financed} <span className="text-ink-2">{money(c.financed, c.currency)}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pago de contado del último corte */}
      <div className="mt-4 rounded-2xl bg-surface-2 p-3.5">
        {s.statement ? (
          <div className="flex items-center gap-3">
            {s.due && <DateBlock ymd={s.due} tone={overdue ? "bad" : payoffLeft && (s.daysLeft ?? 99) <= 3 ? "solid" : "neutral"} />}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-xs font-medium text-ink-2">{t.payoff}</span>
                {payoffLeft && s.due && s.daysLeft !== null && (
                  <span className={`text-[11px] ${overdue ? "font-medium text-bad" : "text-muted"}`}>{dueLabel(s.daysLeft, dict.payments.due)}</span>
                )}
              </div>
              {payoffLeft ? (
                <div className="tabular text-lg font-semibold tracking-tight break-words">{amounts(s.currencies, (c) => c.payoff, a.currency)}</div>
              ) : (
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Check className="size-4" /> {hadStatementDebt ? t.payoffDone : t.noStatementDebt}
                </div>
              )}
              <div className="truncate text-[11px] text-muted">
                {fmt(t.statement, {
                  date: formatYmd(s.statement),
                  amount: amounts(s.currencies, (c) => c.statementDebt, a.currency),
                })}
                {s.due && <> · {fmt(t.due, { date: formatYmd(s.due) })}</>}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-ink-2">
            {t.setupCycle}{" "}
            <Link href={`/accounts?edit=${a.id}&returnTo=/payments`} scroll={false} className="font-medium text-ink underline">
              {t.setupLink}
            </Link>
          </p>
        )}
      </div>

      {/* Ciclo actual y último pago */}
      <div className="mt-3 space-y-0.5 text-xs text-muted">
        <div>
          <span className="text-ink-2">{s.statement ? fmt(t.sinceCutoff, { date: formatYmd(s.statement) }) : t.thisMonth}</span>
          {": "}
          <span className="tabular">
            {fmt(t.spentPaid, { spent: amounts(s.currencies, (c) => c.spent, a.currency), paid: amounts(s.currencies, (c) => c.paid, a.currency) })}
          </span>
        </div>
        <div className="tabular">
          {s.lastPayment
            ? fmt(t.lastPayment, { amount: money(s.lastPayment.amount, s.lastPayment.currency), date: formatDate(s.lastPayment.date, { day: "numeric", month: "short" }) })
            : t.noPayments}
        </div>
      </div>
    </div>
  );
}
