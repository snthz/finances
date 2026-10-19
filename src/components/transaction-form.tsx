"use client";

import { ArrowRight, Mail, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { deleteTransaction, saveTransaction } from "@/actions/transactions";
import { ConfirmButton } from "./confirm-button";
import { ActionForm, FormMessages, SubmitButton } from "./action-form";
import { DateField, Field, Segmented } from "./form/controls";
import { Select } from "./form/select";
import { SheetFooter } from "./form/sheet";
import { CategoryIcon } from "./category-icon";
import { fmt, useT } from "@/i18n/client";

type Opt = { id: number; name: string };
type Cat = Opt & { kind: "expense" | "income"; icon: string };
type Acc = Opt & { currency: string; archived: boolean; identifiers: string[]; type?: string };

export type TxInitial = {
  id?: number;
  type: "expense" | "income" | "transfer";
  date: string;
  amount: string;
  currency: string;
  merchant: string;
  description: string;
  notes: string;
  accountId: number | null;
  toAccountId: number | null;
  categoryId: number | null;
  source?: string;
  detectedIdentifier?: string | null;
  scheduledPaymentId?: number | null;
};

type PaymentOpt = { id: number; name: string; icon: string; nextDue: string };

const TYPES = ["expense", "income", "transfer"] as const;

export function TransactionForm({ initial, accounts, categories, currencies, returnTo, today, yesterday, payments = [] }: {
  initial: TxInitial;
  /** Pagos programados que este movimiento puede saldar */
  payments?: PaymentOpt[];
  accounts: Acc[];
  categories: Cat[];
  currencies: { code: string; symbol: string; name: string }[];
  returnTo: string;
  today: string;
  yesterday: string;
}) {
  const t = useT();
  const f = t.transactions.form;
  const [type, setType] = useState(initial.type);
  const [currency, setCurrency] = useState(initial.currency);
  const [accountId, setAccountId] = useState(initial.accountId ? String(initial.accountId) : "");
  const [amount, setAmount] = useState(initial.amount);
  const [toAccountId, setToAccountId] = useState(initial.toAccountId ? String(initial.toAccountId) : "");
  // A una tarjeta de crédito se puede pagar desde fuera (efectivo, otro banco): el origen es opcional
  const toIsCredit = accounts.find((a) => String(a.id) === toAccountId)?.type === "credit_card";
  const activeAccounts = accounts.filter((a) => !a.archived || a.id === initial.accountId || a.id === initial.toAccountId);
  const accountOptions = activeAccounts.map((a) => ({
    value: String(a.id),
    label: a.name,
    hint: [a.currency, a.identifiers.length ? `•••• ${a.identifiers.join(", ")}` : null].filter(Boolean).join(" · "),
  }));
  const symbol = currencies.find((c) => c.code === currency)?.symbol ?? currency;
  const dueFmt = (ymd: string) => new Intl.DateTimeFormat(undefined, { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${ymd}T12:00:00Z`));

  return (
    <>
      <ActionForm action={saveTransaction} messages="manual" className="space-y-5">
        {initial.id && <input type="hidden" name="id" value={initial.id} />}
        <input type="hidden" name="returnTo" value={returnTo} />

        {initial.source === "email" && (
          <p className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-2">
            <Mail className="size-3.5" /> {f.importedFromEmail}
          </p>
        )}

        <Segmented name="type" options={TYPES.map((v) => ({ value: v, label: t.common.txTypes[v] }))} value={type} onChange={(v) => setType(v as TxInitial["type"])} />

        {/* Monto */}
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
              autoFocus={!initial.id}
              autoComplete="off"
              aria-label={f.amount}
              className="tabular min-w-0 bg-transparent text-left text-5xl font-semibold tracking-tight outline-none placeholder:text-surface-3"
              // El ancho sigue al texto para que el símbolo quede pegado al número
              style={{ width: `${Math.min(12, Math.max(4, amount.length || 4)) * 0.62 + 0.2}em` }}
            />
          </div>
          <div className="mt-2 flex justify-center">
            <Select
              name="currency"
              variant="ghost"
              value={currency}
              onChange={setCurrency}
              ariaLabel={f.currency}
              options={currencies.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }))}
            />
          </div>
        </div>

        {type === "transfer" ? (
          <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <Field label={f.from}>
              <Select
                name="accountId"
                value={accountId}
                onChange={setAccountId}
                options={toIsCredit ? [{ value: "", label: f.externalSource }, ...accountOptions] : accountOptions}
                placeholder={f.fromPlaceholder}
              />
            </Field>
            <ArrowRight className="mx-auto hidden size-4 text-muted sm:mb-3.5 sm:block" />
            <Field label={f.to}>
              <Select name="toAccountId" value={toAccountId} onChange={setToAccountId} options={accountOptions} placeholder={f.toPlaceholder} />
            </Field>
            <p className="hint sm:col-span-3">{f.transferHint}</p>
          </div>
        ) : (
          <>
            <Field label={type === "income" ? f.source : f.merchant} htmlFor="merchant">
              <input id="merchant" name="merchant" defaultValue={initial.merchant} className="input" placeholder={type === "income" ? f.sourcePlaceholder : f.merchantPlaceholder} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={f.category}>
                <Select
                  key={type}
                  name="categoryId"
                  defaultValue={initial.categoryId ? String(initial.categoryId) : ""}
                  options={[
                    { value: "", label: f.auto, hint: f.autoHint, icon: <Sparkles className="size-4" /> },
                    ...categories.filter((c) => c.kind === type).map((c) => ({ value: String(c.id), label: c.name, icon: <CategoryIcon name={c.icon} /> })),
                  ]}
                />
              </Field>
              <Field
                label={f.account}
                hint={
                  initial.detectedIdentifier && !initial.accountId ? (
                    <>
                      {fmt(f.detected, { id: initial.detectedIdentifier })}{" "}
                      <Link href="/accounts?new=1" className="font-medium text-ink underline">
                        {f.createAccount}
                      </Link>
                    </>
                  ) : undefined
                }
              >
                <Select
                  name="accountId"
                  value={accountId}
                  onChange={(v) => {
                    setAccountId(v);
                    const acc = accounts.find((a) => String(a.id) === v);
                    if (acc && !initial.id) setCurrency(acc.currency);
                  }}
                  options={[{ value: "", label: f.noAccount }, ...accountOptions]}
                />
              </Field>
            </div>
          </>
        )}

        {type !== "income" && payments.length > 0 && (
          <Field label={f.settles} hint={f.settlesHint}>
            <Select
              name="scheduledPaymentId"
              defaultValue={initial.scheduledPaymentId ? String(initial.scheduledPaymentId) : ""}
              options={[
                { value: "", label: f.settlesNone },
                ...payments.map((p) => ({ value: String(p.id), label: p.name, hint: fmt(f.settlesDue, { date: dueFmt(p.nextDue) }), icon: <CategoryIcon name={p.icon} /> })),
              ]}
            />
          </Field>
        )}

        <Field label={f.date} htmlFor="date">
          <DateField id="date" name="date" defaultValue={initial.date} today={today} yesterday={yesterday} />
        </Field>

        <Field label={f.description} htmlFor="description">
          <input id="description" name="description" defaultValue={initial.description} className="input" placeholder={f.optional} />
        </Field>
        <Field label={f.notes} htmlFor="notes">
          <textarea id="notes" name="notes" rows={2} defaultValue={initial.notes} className="textarea" placeholder={f.optional} />
        </Field>

        <FormMessages />
        <SheetFooter>
          {initial.id && (
            <ConfirmButton form="delete-tx" className="btn-danger" confirmLabel={f.confirmDelete}>
              {t.common.actions.delete}
            </ConfirmButton>
          )}
          <SubmitButton className="btn-primary ml-auto h-11 flex-1 sm:flex-none sm:px-8">{initial.id ? f.saveChanges : t.common.actions.add}</SubmitButton>
        </SheetFooter>
      </ActionForm>
      {initial.id && (
        <form id="delete-tx" action={deleteTransaction}>
          <input type="hidden" name="id" value={initial.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
        </form>
      )}
    </>
  );
}
