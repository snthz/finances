"use client";

import { Check, ChevronRight, FlaskConical, X } from "lucide-react";
import { useActionState, useState } from "react";
import { saveRule, testRule, type TestResult } from "@/actions/email";
import { SubmitButton, submitWithoutReset, useToastState } from "./action-form";
import { ConfirmButton } from "./confirm-button";
import { Field, Segmented, Switch } from "./form/controls";
import { Select } from "./form/select";
import { SheetFooter } from "./form/sheet";
import { CategoryIcon } from "./category-icon";
import { useT } from "@/i18n/client";

type Opt = { id: number; name: string };

export type RuleInitial = {
  id?: number;
  name: string;
  enabled: boolean;
  ignore: boolean;
  priority: number;
  fromPattern: string;
  subjectPattern: string;
  bodyPattern: string;
  type: "expense" | "income" | "transfer" | "card_payment";
  amountRegex: string;
  merchantRegex: string;
  identifierRegex: string;
  currencyRegex: string;
  dateRegex: string;
  dedupeRegex: string;
  defaultCurrency: string;
  accountId: number | null;
  categoryId: number | null;
};

function Mono({ name, label, defaultValue, placeholder, hint }: { name: string; label: string; defaultValue?: string; placeholder?: string; hint?: string }) {
  return (
    <Field label={label} htmlFor={name} hint={hint}>
      <input id={name} name={name} defaultValue={defaultValue} placeholder={placeholder} spellCheck={false} autoCapitalize="off" className="input font-mono text-[13px]" />
    </Field>
  );
}

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-bg">{n}</span>
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
          {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
        </div>
      </div>
      <div className="space-y-4 sm:pl-9">{children}</div>
    </section>
  );
}

export function RuleEditor({ initial, accounts, categories, currencies, messages, testMessageId, deleteFormId }: {
  initial: RuleInitial;
  accounts: Opt[];
  categories: (Opt & { icon: string })[];
  currencies: string[];
  messages: { id: number; subject: string; from: string }[];
  testMessageId?: number;
  /** id del form de borrado (fuera de este form) */
  deleteFormId?: string;
}) {
  const t = useT();
  const e = t.email.editor;
  const [saveState, saveAction, saving] = useActionState(saveRule, null);
  const [testState, testAction, testing] = useActionState(testRule, null);
  const [type, setType] = useState(initial.type);
  const cardPayment = type === "card_payment";
  useToastState(saveState);
  const result = testState?.data as TestResult | undefined;

  return (
    <form
      className="space-y-7"
      onSubmit={(ev) => submitWithoutReset(ev, (fd, submitter) => (submitter?.getAttribute("value") === "test" ? testAction(fd) : saveAction(fd)))}
    >
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      <div className="space-y-4">
        <Field label={e.name} htmlFor="name">
          <input id="name" name="name" defaultValue={initial.name} placeholder={e.namePlaceholder} className="input" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
          <Field label={e.creates}>
            <Segmented
              name="type"
              value={type}
              onChange={(v) => setType(v as RuleInitial["type"])}
              options={[
                { value: "expense", label: t.common.txTypes.expense },
                { value: "income", label: t.common.txTypes.income },
                { value: "transfer", label: e.transferShort },
                { value: "card_payment", label: e.cardPaymentShort },
              ]}
            />
          </Field>
          <Field label={e.priority} htmlFor="priority">
            <input id="priority" name="priority" type="number" defaultValue={initial.priority} className="input tabular" />
          </Field>
        </div>
        {cardPayment && <p className="hint -mt-2">{e.cardPaymentHint}</p>}
        <div className="card divide-y divide-line px-4 shadow-none">
          <div className="py-2">
            <Switch name="enabled" defaultChecked={initial.enabled} label={e.enabled} />
          </div>
          <div className="py-2">
            <Switch name="ignore" defaultChecked={initial.ignore} label={e.ignore} hint={e.ignoreHint} />
          </div>
        </div>
      </div>

      <Step n={1} title={e.step1} hint={e.step1Hint}>
        <Mono name="fromPattern" label={e.fromContains} defaultValue={initial.fromPattern} placeholder="baccredomatic|ficohsa" />
        <Mono name="subjectPattern" label={e.subjectContains} defaultValue={initial.subjectPattern} placeholder="consumo|compra" />
        <Mono name="bodyPattern" label={e.bodyContains} defaultValue={initial.bodyPattern} placeholder="tarjeta de cr[eé]dito" />
      </Step>

      <Step n={2} title={e.step2} hint={e.step2Hint}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Mono name="amountRegex" label={e.amount} defaultValue={initial.amountRegex} placeholder="Monto:\s*L\.\s*([\d,.]+)" />
          <Mono name="identifierRegex" label={e.last4} defaultValue={initial.identifierRegex} placeholder="terminada en (\d{4})" />
          <Mono name="merchantRegex" label={e.merchant} defaultValue={initial.merchantRegex} placeholder="Comercio:\s*(.+)" />
          <Mono name="currencyRegex" label={e.currency} defaultValue={initial.currencyRegex} placeholder="(L\.|US\$)" />
          <Mono name="dateRegex" label={e.date} defaultValue={initial.dateRegex} placeholder="Fecha\s+(\d{2}/\d{2}/\d{4})" hint={e.dateHint} />
          <Mono
            name="dedupeRegex"
            label={e.dedupe}
            defaultValue={initial.dedupeRegex}
            placeholder="Planilla\s+(.+?Quincena de \w+ \d{4})"
            hint={e.dedupeHint}
          />
        </div>
      </Step>

      <Step n={3} title={e.step3} hint={e.step3Hint}>
        <div className={`grid gap-4 ${cardPayment ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
          {/* En un pago de tarjeta la tarjeta sale de los últimos 4; aquí se elige la cuenta de origen */}
          <Field label={cardPayment ? e.paidFrom : e.account}>
            <Select
              key={cardPayment ? "from" : "account"}
              name="accountId"
              defaultValue={initial.accountId ? String(initial.accountId) : ""}
              options={[{ value: "", label: cardPayment ? e.paidFromUnknown : e.byLast4 }, ...accounts.map((a) => ({ value: String(a.id), label: a.name }))]}
            />
          </Field>
          {!cardPayment && (
            <Field label={e.category}>
              <Select
                name="categoryId"
                defaultValue={initial.categoryId ? String(initial.categoryId) : ""}
                options={[{ value: "", label: e.byKeywords }, ...categories.map((c) => ({ value: String(c.id), label: c.name, icon: <CategoryIcon name={c.icon} /> }))]}
              />
            </Field>
          )}
          <Field label={e.fallbackCurrency}>
            <Select name="defaultCurrency" defaultValue={initial.defaultCurrency} options={[{ value: "", label: e.accountCurrency }, ...currencies.map((c) => ({ value: c, label: c }))]} />
          </Field>
        </div>
      </Step>

      <section className="space-y-4 rounded-2xl bg-surface-2 p-4">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <FlaskConical className="size-4" /> {e.test}
        </h3>
        {messages.length > 0 && (
          <Field label={e.withImported}>
            <Select
              name="testMessageId"
              defaultValue={testMessageId ? String(testMessageId) : ""}
              searchable
              options={[{ value: "", label: e.orPaste }, ...messages.map((m) => ({ value: String(m.id), label: m.subject || t.email.inbox.noSubject, hint: m.from }))]}
            />
          </Field>
        )}
        <details className="group" open={messages.length === 0}>
          <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-ink-2">
            <ChevronRight className="size-4 transition group-open:rotate-90" /> {e.pasteEmail}
          </summary>
          <div className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="testFrom" placeholder={e.testFrom} className="input bg-surface" />
              <input name="testSubject" placeholder={e.testSubject} className="input bg-surface" />
            </div>
            <textarea name="testBody" rows={4} placeholder={e.testBody} className="textarea bg-surface font-mono text-xs" />
          </div>
        </details>
        <SubmitButton name="_intent" value="test" pending={testing} className="btn-ghost" pendingText={e.testing}>
          {e.testButton}
        </SubmitButton>
        {testState?.error && <p className="text-sm text-bad">{testState.error}</p>}
        {result && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-xl bg-surface p-4 text-sm">
            <dt className="text-muted">{e.matches}</dt>
            <dd className="flex items-center gap-1.5 font-medium">
              {result.matched ? <Check className="size-4" /> : <X className="size-4 text-bad" />}
              {result.matched ? e.yes : <span className="text-bad">{e.noCheckStep1}</span>}
            </dd>
            <dt className="text-muted">{e.amount}</dt>
            <dd className="tabular font-medium">{result.amount ?? <span className="text-bad">{e.notDetected}</span>}</dd>
            <dt className="text-muted">{e.currency}</dt>
            <dd>{result.currency ?? "—"}</dd>
            <dt className="text-muted">{e.last4Short}</dt>
            <dd className="font-mono">{result.identifier ?? "—"}</dd>
            <dt className="text-muted">{cardPayment ? e.card : e.account}</dt>
            <dd>{result.account ?? <span className="text-warn">{e.noAccountMatches}</span>}</dd>
            <dt className="text-muted">{e.merchant}</dt>
            <dd>{result.merchant ?? "—"}</dd>
            <dt className="text-muted">{t.email.fields.date}</dt>
            <dd className="tabular">{result.date ?? e.emailDate}</dd>
            {result.dedupeKey && (
              <>
                <dt className="text-muted">{e.duplicates}</dt>
                <dd>{result.dedupeKey}</dd>
              </>
            )}
          </dl>
        )}
      </section>

      <SheetFooter>
        {deleteFormId && (
          <ConfirmButton form={deleteFormId} confirmLabel={e.confirmDelete}>
            {t.common.actions.delete}
          </ConfirmButton>
        )}
        <SubmitButton name="_intent" value="save" pending={saving} className="btn-primary ml-auto h-11 flex-1 sm:flex-none sm:px-8">
          {initial.id ? e.saveRule : e.createRule}
        </SubmitButton>
      </SheetFooter>
    </form>
  );
}
