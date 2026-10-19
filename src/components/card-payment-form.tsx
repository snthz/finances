"use client";

import { useState } from "react";
import { recordCardPayment } from "@/actions/cards";
import { fmt, useT } from "@/i18n/client";
import { ActionForm, SubmitButton } from "./action-form";
import { DateField, Field } from "./form/controls";
import { Select, type SelectOption } from "./form/select";
import { SheetFooter } from "./form/sheet";

/** Atajo de monto: "Contado L 3,200.00" o "Todo L 8,000.00" en una moneda de la tarjeta. */
export type QuickAmount = { kind: "payoff" | "total"; currency: string; amount: string; display: string };

export function CardPaymentForm({ cardId, defaultCurrency, quick, currencies, fromOptions, today, yesterday, returnTo }: {
  cardId: number;
  defaultCurrency: string;
  quick: QuickAmount[];
  currencies: { code: string; symbol: string; name: string }[];
  /** Cuentas propias desde las que se paga (sin la tarjeta) */
  fromOptions: SelectOption[];
  today: string;
  yesterday: string;
  returnTo: string;
}) {
  const t = useT().cards;
  const first = quick.find((q) => q.currency === defaultCurrency) ?? quick[0];
  const [amount, setAmount] = useState(first?.amount ?? "");
  const [currency, setCurrency] = useState(first?.currency ?? defaultCurrency);
  const symbol = currencies.find((c) => c.code === currency)?.symbol ?? currency;

  return (
    <ActionForm action={recordCardPayment} className="space-y-5">
      <input type="hidden" name="cardId" value={cardId} />
      <input type="hidden" name="returnTo" value={returnTo} />

      <div className="rounded-2xl bg-surface-2 px-4 pt-4 pb-3 text-center">
        <div className="flex items-baseline justify-center gap-2">
          <span className="text-3xl font-semibold text-muted">{symbol}</span>
          <input
            name="amount"
            inputMode="decimal"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
            placeholder="0.00"
            autoFocus={!amount}
            autoComplete="off"
            aria-label={t.amount}
            className="tabular min-w-0 bg-transparent text-left text-5xl font-semibold tracking-tight outline-none placeholder:text-surface-3"
            style={{ width: `${Math.min(12, Math.max(4, amount.length || 4)) * 0.62 + 0.2}em` }}
          />
        </div>
        <div className="mt-2 flex justify-center">
          <Select
            name="currency"
            variant="ghost"
            value={currency}
            onChange={setCurrency}
            ariaLabel={t.amount}
            options={currencies.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }))}
          />
        </div>
      </div>

      {quick.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {quick.map((q) => {
            const active = q.amount === amount && q.currency === currency;
            return (
              <button
                key={`${q.kind}-${q.currency}`}
                type="button"
                onClick={() => {
                  setAmount(q.amount);
                  setCurrency(q.currency);
                }}
                className={`tabular h-8 rounded-lg px-3 text-xs font-medium transition ${active ? "bg-ink text-bg" : "bg-surface-2 text-ink-2 hover:bg-surface-3"}`}
              >
                {fmt(q.kind === "payoff" ? t.quickPayoff : t.quickTotal, { amount: q.display })}
              </button>
            );
          })}
        </div>
      )}

      <Field label={t.from}>
        <Select name="fromAccountId" defaultValue="" options={[{ value: "", label: t.fromExternal }, ...fromOptions]} />
      </Field>
      <Field label={t.date} htmlFor="date">
        <DateField id="date" name="date" defaultValue={today} today={today} yesterday={yesterday} />
      </Field>

      <SheetFooter>
        <SubmitButton className="btn-primary ml-auto h-11 flex-1 sm:flex-none sm:px-8">{t.submit}</SubmitButton>
      </SheetFooter>
    </ActionForm>
  );
}
