"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { deletePayment, savePayment, togglePaymentActive } from "@/actions/payments";
import { INTL_LOCALES } from "@/i18n/config";
import { fmt, plural, useLocale, useT } from "@/i18n/client";
import {
  advanceDue,
  FINANCING_TYPES,
  FREQUENCIES,
  type Frequency,
  type Kind,
  nextOccurrenceOfDay,
  PAYMENT_KINDS,
  REMINDER_OPTIONS,
  SERVICE_PRESETS,
} from "@/lib/payments-shared";
import { ActionForm, SubmitButton } from "./action-form";
import { CategoryIcon } from "./category-icon";
import { ConfirmButton } from "./confirm-button";
import { ChipGroup, Field, IconPicker, Segmented, Switch, TagInput } from "./form/controls";
import { Select } from "./form/select";
import { SheetFooter } from "./form/sheet";

export type PaymentInitial = {
  id?: number;
  kind: Kind;
  subtype: string;
  name: string;
  icon: string;
  amount: string;
  currency: string;
  frequency: Frequency;
  day: number;
  /** Próximo vencimiento ("YYYY-MM-DD") */
  nextDue: string;
  payMode: "auto" | "manual";
  accountId: number | null;
  toAccountId: number | null;
  destination: string;
  categoryId: number | null;
  totalInstallments: string;
  currentInstallment: string;
  reminderDays: number[];
  /** Palabras que identifican el cobro en un movimiento (ej. "ENEE") */
  matchKeywords: string[];
  autoRecord: boolean;
  notes: string;
  active: boolean;
};

type Acc = { id: number; name: string; currency: string; identifiers: string[]; archived: boolean };
type Cat = { id: number; name: string; icon: string };

const shortDate = (intlLocale: string, ymd: string, year = false) =>
  new Intl.DateTimeFormat(intlLocale, { timeZone: "UTC", day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) }).format(new Date(`${ymd}T12:00:00Z`));

export function PaymentForm({
  initial,
  history,
  accounts,
  categories,
  currencies,
  today,
  returnTo,
}: {
  initial: PaymentInitial;
  /** Movimientos que ya saldaron este pago (lo arma el servidor) */
  history?: React.ReactNode;
  accounts: Acc[];
  categories: Cat[];
  currencies: { code: string; symbol: string; name: string }[];
  today: string;
  returnTo: string;
}) {
  const dict = useT();
  const t = dict.payments;
  const tf = t.form;
  const intlLocale = INTL_LOCALES[useLocale()];
  const [kind, setKind] = useState<Kind>(initial.kind);
  const [name, setName] = useState(initial.name);
  const [keywords, setKeywords] = useState<string[]>(initial.matchKeywords);
  const [icon, setIcon] = useState(initial.icon);
  const [amount, setAmount] = useState(initial.amount);
  const [currency, setCurrency] = useState(initial.currency);
  const [frequency, setFrequency] = useState<Frequency>(initial.frequency);
  const [day, setDay] = useState(String(initial.day));
  const [date, setDate] = useState(initial.nextDue);
  const [payMode, setPayMode] = useState(initial.payMode);
  const [destMode, setDestMode] = useState(initial.destination && !initial.toAccountId ? "external" : "own");
  const [total, setTotal] = useState(initial.totalInstallments);
  const [current, setCurrent] = useState(initial.currentInstallment);

  const isFinancing = kind === "financing";
  const isDeposit = kind === "deposit";
  const symbol = currencies.find((c) => c.code === currency)?.symbol ?? currency;
  const accountOptions = accounts
    .filter((a) => !a.archived || a.id === initial.accountId || a.id === initial.toAccountId)
    .map((a) => ({ value: String(a.id), label: a.name, hint: [a.currency, a.identifiers.length ? `•••• ${a.identifiers.join(", ")}` : null].filter(Boolean).join(" · ") }));

  // Vista previa del próximo vencimiento y, en financiamientos, de lo que falta
  const nextDue =
    frequency === "monthly"
      ? initial.id && initial.frequency === "monthly" && String(initial.day) === day
        ? initial.nextDue
        : nextOccurrenceOfDay(Number(day) || 1, today)
      : date;
  const totalN = Number(total);
  const currentN = Number(current) || 1;
  const remaining = isFinancing && totalN > 0 && currentN <= totalN ? totalN - currentN + 1 : null;
  let endsOn = nextDue;
  if (remaining) for (let i = 1; i < remaining && i < 600; i++) endsOn = advanceDue(endsOn, frequency, frequency === "monthly" ? Number(day) : null);
  const amountN = Number(amount.replace(/,/g, ""));
  const moneyText = (n: number) => `${symbol} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const frequencyOptions = (Object.keys(FREQUENCIES) as Frequency[])
    .filter((f) => !(isFinancing && f === "once"))
    .map((value) => ({ value, label: t.frequencies[value] }));

  return (
    <>
      <ActionForm action={savePayment} className="space-y-6">
        {initial.id && <input type="hidden" name="id" value={initial.id} />}
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="kind" value={kind} />

        {/* Tipo */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.entries(PAYMENT_KINDS) as [Kind, (typeof PAYMENT_KINDS)[Kind]][]).map(([k, info]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k);
                if (k === "financing" && frequency === "once") setFrequency("monthly");
                if (!initial.id && (icon === PAYMENT_KINDS[kind].icon || !icon)) setIcon(info.icon);
              }}
              aria-pressed={kind === k}
              className={`flex h-16 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-medium transition active:scale-[0.98] ${
                kind === k ? "bg-ink text-bg" : "bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink"
              }`}
            >
              <CategoryIcon name={info.icon} className="size-5" />
              {t.kinds[k].label}
            </button>
          ))}
        </div>

        {isFinancing && (
          <Field label={tf.financingType}>
            <ChipGroup name="subtype" defaultValue={[initial.subtype || "extra"]} options={FINANCING_TYPES.map((value) => ({ value, label: t.financingTypes[value] }))} />
          </Field>
        )}

        {kind === "service" && (
          <Field label={tf.service} hint={tf.serviceHint}>
            <div className="flex flex-wrap gap-1.5">
              {SERVICE_PRESETS.map((s) => {
                const presetName = t.servicePresets[s.key];
                const on = name.trim().toLowerCase() === presetName.toLowerCase();
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      setName(presetName);
                      setIcon(s.icon);
                      if (s.keywords) setKeywords((k) => Array.from(new Set([...k, ...s.keywords!])));
                    }}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition active:scale-[0.97] ${
                      on ? "bg-ink text-bg" : "bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink"
                    }`}
                  >
                    <CategoryIcon name={s.icon} className="size-3.5" />
                    {presetName}
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        <Field label={tf.name} htmlFor="name">
          <div className="flex gap-2">
            <IconPicker name="icon" value={icon} onChange={setIcon} />
            <input id="name" name="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder={tf.namePlaceholders[kind]} className="input" />
          </div>
        </Field>

        {/* Monto */}
        <Field
          label={isFinancing ? tf.installment : isDeposit ? tf.depositAmount : tf.amount}
          htmlFor="amount"
          hint={kind === "service" || kind === "other" ? tf.amountHint : undefined}
        >
          <div className="grid grid-cols-[1fr_9rem] gap-2">
            <input
              id="amount"
              name="amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
              placeholder={kind === "service" || kind === "other" ? tf.variable : "0.00"}
              required={isFinancing}
              className="input tabular"
            />
            <Select name="currency" value={currency} onChange={setCurrency} ariaLabel={tf.currency} options={currencies.map((c) => ({ value: c.code, label: c.code, hint: c.name }))} />
          </div>
        </Field>

        {isFinancing && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <Field label={tf.totalInstallments} htmlFor="totalInstallments">
                <input
                  id="totalInstallments"
                  name="totalInstallments"
                  inputMode="numeric"
                  required
                  value={total}
                  onChange={(e) => setTotal(e.target.value.replace(/\D/g, ""))}
                  placeholder="60"
                  className="input tabular"
                />
              </Field>
              <Field label={tf.nextInstallment} htmlFor="currentInstallment">
                <input
                  id="currentInstallment"
                  name="currentInstallment"
                  inputMode="numeric"
                  required
                  value={current}
                  onChange={(e) => setCurrent(e.target.value.replace(/\D/g, ""))}
                  placeholder="1"
                  className="input tabular"
                />
              </Field>
            </div>
            <p className="hint">
              {remaining
                ? plural(remaining, tf.installmentPreview, {
                    current: currentN,
                    total: totalN,
                    date: shortDate(intlLocale, nextDue),
                    amount: amountN > 0 ? ` (${moneyText(amountN * remaining)})` : "",
                    end: shortDate(intlLocale, endsOn, true),
                  })
                : tf.installmentHint}
            </p>
          </div>
        )}

        {/* Cuándo */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tf.frequency}>
            <Select name="frequency" value={frequency} onChange={(v) => setFrequency(v as Frequency)} options={frequencyOptions} />
          </Field>
          {frequency === "monthly" ? (
            <Field label={payMode === "auto" ? tf.chargeDay : tf.paymentDay} hint={fmt(tf.nextHint, { date: shortDate(intlLocale, nextDue, true) })}>
              <Select name="day" value={day} onChange={setDay} options={Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: fmt(tf.dayOption, { n: i + 1 }) }))} />
            </Field>
          ) : (
            <Field label={frequency === "once" ? tf.date : tf.nextDate} htmlFor="date">
              <input id="date" type="date" name="date" required value={date} onChange={(e) => setDate(e.target.value)} className="input" />
            </Field>
          )}
        </div>

        {/* Cómo se paga */}
        <div className="space-y-3">
          <Segmented
            name="payMode"
            value={payMode}
            onChange={(v) => setPayMode(v as "auto" | "manual")}
            options={[
              { value: "auto", label: isDeposit ? tf.autoDebit : tf.autoCharge },
              { value: "manual", label: isDeposit ? tf.manualDeposit : tf.manualPay },
            ]}
          />
          <Field
            label={payMode === "auto" ? (isDeposit ? tf.debitedFrom : tf.chargedTo) : isDeposit ? tf.fromOptional : tf.payFromOptional}
            hint={payMode === "auto" ? tf.autoHint : tf.manualHint}
          >
            <Select
              name="accountId"
              defaultValue={initial.accountId ? String(initial.accountId) : ""}
              options={[{ value: "", label: t.unspecified }, ...accountOptions]}
            />
          </Field>
          {payMode === "auto" && (
            <div className="card px-4 py-2 shadow-none">
              <Switch
                name="autoRecord"
                defaultChecked={initial.autoRecord}
                label={tf.autoRecord}
                hint={tf.autoRecordHint}
              />
            </div>
          )}
        </div>

        {isDeposit && (
          <div className="space-y-3">
            <Field label={tf.destQuestion}>
              <Segmented
                name="destMode"
                value={destMode}
                onChange={setDestMode}
                options={[
                  { value: "own", label: tf.ownAccount },
                  { value: "external", label: tf.external },
                ]}
              />
            </Field>
            {destMode === "own" ? (
              <Select name="toAccountId" defaultValue={initial.toAccountId ? String(initial.toAccountId) : ""} options={accountOptions} placeholder={tf.destAccount} />
            ) : (
              <input name="destination" defaultValue={initial.destination} placeholder={tf.externalPlaceholder} className="input" aria-label={tf.destAccount} />
            )}
          </div>
        )}

        {!(isDeposit && destMode === "own") && (
          <Field label={tf.category}>
            <Select
              name="categoryId"
              defaultValue={initial.categoryId ? String(initial.categoryId) : ""}
              options={[
                { value: "", label: tf.autoCategory, hint: tf.autoCategoryHint, icon: <Sparkles className="size-4" /> },
                ...categories.map((c) => ({ value: String(c.id), label: c.name, icon: <CategoryIcon name={c.icon} /> })),
              ]}
            />
          </Field>
        )}

        <Field label={tf.matchKeywords} htmlFor="matchKeywords" hint={tf.matchKeywordsHint}>
          <TagInput id="matchKeywords" name="matchKeywords" value={keywords} onChange={setKeywords} placeholder={tf.matchKeywordsPlaceholder} />
        </Field>

        <Field label={tf.reminders} hint={tf.remindersHint}>
          <ChipGroup name="reminderDays" multiple defaultValue={initial.reminderDays.map(String)} options={REMINDER_OPTIONS.map((d) => ({ value: String(d), label: t.reminderOptions[d] }))} />
        </Field>

        <Field label={tf.notes} htmlFor="notes">
          <textarea id="notes" name="notes" defaultValue={initial.notes} placeholder={tf.notesPlaceholder} className="textarea" rows={2} />
        </Field>

        {history}

        <SheetFooter>
          {initial.id && (
            <>
              <ConfirmButton form="delete-payment" confirmLabel={tf.confirmDelete}>
                {dict.common.actions.delete}
              </ConfirmButton>
              <button type="submit" form="toggle-payment" className="btn-subtle">
                {initial.active ? tf.pause : tf.resume}
              </button>
            </>
          )}
          <SubmitButton className="btn-primary ml-auto h-11 flex-1 sm:flex-none sm:px-8">{initial.id ? dict.common.actions.save : tf.create}</SubmitButton>
        </SheetFooter>
      </ActionForm>
      {initial.id && (
        <>
          <form id="delete-payment" action={deletePayment}>
            <input type="hidden" name="id" value={initial.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
          </form>
          <form id="toggle-payment" action={togglePaymentActive}>
            <input type="hidden" name="id" value={initial.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
          </form>
        </>
      )}
    </>
  );
}
