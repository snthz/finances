import { and, eq } from "drizzle-orm";
import { ArrowLeftRight, Mail, Plus, Search, StickyNote } from "lucide-react";
import Link from "next/link";
import { setTransactionCategory } from "@/actions/transactions";
import { Select } from "@/components/form/select";
import { Sheet } from "@/components/form/sheet";
import { MonthNav } from "@/components/month-nav";
import { TransactionForm, type TxInitial } from "@/components/transaction-form";
import { Badge, Empty, IconBubble, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { uid } from "@/lib/context";
import { formatDate, money, toLocalYmd } from "@/lib/format";
import { openPaymentsForLinking } from "@/lib/payment-matching";
import { allAccounts, allCategories, getCurrencies, listTransactions, type TxFilters } from "@/lib/queries";
import { appSettings } from "@/lib/settings";
import { CategoryIcon } from "@/components/category-icon";
import { fmt, getT, plural } from "@/i18n/server";

type SP = Promise<Record<string, string | undefined>>;

function idOrNone(v?: string): number | "none" | undefined {
  if (v === "none") return "none";
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export default async function TransactionsPage({ searchParams }: { searchParams: SP }) {
  await requireAuth();
  const t = getT();
  const tt = t.transactions;
  const sp = await searchParams;
  const allTime = sp.month === "all";
  const todayYmd = toLocalYmd(new Date());
  const yesterdayYmd = toLocalYmd(new Date(Date.now() - 86_400_000));
  const month = allTime ? undefined : /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month : todayYmd.slice(0, 7);
  const filters: TxFilters = {
    month,
    accountId: idOrNone(sp.accountId),
    categoryId: idOrNone(sp.categoryId),
    type: ["expense", "income", "transfer"].includes(sp.type ?? "") ? (sp.type as TxFilters["type"]) : undefined,
    q: sp.q?.trim() || undefined,
    currency: sp.currency || undefined,
    page: Number(sp.page) || 1,
  };

  const [result, accountList, categoryList, currencies, openPayments] = await Promise.all([
    listTransactions(filters),
    allAccounts(),
    allCategories(),
    getCurrencies(),
    sp.edit || sp.new ? openPaymentsForLinking() : Promise.resolve([]),
  ]);

  // Query string actual (sin edit/new) para volver aquí tras guardar o cerrar
  const keep = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v && !["edit", "new", "ntype", "naccount", "ndesc", "back"].includes(k)) keep.set(k, v);
  // `back`: volver a otra página (ej. Presupuesto) al guardar o cerrar
  const here = sp.back && /^\/(?![/\\])/.test(sp.back) ? sp.back : `/transactions${keep.size ? `?${keep}` : ""}`;
  const withParam = (k: string, v: string) => {
    const p = new URLSearchParams(keep);
    p.set(k, v);
    return `/transactions?${p}`;
  };

  let formInitial: TxInitial | null = null;
  const editId = Number(sp.edit);
  if (sp.edit && Number.isInteger(editId) && editId > 0) {
    const [tx] = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, editId), eq(transactions.userId, uid())));
    if (tx) {
      formInitial = {
        id: tx.id,
        type: tx.type,
        date: toLocalYmd(tx.date),
        amount: tx.amount,
        currency: tx.currency,
        merchant: tx.merchant ?? "",
        description: tx.description ?? "",
        notes: tx.notes ?? "",
        accountId: tx.accountId,
        toAccountId: tx.toAccountId,
        categoryId: tx.categoryId,
        source: tx.source,
        detectedIdentifier: tx.detectedIdentifier,
        scheduledPaymentId: tx.scheduledPaymentId,
      };
    }
  } else if (sp.new) {
    // Datos precargados opcionales: ?ntype=income&naccount=3&ndesc=Depósito
    const preAccount = sp.naccount ? accountList.find((a) => a.id === Number(sp.naccount)) : undefined;
    formInitial = {
      type: sp.ntype === "income" || sp.ntype === "transfer" ? sp.ntype : "expense",
      date: todayYmd,
      amount: "",
      currency: preAccount?.currency ?? appSettings().baseCurrency,
      merchant: "",
      description: sp.ndesc?.slice(0, 100) ?? "",
      notes: "",
      accountId: preAccount?.id ?? null,
      toAccountId: null,
      categoryId: null,
    };
  }

  const hasFilters = Boolean(filters.accountId || filters.categoryId || filters.type || filters.q || filters.currency);

  // Agrupa por día local
  const groups: { day: string; items: typeof result.rows; net: number }[] = [];
  for (const row of result.rows) {
    const day = toLocalYmd(row.tx.date);
    let g = groups.at(-1);
    if (!g || g.day !== day) groups.push((g = { day, items: [], net: 0 }));
    g.items.push(row);
  }
  const dayLabel = (d: string) => {
    if (d === todayYmd) return tt.list.today;
    if (d === yesterdayYmd) return tt.list.yesterday;
    const s = formatDate(`${d}T12:00:00Z`, { weekday: "long", day: "numeric", month: "long", ...(allTime ? { year: "numeric" } : {}) });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const accountOptions = [
    { value: "", label: tt.filters.allAccounts },
    { value: "none", label: tt.filters.noAccount },
    ...accountList.map((a) => ({ value: String(a.id), label: a.name, hint: a.identifiers.length ? `•••• ${a.identifiers.join(", ")}` : undefined })),
  ];
  const categoryOptions = [
    { value: "", label: tt.filters.allCategories },
    { value: "none", label: tt.noCategory },
    ...categoryList.map((c) => ({ value: String(c.id), label: c.name, icon: <CategoryIcon name={c.icon} /> })),
  ];

  return (
    <>
      <PageHeader
        title={tt.title}
        subtitle={
          <span className="tabular">
            {plural(result.total, tt.count)} · +{money(result.income, result.totalsCurrency)} · −{money(result.expense, result.totalsCurrency)}
            {!filters.currency && currencies.length > 1 && <span className="text-muted"> · {fmt(tt.inCurrency, { currency: result.totalsCurrency })}</span>}
          </span>
        }
        actions={
          <>
            {allTime ? (
              <Link href={withParam("month", todayYmd.slice(0, 7))} className="btn-ghost">
                {tt.byMonth}
              </Link>
            ) : (
              <>
                <MonthNav month={month!} basePath="/transactions" params={sp} />
                <Link href={withParam("month", "all")} className="btn-ghost">
                  {tt.allTime}
                </Link>
              </>
            )}
            <Link href={withParam("new", "1")} className="btn-primary hidden md:inline-flex">
              <Plus className="size-4" /> {t.common.nav.newShort}
            </Link>
          </>
        }
      />

      {/* Filtros */}
      <form className="mb-5 space-y-3" action="/transactions">
        {sp.month && <input type="hidden" name="month" value={sp.month} />}
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={sp.q} placeholder={tt.filters.searchPlaceholder} className="input pl-10" />
        </label>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
          <Select name="accountId" variant="chip" autoSubmit defaultValue={sp.accountId ?? ""} options={accountOptions} ariaLabel={tt.filters.account} />
          <Select name="categoryId" variant="chip" autoSubmit defaultValue={sp.categoryId ?? ""} options={categoryOptions} ariaLabel={tt.filters.category} />
          <Select
            name="type"
            variant="chip"
            autoSubmit
            defaultValue={sp.type ?? ""}
            ariaLabel={tt.filters.type}
            options={[
              { value: "", label: tt.filters.allTypes },
              { value: "expense", label: tt.filters.expenses },
              { value: "income", label: tt.filters.incomes },
              { value: "transfer", label: tt.filters.transfers },
            ]}
          />
          {currencies.length > 1 && (
            <Select
              name="currency"
              variant="chip"
              autoSubmit
              defaultValue={sp.currency ?? ""}
              ariaLabel={tt.filters.currency}
              options={[{ value: "", label: tt.filters.allCurrencies }, ...currencies.map((c) => ({ value: c, label: c }))]}
            />
          )}
          {hasFilters && (
            <Link href={`/transactions${sp.month ? `?month=${sp.month}` : ""}`} className="chip border-transparent text-ink-2">
              {tt.filters.clear}
            </Link>
          )}
        </div>
      </form>

      {groups.length === 0 ? (
        <Empty icon={<Search className="size-5" />}>{tt.list.empty}</Empty>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.day} className="min-w-0">
              <h3 className="mb-2 px-1 text-xs font-medium tracking-wide text-muted uppercase">{dayLabel(g.day)}</h3>
              <ul className="card divide-y divide-line overflow-hidden">
                {g.items.map(({ tx, accountName, toAccountName, categoryName, categoryIcon }) => (
                  <li key={tx.id} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2/50">
                    <IconBubble>{tx.type === "transfer" ? <ArrowLeftRight className="size-4" /> : <CategoryIcon name={categoryIcon} className="size-4.5" />}</IconBubble>
                    <Link href={withParam("edit", String(tx.id))} scroll={false} className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-medium">{tx.merchant || tx.description || tt.noDescription}</div>
                      <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted">
                        <span className="truncate">
                          {tx.type === "transfer"
                            ? `${accountName ?? (toAccountName ? tt.form.externalSource : "?")} → ${toAccountName ?? "?"}`
                            : [categoryName, accountName].filter(Boolean).join(" · ") || "—"}
                        </span>
                        {!accountName && tx.detectedIdentifier && tx.type !== "transfer" && <Badge tone="warn">•••• {tx.detectedIdentifier}</Badge>}
                        {tx.source === "email" && <Mail className="size-3 shrink-0" aria-label={tt.list.importedFromEmail} />}
                        {tx.notes && <StickyNote className="size-3 shrink-0" aria-label={tt.list.hasNote} />}
                      </div>
                    </Link>
                    {tx.type !== "transfer" && !tx.categoryId && (
                      <form action={setTransactionCategory} className="hidden sm:block">
                        <input type="hidden" name="id" value={tx.id} />
                        <Select
                          name="categoryId"
                          variant="chip"
                          autoSubmit
                          placeholder={tt.list.categorize}
                          ariaLabel={tt.list.assignCategory}
                          options={categoryList.filter((c) => c.kind === tx.type).map((c) => ({ value: String(c.id), label: c.name, icon: <CategoryIcon name={c.icon} /> }))}
                        />
                      </form>
                    )}
                    <div className={`tabular shrink-0 text-right text-[15px] font-semibold ${tx.type === "transfer" ? "text-muted" : tx.type === "income" ? "" : "text-ink"}`}>
                      {tx.type === "income" ? "+" : tx.type === "expense" ? "−" : ""}
                      {money(tx.amount, tx.currency)}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {result.pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm">
          {result.page > 1 && (
            <Link className="btn-ghost" href={withParam("page", String(result.page - 1))}>
              {tt.list.previous}
            </Link>
          )}
          <span className="px-2 text-muted">
            {result.page} / {result.pages}
          </span>
          {result.page < result.pages && (
            <Link className="btn-ghost" href={withParam("page", String(result.page + 1))}>
              {tt.list.next}
            </Link>
          )}
        </div>
      )}

      {formInitial && (
        <Sheet title={formInitial.id ? tt.sheet.editTitle : tt.sheet.newTitle} closeHref={here}>
          <TransactionForm
            initial={formInitial}
            accounts={accountList.map((a) => ({ id: a.id, name: a.name, currency: a.currency, archived: a.archived, identifiers: a.identifiers, type: a.type }))}
            categories={categoryList.map((c) => ({ id: c.id, name: c.name, kind: c.kind, icon: c.icon }))}
            currencies={appSettings().currencies.map((c) => ({ code: c.code, symbol: c.symbol, name: c.name }))}
            returnTo={here}
            today={todayYmd}
            yesterday={yesterdayYmd}
            payments={openPayments}
          />
        </Sheet>
      )}
    </>
  );
}
