import { ChevronRight, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { autoCategorize, deleteCategory, saveCategory } from "@/actions/categories";
import { ActionForm, FormMessages, SubmitButton } from "@/components/action-form";
import { ConfirmButton } from "@/components/confirm-button";
import { Field, IconPicker, Segmented, TagInput } from "@/components/form/controls";
import { Sheet, SheetFooter } from "@/components/form/sheet";
import { IconBubble, PageHeader } from "@/components/ui";
import { requireAuth } from "@/lib/auth";
import { currentMonth, money } from "@/lib/format";
import { allCategories, spendingByCategory } from "@/lib/queries";
import { appSettings } from "@/lib/settings";
import { CategoryIcon } from "@/components/category-icon";
import { fmt, getT } from "@/i18n/server";

type SP = Promise<{ edit?: string; new?: string; kind?: string }>;

export default async function CategoriesPage({ searchParams }: { searchParams: SP }) {
  await requireAuth();
  const t = getT();
  const tc = t.categories;
  const sp = await searchParams;
  const [cats, spent] = await Promise.all([allCategories(), spendingByCategory(currentMonth(), {})]);
  const base = appSettings().baseCurrency;
  const editing = sp.edit ? cats.find((c) => c.id === Number(sp.edit)) : undefined;
  const showForm = Boolean(editing || sp.new);

  const groups = [
    { kind: "expense", title: tc.groups.expense },
    { kind: "income", title: tc.groups.income },
  ] as const;

  return (
    <>
      <PageHeader
        title={tc.title}
        subtitle={tc.subtitle}
        actions={
          <>
            <ActionForm action={autoCategorize} className="flex flex-col items-end">
              <SubmitButton className="btn-ghost" pendingText={tc.recategorizing}>
                <Sparkles className="size-4" /> {tc.recategorize}
              </SubmitButton>
            </ActionForm>
            <Link href="/categories?new=1" scroll={false} className="btn-primary">
              <Plus className="size-4" /> {tc.newShort}
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {groups.map((g) => {
          const list = cats.filter((c) => c.kind === g.kind);
          return (
            <section key={g.kind} className="min-w-0">
              <div className="mb-2 flex items-center justify-between px-1">
                <h3 className="text-xs font-medium tracking-wide text-muted uppercase">{g.title}</h3>
                <Link href={`/categories?new=1&kind=${g.kind}`} scroll={false} className="text-xs font-medium text-ink-2 hover:text-ink">
                  {tc.addInGroup}
                </Link>
              </div>
              <ul className="card divide-y divide-line overflow-hidden">
                {list.map((c) => {
                  const s = spent.find((x) => x.id === c.id)?.total ?? 0;
                  const budget = c.monthlyBudget ? Number(c.monthlyBudget) : null;
                  const pct = budget ? Math.min(100, (s / budget) * 100) : null;
                  return (
                    <li key={c.id}>
                      <Link href={`/categories?edit=${c.id}`} scroll={false} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2/50">
                        <IconBubble>
                          <CategoryIcon name={c.icon} className="size-4.5" />
                        </IconBubble>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-medium">{c.name}</span>
                          {pct !== null ? (
                            <span className="mt-1.5 block h-1 w-full max-w-40 overflow-hidden rounded-full bg-surface-2">
                              <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? "var(--bad)" : "var(--ink)" }} />
                            </span>
                          ) : (
                            <span className="block truncate text-xs text-muted">{c.keywords.length ? c.keywords.join(", ") : tc.noKeywords}</span>
                          )}
                        </span>
                        {g.kind === "expense" && (
                          <span className="tabular shrink-0 text-right text-sm">
                            <span className="block font-medium">{money(s)}</span>
                            {budget !== null && <span className="block text-xs text-muted">{fmt(tc.ofBudget, { amount: money(budget) })}</span>}
                          </span>
                        )}
                        <ChevronRight className="size-4 shrink-0 text-muted" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {showForm && (
        <Sheet title={editing ? editing.name : tc.form.newTitle} closeHref="/categories">
          <ActionForm action={saveCategory} messages="manual" className="space-y-5">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <input type="hidden" name="color" value={editing?.color ?? "#0a0a0a"} />
            <Field label={tc.form.name}>
              <div className="flex gap-2">
                <IconPicker name="icon" defaultValue={editing?.icon} />
                <input name="name" required defaultValue={editing?.name} placeholder={tc.form.namePlaceholder} className="input flex-1" autoFocus={!editing} aria-label={tc.form.name} />
              </div>
            </Field>
            <Field label={tc.form.type}>
              <Segmented
                name="kind"
                defaultValue={editing?.kind ?? (sp.kind === "income" ? "income" : "expense")}
                options={[
                  { value: "expense", label: t.common.txTypes.expense },
                  { value: "income", label: t.common.txTypes.income },
                ]}
              />
            </Field>
            <Field label={tc.form.keywords} hint={tc.form.keywordsHint}>
              <TagInput name="keywords" defaultValue={editing?.keywords ?? []} placeholder={tc.form.keywordsPlaceholder} />
            </Field>
            <Field label={fmt(tc.form.monthlyBudget, { currency: base })} htmlFor="monthlyBudget" hint={tc.form.monthlyBudgetHint}>
              <input id="monthlyBudget" name="monthlyBudget" inputMode="decimal" defaultValue={editing?.monthlyBudget ?? ""} placeholder={tc.form.noBudget} className="input tabular" />
            </Field>
            <FormMessages />
            <SheetFooter>
              {editing && (
                <ConfirmButton form="delete-category" confirmLabel={tc.form.confirmDelete}>
                  {t.common.actions.delete}
                </ConfirmButton>
              )}
              <SubmitButton className="btn-primary ml-auto h-11 flex-1 sm:flex-none sm:px-8">{editing ? t.common.actions.save : tc.form.create}</SubmitButton>
            </SheetFooter>
          </ActionForm>
          {editing && (
            <form id="delete-category" action={deleteCategory}>
              <input type="hidden" name="id" value={editing.id} />
            </form>
          )}
        </Sheet>
      )}
    </>
  );
}
