import { CalendarClock, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { markPaymentPaid } from "@/actions/payments";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { CategoryIcon } from "@/components/category-icon";
import { DateField, Field, Switch } from "@/components/form/controls";
import { Select } from "@/components/form/select";
import { Sheet, SheetFooter } from "@/components/form/sheet";
import { PaymentForm, type PaymentInitial } from "@/components/payment-form";
import { DateBlock, PaymentDueRow } from "@/components/payment-row";
import { Card, Empty, IconBubble, PageHeader } from "@/components/ui";
import { fmt, getT, plural } from "@/i18n/server";
import { initScope, requireAuth } from "@/lib/auth";
import { formatDate, formatYmd, money } from "@/lib/format";
import { amountText, listPayments, paymentDetail, paymentTotals, today as todayYmd, type PaymentView } from "@/lib/payments";
import { addDays, dueLabel, isFrequency, type Kind, PAYMENT_KINDS } from "@/lib/payments-shared";
import { linkedTransactions } from "@/lib/payment-matching";
import { allAccounts, allCategories } from "@/lib/queries";
import { appSettings } from "@/lib/settings";

export async function generateMetadata() {
  await initScope();
  return { title: getT().payments.metaTitle };
}

type SP = Promise<{ new?: string; edit?: string; pay?: string; back?: string }>;

function scheduleText(p: PaymentView) {
  const t = getT().payments;
  if (p.frequency === "monthly") return fmt(t.page.scheduleMonthly, { day: p.anchorDay ?? Number(p.nextDue.slice(8)) });
  if (p.frequency === "once") return fmt(t.page.scheduleOnce, { date: formatYmd(p.nextDue, { day: "numeric", month: "short", year: "numeric" }) });
  return fmt(t.page.scheduleOther, { frequency: t.frequencies[p.frequency] ?? p.frequency, date: formatYmd(p.nextDue) });
}

function FinancingCard({ p }: { p: PaymentView }) {
  const t = getT().payments;
  const total = p.totalInstallments ?? 0;
  const paid = Math.max(0, (p.currentInstallment ?? 1) - 1);
  const done = !p.active && paid + 1 >= total;
  const pct = total ? ((done ? total : paid) / total) * 100 : 0;
  return (
    <Link href={`/payments?edit=${p.id}`} scroll={false} className={`card block p-5 transition hover:border-line-strong active:scale-[0.99] ${p.active ? "" : "opacity-60"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <IconBubble>
            <CategoryIcon name={p.icon} className="size-4.5" />
          </IconBubble>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold">{p.name}</div>
            <div className="truncate text-xs text-muted">{paymentDetail(p, { installment: false }) || t.kinds.financing.label}</div>
          </div>
        </div>
        <span className="tabular shrink-0 text-right">
          <span className="block text-[15px] font-semibold">{amountText(p)}</span>
          <span className="block text-[11px] text-muted">{t.page.perInstallment}</span>
        </span>
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{done ? fmt(t.page.installmentsDone, { total }) : fmt(t.page.installmentOf, { current: p.currentInstallment ?? 1, total })}</span>
        <span className="tabular text-xs text-muted">{fmt(t.page.paidPct, { pct: pct.toFixed(0) })}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted">
        {done ? (
          <span>{t.page.finished}</span>
        ) : (
          <>
            <span>
              {p.active ? fmt(t.page.nextDue, { date: formatYmd(p.nextDue), when: dueLabel(p.daysLeft, t.due).toLowerCase() }) : t.page.paused}
            </span>
            {p.remainingAmount !== null && (
              <span className="tabular">
                {fmt(t.page.remaining, { amount: money(p.remainingAmount, p.currency) })}
                {p.endsOn ? fmt(t.page.endsOn, { date: formatYmd(p.endsOn, { month: "short", year: "numeric" }) }) : ""}
              </span>
            )}
          </>
        )}
      </div>
    </Link>
  );
}

function PaymentListRow({ p }: { p: PaymentView }) {
  const t = getT().payments;
  return (
    <li>
      <Link href={`/payments?edit=${p.id}`} scroll={false} className={`flex items-center gap-3 px-4 py-3.5 transition hover:bg-surface-2/50 ${p.active ? "" : "opacity-60"}`}>
        <IconBubble>
          <CategoryIcon name={p.icon} className="size-4.5" />
        </IconBubble>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{p.name}</span>
          <span className="block truncate text-xs text-muted">{[scheduleText(p), paymentDetail(p)].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="tabular block text-sm font-semibold">{amountText(p)}</span>
          <span className={`block text-[11px] ${p.active && p.daysLeft < 0 ? "text-bad" : "text-muted"}`}>{p.active ? dueLabel(p.daysLeft, t.due) : t.page.paused}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted" />
      </Link>
    </li>
  );
}

export default async function PaymentsPage({ searchParams }: { searchParams: SP }) {
  await requireAuth();
  const dict = getT();
  const t = dict.payments;
  const sp = await searchParams;
  const back = sp.back && /^\/(?![/\\])/.test(sp.back) ? sp.back : "/payments";
  const { baseCurrency, currencies } = appSettings();
  const today = todayYmd();
  const [list, accountList, categoryList] = await Promise.all([listPayments(), allAccounts(), allCategories()]);
  const totals = paymentTotals(list);

  const active = list.filter((p) => p.active);
  const upcoming = active.filter((p) => p.daysLeft <= 30);
  const byKind = (k: Kind) => list.filter((p) => p.kind === k).sort((a, b) => Number(b.active) - Number(a.active));

  // Formulario
  const editing = sp.edit ? list.find((p) => p.id === Number(sp.edit)) : undefined;
  const newKind = sp.new ? ((sp.new in PAYMENT_KINDS ? sp.new : "service") as Kind) : null;
  let formInitial: PaymentInitial | null = null;
  if (editing) {
    formInitial = {
      id: editing.id,
      kind: editing.kind,
      subtype: editing.subtype ?? "",
      name: editing.name,
      icon: editing.icon,
      amount: editing.amount ?? "",
      currency: editing.currency,
      frequency: isFrequency(editing.frequency) ? editing.frequency : "monthly",
      day: editing.anchorDay ?? Number(editing.nextDue.slice(8)),
      nextDue: editing.nextDue,
      payMode: editing.payMode === "auto" ? "auto" : "manual",
      accountId: editing.accountId,
      toAccountId: editing.toAccountId,
      destination: editing.destination ?? "",
      categoryId: editing.categoryId,
      totalInstallments: editing.totalInstallments ? String(editing.totalInstallments) : "",
      currentInstallment: editing.currentInstallment ? String(editing.currentInstallment) : "",
      reminderDays: editing.reminderDays,
      matchKeywords: editing.matchKeywords,
      autoRecord: editing.autoRecord,
      notes: editing.notes ?? "",
      active: editing.active,
    };
  } else if (newKind) {
    formInitial = {
      kind: newKind,
      subtype: "extra",
      name: "",
      icon: PAYMENT_KINDS[newKind].icon,
      amount: "",
      currency: baseCurrency,
      frequency: "monthly",
      day: Number(today.slice(8)),
      nextDue: today,
      payMode: newKind === "financing" ? "auto" : "manual",
      accountId: null,
      toAccountId: null,
      destination: "",
      categoryId: null,
      totalInstallments: "",
      currentInstallment: "1",
      reminderDays: [0, 1, 2, 3],
      matchKeywords: [],
      autoRecord: false,
      notes: "",
      active: true,
    };
  }

  // Historial: movimientos que saldaron el pago que se está editando
  const linked = editing ? await linkedTransactions(editing.id) : [];

  const paying = sp.pay ? list.find((p) => p.id === Number(sp.pay)) : undefined;
  const accountOptions = accountList
    .filter((a) => !a.archived)
    .map((a) => ({ value: String(a.id), label: a.name, hint: [a.currency, a.identifiers.length ? `•••• ${a.identifiers.join(", ")}` : null].filter(Boolean).join(" · ") }));

  return (
    <>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <Link href="/payments?new=service" scroll={false} className="btn-primary">
            <Plus className="size-4" /> {t.newPayment}
          </Link>
        }
      />

      {list.length === 0 ? (
        <Empty icon={<CalendarClock className="size-5" />}>
          <span className="max-w-sm">{t.page.emptyIntro}</span>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {(Object.entries(PAYMENT_KINDS) as [Kind, (typeof PAYMENT_KINDS)[Kind]][]).map(([k, info]) => (
              <Link key={k} href={`/payments?new=${k}`} scroll={false} className="chip">
                <CategoryIcon name={info.icon} className="size-3.5" /> {t.kinds[k].label}
              </Link>
            ))}
          </div>
        </Empty>
      ) : (
        <>
          {/* Cifras */}
          <div className="mb-6 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3">
            <div className="col-span-2 min-w-0 rounded-2xl bg-ink p-5 text-bg shadow-pop lg:col-span-1">
              <div className="text-xs font-medium text-bg/60">{t.page.next7Days}</div>
              <div className="tabular mt-1 text-3xl font-semibold tracking-tight break-words">{money(totals.week)}</div>
              <div className="mt-2 text-xs text-bg/60">
                {plural(totals.weekCount, t.page.weekCount)}
              </div>
            </div>
            <div className="card min-w-0 p-4 md:p-5">
              <div className="text-xs font-medium text-muted">{t.page.monthlyCommitment}</div>
              <div className="tabular mt-1 text-lg font-semibold tracking-tight break-words sm:text-xl xl:text-2xl">{money(totals.monthly)}</div>
              <div className="mt-2 text-xs text-muted">{fmt(t.page.fixedAmountsIn, { currency: baseCurrency })}</div>
            </div>
            <div className="card min-w-0 p-4 md:p-5">
              <div className="text-xs font-medium text-muted">{t.page.installmentDebt}</div>
              <div className="tabular mt-1 text-lg font-semibold tracking-tight break-words sm:text-xl xl:text-2xl">{money(totals.debt)}</div>
              <div className="mt-2 text-xs text-muted">{t.page.installmentDebtHint}</div>
            </div>
          </div>

          {/* Próximos */}
          <Card title={t.page.next30Days} subtitle={t.page.next30Subtitle} padded={false} className="mb-8">
            {upcoming.length === 0 ? (
              <div className="px-5 pb-5">
                <Empty>{t.page.next30Empty}</Empty>
              </div>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {upcoming.map((p) => (
                  <PaymentDueRow key={p.id} p={p} back="/payments" />
                ))}
              </ul>
            )}
          </Card>

          {(Object.keys(PAYMENT_KINDS) as Kind[]).map((k) => {
            const items = byKind(k);
            return (
              <section key={k} className="mt-8">
                <div className="mb-3 flex items-end justify-between gap-3 px-1">
                  <h2 className="text-[15px] font-semibold tracking-tight">
                    {t.kinds[k].plural} {items.length > 0 && <span className="font-normal text-muted">· {items.length}</span>}
                  </h2>
                  <Link href={`/payments?new=${k}`} scroll={false} className="flex items-center gap-1 text-xs font-medium text-ink-2 hover:text-ink">
                    <Plus className="size-3.5" /> {dict.common.actions.add}
                  </Link>
                </div>
                {items.length === 0 ? (
                  <Empty>{t.page.kindEmpty[k]}</Empty>
                ) : k === "financing" ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((p) => (
                      <FinancingCard key={p.id} p={p} />
                    ))}
                  </div>
                ) : (
                  <ul className="card divide-y divide-line overflow-hidden">
                    {items.map((p) => (
                      <PaymentListRow key={p.id} p={p} />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </>
      )}

      {formInitial && (
        <Sheet
          title={editing ? editing.name : t.newPayment}
          description={
            editing
              ? editing.active
                ? t.kinds[editing.kind].label
                : fmt(t.page.kindPaused, { kind: t.kinds[editing.kind].label })
              : t.page.newDescription
          }
          closeHref={back}
          size="lg"
        >
          <PaymentForm
            key={editing?.id ?? `new-${newKind}`}
            initial={formInitial}
            accounts={accountList.map((a) => ({ id: a.id, name: a.name, currency: a.currency, identifiers: a.identifiers, archived: a.archived }))}
            categories={categoryList.filter((c) => c.kind === "expense").map((c) => ({ id: c.id, name: c.name, icon: c.icon }))}
            currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol, name: c.name }))}
            today={today}
            returnTo={back}
            history={
              linked.length > 0 && (
                <div>
                  <div className="label">{t.page.linkedTitle}</div>
                  <ul className="card divide-y divide-line shadow-none">
                    {linked.map((tx) => (
                      <li key={tx.id}>
                        <Link href={`/transactions?edit=${tx.id}`} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm hover:bg-surface-2/50">
                          <span className="min-w-0">
                            <span className="block truncate">{tx.merchant || tx.description || "—"}</span>
                            <span className="text-[11px] text-muted">{formatDate(tx.date)}</span>
                          </span>
                          <span className="tabular shrink-0 font-medium">{money(tx.amount, tx.currency)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <p className="hint">{t.page.linkedHint}</p>
                </div>
              )
            }
          />
        </Sheet>
      )}

      {paying && (
        <Sheet title={fmt(t.page.payTitle, { name: paying.name })} description={paymentDetail(paying) || t.kinds[paying.kind].label} closeHref={back}>
          <ActionForm action={markPaymentPaid} className="space-y-5">
            <input type="hidden" name="id" value={paying.id} />
            <input type="hidden" name="returnTo" value={back} />
            <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-4 text-sm">
              <DateBlock ymd={paying.nextDue} tone={paying.daysLeft < 0 ? "bad" : "solid"} />
              <div className="min-w-0">
                <div className="font-medium">{dueLabel(paying.daysLeft, t.due)}</div>
                <div className="text-xs text-muted">
                  {fmt(t.page.dueOn, { date: formatYmd(paying.nextDue, { weekday: "long", day: "numeric", month: "long" }) })}
                  {paying.frequency !== "once" && t.page.thenNext}
                </div>
              </div>
            </div>
            <Field label={fmt(t.page.amountPaid, { currency: paying.currency })} htmlFor="amount">
              <input id="amount" name="amount" inputMode="decimal" defaultValue={paying.amount ?? ""} placeholder="0.00" className="input tabular text-lg" autoFocus={!paying.amount} />
            </Field>
            <Field label={t.page.paymentDate} htmlFor="date">
              <DateField id="date" name="date" defaultValue={today} today={today} yesterday={addDays(today, -1)} />
            </Field>
            <Field label={paying.kind === "deposit" ? t.page.from : t.page.paidWith}>
              <Select name="accountId" defaultValue={paying.accountId ? String(paying.accountId) : ""} options={[{ value: "", label: t.unspecified }, ...accountOptions]} />
            </Field>
            <div className="card px-4 py-2 shadow-none">
              <Switch
                name="record"
                defaultChecked
                label={t.page.recordTx}
                hint={paying.kind === "deposit" && paying.toAccountId ? t.page.recordHintDeposit : t.page.recordHintExpense}
              />
            </div>
            <SheetFooter>
              <SubmitButton className="btn-primary ml-auto h-11 flex-1 sm:flex-none sm:px-8">{t.page.markPaid}</SubmitButton>
            </SheetFooter>
          </ActionForm>
        </Sheet>
      )}
    </>
  );
}

