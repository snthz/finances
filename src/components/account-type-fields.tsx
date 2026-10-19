"use client";

import { useState } from "react";
import { fmt, useT } from "@/i18n/client";
import { ChipGroup, Field } from "./form/controls";
import { Select, type SelectOption } from "./form/select";

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));

/**
 * Tipo, moneda y saldo inicial de la cuenta. Si es tarjeta de crédito, también las monedas adicionales
 * del saldo (ej. lempiras y dólares) con su saldo inicial, el día de corte y el día límite de pago.
 */
export function AccountTypeFields({
  defaultType,
  typeOptions,
  currencyOptions,
  currencyHint,
  defaultCurrency,
  extraCurrencies,
  initialBalance,
  extraInitialBalances,
  statementDay,
  dueDay,
  institutionField,
  children,
}: {
  defaultType: string;
  typeOptions: SelectOption[];
  currencyOptions: SelectOption[];
  currencyHint?: React.ReactNode;
  defaultCurrency: string;
  extraCurrencies: string[];
  initialBalance: string;
  extraInitialBalances: Record<string, string>;
  statementDay: number | null;
  dueDay: number | null;
  /** Campo que acompaña al tipo en la misma fila (institución) */
  institutionField: React.ReactNode;
  /** Campos entre la moneda y el saldo inicial (últimos dígitos) */
  children?: React.ReactNode;
}) {
  const t = useT();
  const f = t.accounts.form;
  const [type, setType] = useState(defaultType);
  const [currency, setCurrency] = useState(defaultCurrency);
  const [extras, setExtras] = useState(extraCurrencies.filter((c) => c !== defaultCurrency));
  const isCredit = type === "credit_card";
  const extraList = isCredit ? extras.filter((c) => c !== currency) : [];
  const dayOptions = [{ value: "", label: f.dayNotSet }, ...DAYS.map((d) => ({ value: d, label: d }))];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={f.type}>
          <Select name="type" value={type} onChange={setType} options={typeOptions} />
        </Field>
        {institutionField}
      </div>

      <Field label={f.currency} hint={currencyHint}>
        <Select name="currency" value={currency} onChange={setCurrency} options={currencyOptions} />
      </Field>

      {isCredit && (
        <Field label={f.extraCurrencies} hint={f.extraCurrenciesHint}>
          <ChipGroup
            name="extraCurrencies"
            multiple
            value={extraList}
            onChange={setExtras}
            options={currencyOptions.filter((o) => o.value !== currency).map((o) => ({ value: o.value, label: o.value }))}
          />
        </Field>
      )}

      {children}

      {/* Saldo inicial: uno por cada moneda del saldo de la tarjeta */}
      <div className={`grid gap-4 ${extraList.length ? "sm:grid-cols-2" : ""}`}>
        <Field label={extraList.length ? fmt(f.initialBalanceIn, { currency }) : f.initialBalance} htmlFor="initialBalance">
          <input id="initialBalance" name="initialBalance" inputMode="decimal" defaultValue={initialBalance} className="input tabular" />
        </Field>
        {extraList.map((c) => (
          <Field key={c} label={fmt(f.initialBalanceIn, { currency: c })} htmlFor={`initialBalance_${c}`}>
            <input id={`initialBalance_${c}`} name={`initialBalance_${c}`} inputMode="decimal" defaultValue={extraInitialBalances[c] ?? "0"} className="input tabular" />
          </Field>
        ))}
      </div>
      <p className="hint -mt-3">{isCredit ? f.initialBalanceHint : f.initialBalanceHintOther}</p>

      {isCredit && (
        <div>
          <div className="grid grid-cols-2 gap-4">
            <Field label={f.statementDay}>
              <Select name="statementDay" defaultValue={statementDay ? String(statementDay) : ""} options={dayOptions} searchable={false} />
            </Field>
            <Field label={f.dueDay}>
              <Select name="dueDay" defaultValue={dueDay ? String(dueDay) : ""} options={dayOptions} searchable={false} />
            </Field>
          </div>
          <p className="hint">{f.cycleHint}</p>
        </div>
      )}
    </>
  );
}
