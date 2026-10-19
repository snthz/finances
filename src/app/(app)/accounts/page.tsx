import { sql } from "drizzle-orm";
import { Banknote, CreditCard, Landmark, PiggyBank, Plus, Smartphone, Wallet, WalletCards } from "lucide-react";
import Link from "next/link";
import { deleteAccount, saveAccount, toggleArchiveAccount } from "@/actions/accounts";
import { AccountTypeFields } from "@/components/account-type-fields";
import { ActionForm, FormMessages, SubmitButton } from "@/components/action-form";
import { ConfirmButton } from "@/components/confirm-button";
import { Field, Switch, TagInput } from "@/components/form/controls";
import { Select } from "@/components/form/select";
import { Sheet, SheetFooter } from "@/components/form/sheet";
import { Empty, Notice, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { initScope, requireAuth } from "@/lib/auth";
import { uid } from "@/lib/context";
import { money } from "@/lib/format";
import { accountBalances } from "@/lib/queries";
import { appSettings } from "@/lib/settings";
import { fmt, getT } from "@/i18n/server";

export async function generateMetadata() {
  await initScope();
  return { title: getT().accounts.metaTitle };
}

type SP = Promise<{ edit?: string; new?: string; digits?: string; savings?: string; returnTo?: string }>;

const TYPE_ICONS: Record<string, React.ReactNode> = {
  credit_card: <CreditCard className="size-4" />,
  debit_card: <WalletCards className="size-4" />,
  bank: <Landmark className="size-4" />,
  cash: <Banknote className="size-4" />,
  wallet: <Smartphone className="size-4" />,
  other: <Wallet className="size-4" />,
};

export default async function AccountsPage({ searchParams }: { searchParams: SP }) {
  await requireAuth();
  const t = getT();
  const ta = t.accounts;
  const sp = await searchParams;
  const balances = await accountBalances();
  const { baseCurrency, currencies } = appSettings();
  const editId = Number(sp.edit);
  const editing =
    sp.edit && Number.isInteger(editId) && editId > 0
      ? await db.query.accounts.findFirst({ where: (a, { and, eq }) => and(eq(a.id, editId), eq(a.userId, uid())) })
      : null;
  const showForm = Boolean(editing || sp.new);

  // Últimos 4 detectados en correos que todavía no pertenecen a ninguna cuenta
  const orphans = await db.execute<{ ident: string; n: number }>(sql`
    select detected_identifier as ident, count(*)::int as n from transactions
    where user_id = ${uid()} and account_id is null and detected_identifier is not null
    group by 1 order by 2 desc
  `);

  const active = balances.filter((b) => !b.archived);
  const archived = balances.filter((b) => b.archived);
  // Patrimonio neto convertido a la moneda base (los saldos sin tasa no se suman)
  const parts = active.flatMap((b) => [{ currency: b.currency, balance: b.balance, rate: b.rate }, ...b.others]);
  const netWorth = parts.reduce((acc, p) => acc + (p.rate === null ? 0 : p.balance * p.rate), 0);
  const withoutRate = [...new Set(parts.filter((p) => p.rate === null).map((p) => p.currency))];

  return (
    <>
      <PageHeader
        title={ta.title}
        subtitle={
          active.length ? (
            <>
              {ta.netWorth} <span className="tabular font-medium text-ink">{money(netWorth)}</span>
              {withoutRate.length > 0 && <span className="text-muted"> · {fmt(ta.noRate, { currencies: withoutRate.join(", ") })}</span>}
            </>
          ) : (
            ta.subtitleEmpty
          )
        }
        actions={
          <Link href="/accounts?new=1" scroll={false} className="btn-primary">
            <Plus className="size-4" /> {ta.newAccount}
          </Link>
        }
      />

      {orphans.length > 0 && (
        <Notice>
          <div className="font-medium">{ta.orphans.title}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {orphans.map((o) => (
              <Link key={o.ident} href={`/accounts?new=1&digits=${o.ident}`} scroll={false} className="chip h-8">
                •••• {o.ident} <span className="text-muted">· {o.n}</span> <Plus className="size-3.5" />
              </Link>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-2">{ta.orphans.hint}</p>
        </Notice>
      )}

      {active.length === 0 ? (
        <Empty icon={<CreditCard className="size-5" />}>{ta.empty}</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((a) => {
            const isCard = a.type === "credit_card" || a.type === "debit_card";
            return (
              <Link
                key={a.id}
                href={`/accounts?edit=${a.id}`}
                scroll={false}
                className={`group relative flex min-h-44 flex-col overflow-hidden rounded-2xl p-5 transition active:scale-[0.99] ${
                  isCard ? "bg-ink text-bg shadow-pop" : "card hover:border-line-strong"
                }`}
              >
                {isCard && <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-bg/5" />}
                <div className="flex items-center justify-between gap-2">
                  <span className={`flex items-center gap-1.5 text-xs font-medium ${isCard ? "text-bg/60" : "text-muted"}`}>
                    {a.isSavings ? <PiggyBank className="size-4" /> : TYPE_ICONS[a.type]} {a.isSavings ? ta.savingsBadge : t.common.accountTypes[a.type]}
                  </span>
                  <span className={`text-xs font-medium ${isCard ? "text-bg/60" : "text-muted"}`}>{a.institution}</span>
                </div>
                <div className="mt-3 text-base font-semibold">{a.name}</div>
                <div className={`font-mono text-sm tracking-widest ${isCard ? "text-bg/70" : "text-muted"}`}>
                  {a.identifiers.length ? a.identifiers.map((i) => `•••• ${i}`).join("  ") : "—"}
                </div>
                <div className="mt-auto pt-4">
                  {a.type === "credit_card" ? (
                    <>
                      {/* Tarjeta de crédito: lo que se debe (positivo), por moneda */}
                      <div className="text-xs text-bg/60">{a.balance > 0 ? ta.inFavor : ta.owe}</div>
                      <div className="tabular text-2xl font-semibold tracking-tight">{money(Math.abs(a.balance), a.currency)}</div>
                      {a.others.map((o) => (
                        <div key={o.currency} className="tabular text-sm font-medium text-bg/80">
                          {o.balance > 0 ? "+" : ""}
                          {money(Math.abs(o.balance), o.currency)}
                          {o.balance > 0 && <span className="text-bg/60"> {ta.inFavor.toLowerCase()}</span>}
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className={`tabular text-2xl font-semibold tracking-tight ${a.balance < 0 && !isCard ? "text-bad" : ""}`}>{money(a.balance, a.currency)}</div>
                  )}
                  <div className={`mt-0.5 text-xs ${isCard ? "text-bg/60" : "text-muted"}`}>
                    {fmt(ta.thisMonth, { amount: money(a.monthExpense, a.currency) })}
                    {a.currency !== baseCurrency && a.rate !== null && <> · ≈ {money(a.balance * a.rate)}</>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {archived.length > 0 && (
        <section className="mt-8">
          <h3 className="mb-2 px-1 text-xs font-medium tracking-wide text-muted uppercase">{ta.archived}</h3>
          <ul className="card divide-y divide-line">
            {archived.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                <Link href={`/accounts?edit=${a.id}`} scroll={false} className="text-ink-2">
                  {a.name}
                </Link>
                <span className="flex items-center gap-3">
                  <span className="tabular text-muted">{money(a.balance, a.currency)}</span>
                  <form action={toggleArchiveAccount}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="btn-subtle h-8 px-3 text-xs">{ta.restore}</button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showForm && (
        <Sheet
          title={editing ? editing.name : ta.newAccount}
          description={editing ? t.common.accountTypes[editing.type] : ta.form.newDescription}
          closeHref={sp.returnTo && /^\/(?![/\\])/.test(sp.returnTo) ? sp.returnTo : "/accounts"}
        >
          <ActionForm action={saveAccount} messages="manual" className="space-y-5">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <input type="hidden" name="color" value={editing?.color ?? "#0a0a0a"} />
            {sp.returnTo?.startsWith("/") && <input type="hidden" name="returnTo" value={sp.returnTo} />}
            <Field label={ta.form.name} htmlFor="name">
              <input id="name" name="name" required defaultValue={editing?.name} placeholder={ta.form.namePlaceholder} className="input" autoFocus={!editing} />
            </Field>
            <AccountTypeFields
              defaultType={editing?.type ?? (sp.savings ? "bank" : "credit_card")}
              typeOptions={Object.entries(t.common.accountTypes).map(([v, l]) => ({ value: v, label: l, icon: TYPE_ICONS[v] }))}
              statementDay={editing?.statementDay ?? null}
              dueDay={editing?.dueDay ?? null}
            >
              <Field label={ta.form.institution} htmlFor="institution">
                <input id="institution" name="institution" defaultValue={editing?.institution ?? ""} placeholder={ta.form.optional} className="input" />
              </Field>
            </AccountTypeFields>
            <Field
              label={ta.form.currency}
              hint={
                <>
                  {ta.form.missingCurrency}{" "}
                  <Link href="/settings?tab=monedas" className="font-medium text-ink underline">
                    {ta.form.addInSettings}
                  </Link>
                </>
              }
            >
              <Select name="currency" defaultValue={editing?.currency ?? baseCurrency} options={currencies.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}`, hint: c.symbol }))} />
            </Field>
            <Field label={ta.form.lastDigits} htmlFor="identifiers" hint={ta.form.lastDigitsHint}>
              <TagInput
                id="identifiers"
                name="identifiers"
                defaultValue={editing?.identifiers ?? (sp.digits ? [sp.digits.replace(/\D/g, "").slice(-4)] : [])}
                placeholder="4521"
                inputMode="numeric"
                mono
              />
            </Field>
            <Field label={ta.form.initialBalance} htmlFor="initialBalance" hint={ta.form.initialBalanceHint}>
              <input id="initialBalance" name="initialBalance" inputMode="decimal" defaultValue={editing?.initialBalance ?? "0"} className="input tabular" />
            </Field>

            <div className="card px-4 py-2 shadow-none">
              <Switch
                name="isSavings"
                defaultChecked={editing?.isSavings ?? Boolean(sp.savings)}
                label={ta.form.savings}
                hint={ta.form.savingsHint}
              />
            </div>

            {editing && (
              <div className="flex flex-wrap gap-2">
                <Link href={`/transactions?month=all&accountId=${editing.id}`} className="btn-subtle h-9 text-xs">
                  {ta.form.viewTransactions}
                </Link>
                <button type="submit" form="archive-account" className="btn-subtle h-9 text-xs">
                  {editing.archived ? ta.restore : ta.archive}
                </button>
              </div>
            )}

            <FormMessages />
            <SheetFooter>
              {editing && (
                <ConfirmButton form="delete-account" confirmLabel={ta.form.confirmDelete}>
                  {t.common.actions.delete}
                </ConfirmButton>
              )}
              <SubmitButton className="btn-primary ml-auto h-11 flex-1 sm:flex-none sm:px-8">{editing ? t.common.actions.save : ta.form.create}</SubmitButton>
            </SheetFooter>
          </ActionForm>
          {editing && (
            <>
              <form id="delete-account" action={deleteAccount}>
                <input type="hidden" name="id" value={editing.id} />
              </form>
              <form id="archive-account" action={toggleArchiveAccount}>
                <input type="hidden" name="id" value={editing.id} />
                <input type="hidden" name="returnTo" value="/accounts" />
              </form>
            </>
          )}
        </Sheet>
      )}
    </>
  );
}
