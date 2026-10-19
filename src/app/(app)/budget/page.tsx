import { ArrowDownToLine, ArrowUpFromLine, Flame, PiggyBank, Plus, Scale, Settings2, Target, Trophy } from "lucide-react";
import Link from "next/link";
import { adjustAccountBalance, saveBudgetPlan } from "@/actions/budget";
import { ActionForm, FormMessages, SubmitButton } from "@/components/action-form";
import { CategoryIcon } from "@/components/category-icon";
import { Field } from "@/components/form/controls";
import { Sheet, SheetFooter } from "@/components/form/sheet";
import { Badge, Card, Empty, HBar, IconBubble, PageHeader } from "@/components/ui";
import { initScope, requireAuth } from "@/lib/auth";
import { budgetHistory, planFor, savingsOverview, streak, type MonthResult } from "@/lib/budget";
import { currentMonth, daysInMonth, money, monthLabel } from "@/lib/format";
import { allCategories, spendingByCategory } from "@/lib/queries";
import { appSettings } from "@/lib/settings";
import { fmt, getLocale, getT, plural } from "@/i18n/server";

export async function generateMetadata() {
  await initScope();
  return { title: getT().budget.metaTitle };
}

type SP = Promise<{ edit?: string; adjust?: string }>;

function Progress({ value, max, tone }: { value: number; max: number; tone?: "ink" | "warn" | "bad" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color = { ink: "var(--ink)", warn: "var(--warn)", bad: "var(--bad)" }[tone ?? "ink"];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

/** Tira de los últimos 12 meses: lleno = cumplido, rojo = no cumplido, punteado = sin plan, anillo = en curso. */
function MonthStrip({ months, field }: { months: MonthResult[]; field: "budgetMet" | "savingsMet" }) {
  const t = getT();
  const last = months.slice(-12);
  return (
    <div className="flex gap-1.5">
      {last.map((m) => {
        const v = m[field];
        const label = monthLabel(m.ym, "short");
        const state = !m.closed && v !== false ? (v === true ? "ok" : "now") : v === true ? "ok" : v === false ? "miss" : "none";
        const cls = {
          ok: "bg-ink",
          miss: "bg-bad/80",
          now: "border-2 border-ink",
          none: "border border-dashed border-line-strong",
        }[state];
        const title = `${label}: ${t.budget.streaks.states[state]}`;
        return (
          <div key={m.ym} className="flex flex-1 flex-col items-center gap-1" title={title}>
            <span className={`block size-full max-h-6 max-w-6 min-h-4 min-w-4 rounded-full ${cls}`} style={{ aspectRatio: "1" }} />
            <span className="text-[9px] text-muted uppercase">{label.slice(0, 3)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default async function BudgetPage({ searchParams }: { searchParams: SP }) {
  await requireAuth();
  const t = getT();
  const tb = t.budget;
  // En español los meses van en minúscula dentro de una frase
  const inSentence = (s: string) => (getLocale() === "es" ? s.toLowerCase() : s);
  const sp = await searchParams;
  const ym = currentMonth();
  const base = appSettings().baseCurrency;
  const [{ plans, months }, savings, cats, spentByCat] = await Promise.all([
    budgetHistory(),
    savingsOverview(),
    allCategories(),
    spendingByCategory(ym, {}),
  ]);
  const plan = planFor(plans, ym);
  const now = months.at(-1);
  const limit = plan?.monthlyLimit ? Number(plan.monthlyLimit) : null;
  const target = plan?.savingsTarget ? Number(plan.savingsTarget) : null;
  const spent = now?.spent ?? spentByCat.reduce((a, c) => a + c.total, 0);
  const saved = now?.saved ?? 0;
  const budgetStreak = streak(months, "budgetMet");
  const savingsStreak = streak(months, "savingsMet");

  const totalDays = daysInMonth(ym);
  const today = Number(new Date().toLocaleString("en-US", { timeZone: appSettings().timezone, day: "numeric" }));
  const daysLeft = totalDays - today + 1;
  const remaining = limit !== null ? limit - spent : null;
  const pctSpent = limit ? (spent / limit) * 100 : 0;
  // Ritmo: cuánto "debería" llevarse gastado a esta altura del mes
  const pace = limit ? (limit * today) / totalDays : 0;

  const expenseCats = cats.filter((c) => c.kind === "expense");
  const catBudgets = expenseCats.filter((c) => c.monthlyBudget && Number(c.monthlyBudget) > 0);
  const adjusting = sp.adjust ? savings.accounts.find((a) => a.id === Number(sp.adjust)) : undefined;
  const monthName = inSentence(monthLabel(ym).split(" ")[0]);

  return (
    <>
      <PageHeader
        title={tb.title}
        subtitle={plan ? fmt(tb.subtitlePlan, { month: monthLabel(ym), currency: base }) : tb.subtitleEmpty}
        actions={
          <Link href="/budget?edit=1" scroll={false} className={plan ? "btn-ghost" : "btn-primary"}>
            <Settings2 className="size-4" /> {plan ? tb.editPlan : tb.createBudget}
          </Link>
        }
      />

      {!plan && (
        <Empty icon={<Target className="size-5" />}>
          <span className="max-w-sm">{tb.emptyIntro}</span>
          <Link href="/budget?edit=1" scroll={false} className="btn-primary mt-2 h-9">
            {tb.createBudget}
          </Link>
        </Empty>
      )}

      {plan && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Gasto del mes */}
          <section className={`rounded-2xl p-5 ${limit !== null && spent > limit ? "border border-bad/40 bg-bad/5" : "bg-ink text-bg shadow-pop"}`}>
            <div className={`flex items-center justify-between text-xs font-medium ${limit !== null && spent > limit ? "text-bad" : "text-bg/60"}`}>
              <span>{fmt(tb.spending.title, { month: monthName })}</span>
              {limit !== null && <span>{pctSpent.toFixed(0)}%</span>}
            </div>
            <div className="tabular mt-1 text-4xl font-semibold tracking-tight">{money(spent)}</div>
            {limit !== null ? (
              <>
                <div className={`mt-1 text-sm ${spent > limit ? "text-ink-2" : "text-bg/60"}`}>{fmt(tb.spending.ofLimit, { amount: money(limit) })}</div>
                <div className={`mt-4 h-2 w-full overflow-hidden rounded-full ${spent > limit ? "bg-bad/15" : "bg-bg/15"}`}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, pctSpent)}%`, background: spent > limit ? "var(--bad)" : pctSpent >= 80 ? "var(--warn)" : "var(--bg)" }}
                  />
                </div>
                <p className={`mt-3 text-sm ${spent > limit ? "text-bad" : "text-bg/80"}`}>
                  {remaining! >= 0 ? (
                    <>
                      {tb.spending.remainingBefore}
                      <strong>{money(remaining)}</strong>
                      {tb.spending.remainingAfter}
                      {fmt(tb.spending.perDay, { amount: money(remaining! / Math.max(1, daysLeft)), days: plural(daysLeft, tb.spending.days) })}
                      {spent > pace ? tb.spending.overPace : ""}
                    </>
                  ) : (
                    <>{fmt(tb.spending.exceeded, { amount: money(-remaining!) })}</>
                  )}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-bg/60">{tb.spending.noLimit}</p>
            )}
          </section>

          {/* Ahorro del mes */}
          <Card>
            <div className="flex items-center justify-between text-xs font-medium text-muted">
              <span>{fmt(tb.savings.title, { month: monthName })}</span>
              {now?.savingsMet && <Badge tone="solid">{tb.savings.goalMet}</Badge>}
            </div>
            <div className={`tabular mt-1 text-4xl font-semibold tracking-tight ${saved < 0 ? "text-bad" : ""}`}>
              {saved >= 0 ? "+" : ""}
              {money(saved)}
            </div>
            {target !== null ? (
              <>
                <div className="mt-1 text-sm text-ink-2">{fmt(tb.savings.ofTarget, { amount: money(target) })}</div>
                <div className="mt-4">
                  <Progress value={Math.max(0, saved)} max={target} />
                </div>
                <p className="mt-3 text-sm text-ink-2">
                  {saved >= target ? tb.savings.targetReached : fmt(tb.savings.toGo, { amount: money(target - Math.max(0, saved)) })}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">{tb.savings.noTarget}</p>
            )}
            <p className="mt-3 text-xs text-muted">{tb.savings.explainer}</p>
          </Card>

          {/* Rachas */}
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <IconBubble>
                  <Flame className="size-5" />
                </IconBubble>
                <div>
                  <div className="text-xs font-medium text-muted">{tb.streaks.budget}</div>
                  <div className="text-2xl font-semibold tracking-tight">{plural(budgetStreak.current, tb.streaks.months)}</div>
                </div>
              </div>
              <span className="flex items-center gap-1 text-xs text-muted">
                <Trophy className="size-3.5" /> {fmt(tb.streaks.best, { n: budgetStreak.best })}
              </span>
            </div>
            <div className="mt-5">
              <MonthStrip months={months} field="budgetMet" />
            </div>
            <p className="mt-3 text-xs text-muted">{tb.streaks.budgetHint}</p>
          </Card>
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <IconBubble>
                  <PiggyBank className="size-5" />
                </IconBubble>
                <div>
                  <div className="text-xs font-medium text-muted">{tb.streaks.savings}</div>
                  <div className="text-2xl font-semibold tracking-tight">{plural(savingsStreak.current, tb.streaks.months)}</div>
                </div>
              </div>
              <span className="flex items-center gap-1 text-xs text-muted">
                <Trophy className="size-3.5" /> {fmt(tb.streaks.best, { n: savingsStreak.best })}
              </span>
            </div>
            <div className="mt-5">
              <MonthStrip months={months} field="savingsMet" />
            </div>
            <p className="mt-3 text-xs text-muted">{tb.streaks.savingsHint}</p>
          </Card>
        </div>
      )}

      {/* Cuentas de ahorro */}
      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">{tb.savingsAccounts.title}</h2>
            <p className="mt-0.5 text-sm text-muted">
              {tb.savingsAccounts.total} <span className="tabular font-medium text-ink">{money(savings.total)}</span> · {tb.savingsAccounts.autoApply}
            </p>
          </div>
          <Link href="/accounts?new=1&savings=1&returnTo=/budget" scroll={false} className="btn-ghost h-9">
            <Plus className="size-4" /> {tb.savingsAccounts.add}
          </Link>
        </div>

        {savings.goal && (
          <Card className="mb-3">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
              <span className="flex min-w-0 items-center gap-2 font-medium">
                <Target className="size-4 shrink-0" /> <span className="truncate">{savings.goal.name}</span>
              </span>
              <span className="tabular whitespace-nowrap text-ink-2">
                {money(savings.total)} / {money(savings.goal.amount)}
              </span>
            </div>
            <div className="mt-3">
              <Progress value={Math.max(0, savings.total)} max={savings.goal.amount} />
            </div>
            <p className="mt-2 text-xs text-muted">
              {savings.total >= savings.goal.amount
                ? tb.savingsAccounts.goalReached
                : fmt(tb.savingsAccounts.goalProgress, {
                    pct: ((Math.max(0, savings.total) / savings.goal.amount) * 100).toFixed(0),
                    amount: money(savings.goal.amount - Math.max(0, savings.total)),
                  })}
            </p>
          </Card>
        )}

        {savings.accounts.length === 0 ? (
          <Empty icon={<PiggyBank className="size-5" />}>
            {tb.savingsAccounts.empty}
          </Empty>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {savings.accounts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                <IconBubble>
                  <PiggyBank className="size-4.5" />
                </IconBubble>
                <Link href={`/transactions?month=all&accountId=${a.id}`} className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{a.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {[a.institution, a.identifiers.length ? `•••• ${a.identifiers.join(", ")}` : null].filter(Boolean).join(" · ") || tb.savingsAccounts.noDigits}
                  </span>
                </Link>
                <span className="tabular shrink-0 text-right">
                  <span className={`block text-[15px] font-semibold ${a.balance < 0 ? "text-bad" : ""}`}>{money(a.balance, a.currency)}</span>
                  {a.currency !== base && a.rate !== null && <span className="block text-xs text-muted">≈ {money(a.balance * a.rate)}</span>}
                </span>
                <div className="flex w-full gap-1.5 sm:w-auto">
                  <Link
                    href={`/transactions?new=1&ntype=income&naccount=${a.id}&ndesc=${encodeURIComponent(tb.savingsAccounts.depositDescription)}&back=/budget`}
                    scroll={false}
                    className="btn-subtle h-8 flex-1 px-3 text-xs sm:flex-none"
                  >
                    <ArrowDownToLine className="size-3.5" /> {tb.savingsAccounts.deposit}
                  </Link>
                  <Link
                    href={`/transactions?new=1&ntype=expense&naccount=${a.id}&ndesc=${encodeURIComponent(tb.savingsAccounts.withdrawDescription)}&back=/budget`}
                    scroll={false}
                    className="btn-subtle h-8 flex-1 px-3 text-xs sm:flex-none"
                  >
                    <ArrowUpFromLine className="size-3.5" /> {tb.savingsAccounts.withdraw}
                  </Link>
                  <Link href={`/budget?adjust=${a.id}`} scroll={false} className="btn-subtle h-8 flex-1 px-3 text-xs sm:flex-none" title={tb.savingsAccounts.adjustTitle}>
                    <Scale className="size-3.5" /> {tb.savingsAccounts.adjust}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Por categoría */}
      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">{tb.byCategory.title}</h2>
            <p className="mt-0.5 text-sm text-muted">{tb.byCategory.subtitle}</p>
          </div>
          <span className="flex gap-4">
            <Link href="/categories" className="text-xs font-medium text-ink-2 hover:text-ink">
              {t.common.nav.categories}
            </Link>
            <Link href="/budget?edit=1" scroll={false} className="text-xs font-medium text-ink-2 hover:text-ink">
              {tb.byCategory.editLimits}
            </Link>
          </span>
        </div>
        {catBudgets.length === 0 ? (
          <Empty>{tb.byCategory.empty}</Empty>
        ) : (
          <Card>
            <div className="space-y-1">
              {catBudgets.map((c) => {
                const b = Number(c.monthlyBudget);
                const s = spentByCat.find((x) => x.id === c.id)?.total ?? 0;
                return (
                  <HBar
                    key={c.id}
                    label={
                      <span className="flex items-center gap-2">
                        <CategoryIcon name={c.icon} className="size-4 text-ink-2" />
                        {c.name}
                      </span>
                    }
                    value={s}
                    max={b}
                    display={`${money(s)} / ${money(b)}`}
                    tone={s > b ? "bad" : "ink"}
                    href={`/transactions?month=${ym}&categoryId=${c.id}`}
                  />
                );
              })}
            </div>
          </Card>
        )}
      </section>

      {sp.edit && (
        <Sheet title={tb.planForm.title} description={fmt(tb.planForm.description, { month: inSentence(monthLabel(ym)), currency: base })} closeHref="/budget">
          <ActionForm action={saveBudgetPlan} messages="manual" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={tb.planForm.monthlyLimit} htmlFor="monthlyLimit" hint={tb.planForm.monthlyLimitHint}>
                <input id="monthlyLimit" name="monthlyLimit" inputMode="decimal" defaultValue={plan?.monthlyLimit ?? ""} placeholder={tb.planForm.monthlyLimitPlaceholder} className="input tabular" autoFocus />
              </Field>
              <Field label={tb.planForm.savingsTarget} htmlFor="savingsTarget" hint={tb.planForm.savingsTargetHint}>
                <input id="savingsTarget" name="savingsTarget" inputMode="decimal" defaultValue={plan?.savingsTarget ?? ""} placeholder={tb.planForm.savingsTargetPlaceholder} className="input tabular" />
              </Field>
            </div>

            <fieldset className="space-y-3">
              <legend className="label">{tb.planForm.goal}</legend>
              <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
                <input name="goalName" defaultValue={savings.goal?.name ?? ""} placeholder={tb.planForm.goalNamePlaceholder} className="input" aria-label={tb.planForm.goalNameLabel} />
                <input name="goalAmount" inputMode="decimal" defaultValue={savings.goal?.amount ?? ""} placeholder={tb.planForm.goalAmountPlaceholder} className="input tabular" aria-label={tb.planForm.goalAmountLabel} />
              </div>
              <p className="hint">{tb.planForm.goalHint}</p>
            </fieldset>

            <fieldset>
              <legend className="label">{tb.planForm.categoryLimits}</legend>
              <ul className="card mt-2 divide-y divide-line shadow-none">
                {expenseCats.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                    <IconBubble size="sm">
                      <CategoryIcon name={c.icon} className="size-3.5" />
                    </IconBubble>
                    <label htmlFor={`cat_${c.id}`} className="min-w-0 flex-1 truncate text-sm">
                      {c.name}
                    </label>
                    <input
                      id={`cat_${c.id}`}
                      name={`cat_${c.id}`}
                      inputMode="decimal"
                      defaultValue={c.monthlyBudget ?? ""}
                      placeholder="—"
                      className="input tabular h-9 w-28 text-right text-sm"
                    />
                  </li>
                ))}
              </ul>
            </fieldset>

            <FormMessages />
            <SheetFooter>
              <SubmitButton className="btn-primary ml-auto h-11 flex-1 sm:flex-none sm:px-8">{tb.planForm.submit}</SubmitButton>
            </SheetFooter>
          </ActionForm>
        </Sheet>
      )}

      {adjusting && (
        <Sheet title={fmt(tb.adjustForm.title, { name: adjusting.name })} description={tb.adjustForm.description} closeHref="/budget">
          <ActionForm action={adjustAccountBalance} messages="manual" className="space-y-5">
            <input type="hidden" name="id" value={adjusting.id} />
            <div className="rounded-2xl bg-surface-2 p-4 text-sm">
              {tb.adjustForm.computed} <span className="tabular font-semibold">{money(adjusting.balance, adjusting.currency)}</span>
            </div>
            <Field label={fmt(tb.adjustForm.realBalance, { currency: adjusting.currency })} htmlFor="balance" hint={tb.adjustForm.realBalanceHint}>
              <input id="balance" name="balance" inputMode="decimal" required defaultValue={adjusting.balance.toFixed(2)} className="input tabular text-lg" autoFocus />
            </Field>
            <FormMessages />
            <SheetFooter>
              <SubmitButton className="btn-primary ml-auto h-11 flex-1 sm:flex-none sm:px-8">{tb.adjustForm.submit}</SubmitButton>
            </SheetFooter>
          </ActionForm>
        </Sheet>
      )}
    </>
  );
}
