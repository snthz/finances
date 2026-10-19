import { and, asc, desc, eq, sql } from "drizzle-orm";
import { ChevronRight, CircleAlert, Inbox as InboxIcon, Mail, Plus, Sparkles, Wand2 } from "lucide-react";
import Link from "next/link";
import { deleteRule, runReprocess } from "@/actions/email";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { EmailMessageActions } from "@/components/email-message-actions";
import { EmailSyncControls } from "@/components/email-sync";
import { Sheet } from "@/components/form/sheet";
import { RuleEditor, type RuleInitial } from "@/components/rule-editor";
import { Badge, Empty, Notice, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { emailAccounts, emailMessages, emailRules, transactions } from "@/db/schema";
import { initScope, requireAuth } from "@/lib/auth";
import { uid } from "@/lib/context";
import { aiConfigured } from "@/lib/ai";
import { extract } from "@/lib/email/parser";
import { getWatcherStatus } from "@/lib/email/sync";
import { formatDateTime, money, toLocalYmd } from "@/lib/format";
import { fmt, getT } from "@/i18n/server";
import { allAccounts, allCategories } from "@/lib/queries";
import { appSettings } from "@/lib/settings";

type SP = Promise<{ tab?: string; status?: string; edit?: string; new?: string; from?: string; view?: string }>;

// Las etiquetas salen de t.email.status[clave]
const STATUS = {
  parsed: { tone: "solid" },
  unmatched: { tone: "warn" },
  ignored: { tone: "neutral" },
  error: { tone: "bad" },
  duplicate: { tone: "outline" },
} as const;

export async function generateMetadata() {
  await initScope();
  return { title: getT().email.metaTitle };
}

/** Cuerpo para leer: sin las URLs de imágenes ("[https://…/logo.jpg]") ni espacios de más. */
function readableBody(body: string) {
  return body
    .replace(/\[(?:https?:\/\/|cid:)[^\]\s]*\]/g, " ")
    .replace(/https?:\/\/\S+\.(?:png|jpe?g|gif|webp)\S*/gi, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default async function EmailPage({ searchParams }: { searchParams: SP }) {
  await requireAuth();
  const t = getT();
  const sp = await searchParams;
  const tab = sp.tab === "rules" ? "rules" : "inbox";
  const accs = appSettings().emailAccounts;
  const [counts] = await db
    .select({
      parsed: sql<number>`count(*) filter (where status = 'parsed')::int`,
      unmatched: sql<number>`count(*) filter (where status = 'unmatched')::int`,
      ignored: sql<number>`count(*) filter (where status = 'ignored')::int`,
      error: sql<number>`count(*) filter (where status = 'error')::int`,
      duplicate: sql<number>`count(*) filter (where status = 'duplicate')::int`,
    })
    .from(emailMessages)
    .where(eq(emailMessages.userId, uid()));
  const pending = counts.unmatched + counts.error;

  return (
    <>
      <PageHeader
        title={t.email.title}
        subtitle={t.email.subtitle}
        actions={
          accs.length > 0 && <EmailSyncControls accounts={accs.filter((a) => a.enabled).map(({ id, label }) => ({ id, label }))} today={toLocalYmd(new Date())} />
        }
      />

      {/* Estado de las cuentas conectadas */}
      {accs.length === 0 ? (
        <Notice tone="neutral">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{t.email.noAccounts}</span>
            <Link href="/settings?tab=correos&new=1" className="btn-primary h-9">
              {t.email.connectGmail}
            </Link>
          </div>
        </Notice>
      ) : (
        <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          {accs.map((a) => {
            const st = a.enabled ? getWatcherStatus(a.id) : { state: "off" as const };
            return (
              <Link key={a.id} href={`/settings?tab=correos&edit=${a.id}`} className="chip h-10 shrink-0 gap-2 pr-4" title={st.state === "error" ? st.message : undefined}>
                <span
                  className={`size-2 rounded-full ${st.state === "watching" ? "bg-ink" : st.state === "error" ? "bg-bad" : st.state === "connecting" ? "animate-pulse bg-muted" : "border border-muted"}`}
                />
                <span className="font-medium">{a.label}</span>
                <span className="text-muted">
                  {!a.enabled
                    ? t.email.watcher.paused
                    : st.state === "watching"
                      ? t.email.watcher.live
                      : st.state === "error"
                        ? t.email.watcher.error
                        : st.state === "connecting"
                          ? t.email.watcher.connecting
                          : t.email.watcher.periodic}
                </span>
              </Link>
            );
          })}
          <Link href="/settings?tab=correos&new=1" className="chip h-10 shrink-0 border-dashed text-ink-2">
            <Plus className="size-4" /> {t.email.otherEmail}
          </Link>
        </div>
      )}

      <div className="mb-5 grid max-w-xs grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
        {[
          { id: "inbox", label: t.email.tabs.inbox, badge: pending },
          { id: "rules", label: t.email.tabs.rules, badge: 0 },
        ].map((tb) => (
          <Link
            key={tb.id}
            href={`/email?tab=${tb.id}`}
            className={`flex h-9 items-center justify-center gap-1.5 rounded-[10px] text-sm font-medium transition ${
              tab === tb.id ? "bg-surface text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-ink-2"
            }`}
          >
            {tb.label}
            {tb.badge > 0 && <span className="rounded-full bg-warn/15 px-1.5 text-[11px] text-warn">{tb.badge}</span>}
          </Link>
        ))}
      </div>

      {tab === "inbox" ? <Inbox sp={sp} counts={counts} /> : <Rules sp={sp} />}
    </>
  );
}

async function Inbox({ sp, counts }: { sp: Awaited<SP>; counts: Record<keyof typeof STATUS, number> }) {
  const t = getT();
  const status = sp.status && sp.status in STATUS ? (sp.status as keyof typeof STATUS) : undefined;
  const rows = await db
    .select({
      m: emailMessages,
      ruleName: emailRules.name,
      accountLabel: emailAccounts.label,
      txId: transactions.id,
      txAmount: transactions.amount,
      txCurrency: transactions.currency,
      txType: transactions.type,
    })
    .from(emailMessages)
    .leftJoin(emailRules, and(eq(emailRules.id, emailMessages.ruleId), eq(emailRules.userId, emailMessages.userId)))
    .leftJoin(emailAccounts, and(eq(emailAccounts.id, emailMessages.emailAccountId), eq(emailAccounts.userId, emailMessages.userId)))
    .leftJoin(transactions, and(eq(transactions.emailMessageId, emailMessages.id), eq(transactions.userId, emailMessages.userId)))
    .where(and(eq(emailMessages.userId, uid()), status ? eq(emailMessages.status, status) : undefined))
    .orderBy(desc(emailMessages.receivedAt))
    .limit(100);
  const viewing = sp.view ? rows.find((r) => r.m.id === Number(sp.view)) : undefined;
  // Lo que la regla asignada logra leer del correo, para ver qué falta cuando falla
  const viewingRule = viewing?.m.ruleId
    ? await db.query.emailRules.findFirst({ where: and(eq(emailRules.id, viewing.m.ruleId), eq(emailRules.userId, uid())) })
    : undefined;
  const detected =
    viewing && viewingRule && !viewingRule.ignore
      ? extract(viewingRule, { from: viewing.m.fromAddress ?? "", subject: viewing.m.subject ?? "", body: viewing.m.body ?? "" }, appSettings().currencies)
      : null;
  const listHref = `/email${status ? `?status=${status}` : ""}`;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0">
          <Link href="/email" className={`chip h-8 shrink-0 ${!status ? "border-ink bg-ink text-bg hover:bg-ink" : ""}`}>
            {t.email.inbox.all}
          </Link>
          {(Object.keys(STATUS) as (keyof typeof STATUS)[]).map((s) => (
            <Link key={s} href={`/email?status=${s}`} className={`chip h-8 shrink-0 ${status === s ? "border-ink bg-ink text-bg hover:bg-ink" : ""}`}>
              {t.email.status[s]} <span className="opacity-60">{counts[s]}</span>
            </Link>
          ))}
        </div>
        {counts.unmatched + counts.error > 0 && (
          <ActionForm action={runReprocess} className="flex max-w-md flex-col items-end">
            <SubmitButton className="btn-subtle h-9 text-xs" pendingText={t.email.inbox.reprocessing}>
              <Wand2 className="size-3.5" /> {t.email.inbox.reprocess}
            </SubmitButton>
          </ActionForm>
        )}
      </div>

      {rows.length === 0 ? (
        <Empty icon={<InboxIcon className="size-5" />}>{t.email.inbox.empty}</Empty>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {rows.map(({ m, ruleName, accountLabel, txId, txAmount, txCurrency, txType }) => (
            <li key={m.id}>
              <Link href={`/email?view=${m.id}${status ? `&status=${status}` : ""}`} scroll={false} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2/50">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2">
                  <Mail className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-medium">{m.subject || t.email.inbox.noSubject}</span>
                    {m.status !== "parsed" && <Badge tone={STATUS[m.status].tone}>{t.email.status[m.status]}</Badge>}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {formatDateTime(m.receivedAt)} · {m.fromAddress?.replace(/<.*>/, "").trim() || m.fromAddress}
                    {accountLabel && ` · ${accountLabel}`}
                    {ruleName && ` · ${ruleName}`}
                  </span>
                  {m.error && <span className="block truncate text-xs text-bad">{m.error}</span>}
                </span>
                {txId && (
                  <span className="tabular shrink-0 text-right text-[15px] font-semibold">
                    {txType === "income" ? "+" : txType === "expense" ? "−" : ""}
                    {money(txAmount, txCurrency ?? undefined)}
                  </span>
                )}
                <ChevronRight className="size-4 shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {viewing && (
        <Sheet title={viewing.m.subject || t.email.inbox.noSubject} description={`${viewing.m.fromAddress} · ${formatDateTime(viewing.m.receivedAt)}`} closeHref={listHref} size="lg">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone={STATUS[viewing.m.status].tone}>{t.email.status[viewing.m.status]}</Badge>
              {viewing.accountLabel && <Badge tone="outline">{viewing.accountLabel}</Badge>}
              {viewing.ruleName && <span className="text-muted">{fmt(t.email.inbox.rule, { name: viewing.ruleName })}</span>}
            </div>
            {viewing.m.error && (
              <div className="flex gap-3 rounded-2xl border border-bad/25 bg-bad/5 p-4">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-bad" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-bad">{viewing.m.error}</p>
                  {!viewing.txId && <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{t.email.inbox.failedHint}</p>}
                </div>
              </div>
            )}
            {viewing.txId && (
              <Link href={`/transactions?month=all&edit=${viewing.txId}`} className="card flex items-center justify-between gap-3 p-4 shadow-none">
                <span className="text-sm text-ink-2">{fmt(t.email.inbox.txCreated, { type: viewing.txType ? t.common.txTypes[viewing.txType] : t.email.inbox.transaction })}</span>
                <span className="tabular flex items-center gap-1 text-lg font-semibold">
                  {money(viewing.txAmount, viewing.txCurrency ?? undefined)} <ChevronRight className="size-4 text-muted" />
                </span>
              </Link>
            )}
            {detected && !viewing.txId && (
              <section>
                <h3 className="mb-2 px-1 text-xs font-medium tracking-wide text-muted uppercase">{t.email.inbox.detected}</h3>
                <dl className="card grid grid-cols-2 gap-px overflow-hidden bg-line shadow-none sm:grid-cols-4">
                  {[
                    { label: t.email.inbox.fields.amount, value: detected.amount === null ? null : detected.currency ? money(detected.amount, detected.currency) : String(detected.amount), required: true },
                    { label: t.email.inbox.fields.merchant, value: detected.merchant },
                    { label: t.email.inbox.fields.card, value: detected.identifier && `•••• ${detected.identifier}` },
                    { label: t.email.inbox.fields.date, value: detected.date && `${detected.date.ymd}${detected.date.time ? ` ${detected.date.time}` : ""}` },
                  ].map((f) => (
                    <div key={f.label} className="min-w-0 bg-surface px-4 py-3">
                      <dt className="text-xs text-muted">{f.label}</dt>
                      <dd className={`mt-0.5 truncate text-sm font-medium ${f.value ? "tabular" : f.required ? "text-bad" : "text-muted"}`}>{f.value || t.email.inbox.missing}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
            <section>
              <h3 className="mb-2 px-1 text-xs font-medium tracking-wide text-muted uppercase">{t.email.inbox.content}</h3>
              <div className="max-h-[45dvh] overflow-auto rounded-2xl bg-surface-2 p-4 text-sm leading-relaxed whitespace-pre-wrap text-ink-2">{readableBody(viewing.m.body ?? "")}</div>
              <details className="group mt-2">
                <summary className="flex cursor-pointer list-none items-center gap-1 px-1 text-xs font-medium text-muted hover:text-ink">
                  <ChevronRight className="size-3.5 transition group-open:rotate-90" /> {t.email.inbox.showOriginal}
                </summary>
                <pre className="mt-2 max-h-[40dvh] overflow-auto rounded-2xl bg-surface-2 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">{viewing.m.body}</pre>
              </details>
            </section>
            {!viewing.txId && (
              <EmailMessageActions id={viewing.m.id} canRetry={viewing.m.status === "error" || viewing.m.status === "unmatched"} aiEnabled={aiConfigured()} />
            )}
          </div>
        </Sheet>
      )}
    </>
  );
}

async function Rules({ sp }: { sp: Awaited<SP> }) {
  const t = getT();
  const [rules, accountList, categoryList, recent] = await Promise.all([
    db.select().from(emailRules).where(eq(emailRules.userId, uid())).orderBy(asc(emailRules.priority), asc(emailRules.id)),
    allAccounts(),
    allCategories(),
    db
      .select({ id: emailMessages.id, subject: emailMessages.subject, from: emailMessages.fromAddress })
      .from(emailMessages)
      .where(eq(emailMessages.userId, uid()))
      .orderBy(desc(emailMessages.receivedAt))
      .limit(40),
  ]);

  const editing = sp.edit ? rules.find((r) => r.id === Number(sp.edit)) : undefined;
  let initial: RuleInitial | null = null;
  let testMessageId: number | undefined;

  if (editing) {
    initial = {
      ...editing,
      fromPattern: editing.fromPattern ?? "",
      subjectPattern: editing.subjectPattern ?? "",
      bodyPattern: editing.bodyPattern ?? "",
      amountRegex: editing.amountRegex ?? "",
      merchantRegex: editing.merchantRegex ?? "",
      identifierRegex: editing.identifierRegex ?? "",
      currencyRegex: editing.currencyRegex ?? "",
      dateRegex: editing.dateRegex ?? "",
      dedupeRegex: editing.dedupeRegex ?? "",
      defaultCurrency: editing.defaultCurrency ?? "",
    };
  } else if (sp.new) {
    initial = {
      name: "",
      enabled: true,
      ignore: false,
      priority: 50,
      fromPattern: "",
      subjectPattern: "",
      bodyPattern: "",
      type: "expense",
      amountRegex: "",
      merchantRegex: "",
      identifierRegex: "",
      currencyRegex: "",
      dateRegex: "",
      dedupeRegex: "",
      defaultCurrency: "",
      accountId: null,
      categoryId: null,
    };
    // Prellenar desde un correo importado
    const fromId = Number(sp.from);
    const src =
      sp.from && Number.isInteger(fromId)
        ? await db.query.emailMessages.findFirst({ where: and(eq(emailMessages.id, fromId), eq(emailMessages.userId, uid())) })
        : null;
    if (src) {
      testMessageId = src.id;
      const address = src.fromAddress?.match(/<([^>]+)>/)?.[1] ?? src.fromAddress ?? "";
      initial.fromPattern = escapeRegex(address.split("@")[1] ?? address);
      initial.subjectPattern = escapeRegex((src.subject ?? "").slice(0, 60));
      initial.name = (src.subject || t.email.rules.newRule).slice(0, 60);
      if (/recib|dep[oó]sit|cr[eé]dito a/i.test(src.subject ?? "")) initial.type = "income";
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">{t.email.rules.intro}</p>
        <Link href="/email?tab=rules&new=1" scroll={false} className="btn-primary">
          <Plus className="size-4" /> {t.email.rules.newRule}
        </Link>
      </div>

      {rules.length === 0 ? (
        <Empty>{t.email.rules.empty}</Empty>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {rules.map((r) => (
            <li key={r.id}>
              <Link href={`/email?tab=rules&edit=${r.id}`} scroll={false} className={`flex items-center gap-3 px-4 py-3.5 transition hover:bg-surface-2/50 ${r.enabled ? "" : "opacity-50"}`}>
                <span className="tabular flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-ink-2">{r.priority}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-medium">{r.name}</span>
                    {r.ignore ? <Badge tone="outline">{t.email.rules.ignore}</Badge> : <Badge>{t.common.txTypes[r.type]}</Badge>}
                    {r.source === "ai" && (
                      <Badge tone="solid">
                        <Sparkles className="size-3" /> {t.email.rules.ai}
                      </Badge>
                    )}
                    {r.source === "preset" && <Badge tone="outline">{t.email.rules.preset}</Badge>}
                    {r.source === "generic" && <Badge tone="outline">{t.email.rules.generic}</Badge>}
                    {!r.enabled && <Badge tone="outline">{t.email.rules.inactive}</Badge>}
                  </span>
                  <span className="block truncate font-mono text-[11px] text-muted">
                    {[
                      r.fromPattern && fmt(t.email.rules.from, { v: r.fromPattern }),
                      r.subjectPattern && fmt(t.email.rules.subject, { v: r.subjectPattern }),
                      r.bodyPattern && fmt(t.email.rules.body, { v: r.bodyPattern }),
                    ].filter(Boolean).join("  ·  ")}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {initial && (
        <Sheet title={editing ? editing.name : t.email.rules.newRule} description={t.email.rules.sheetDescription} closeHref="/email?tab=rules" size="lg">
          <RuleEditor
            initial={initial}
            accounts={accountList.map((a) => ({ id: a.id, name: a.name }))}
            categories={categoryList.map((c) => ({ id: c.id, name: c.name, icon: c.icon }))}
            currencies={appSettings().currencies.map((c) => c.code)}
            messages={recent.map((m) => ({ id: m.id, subject: m.subject ?? "", from: m.from ?? "" }))}
            testMessageId={testMessageId}
            deleteFormId={editing ? "delete-rule" : undefined}
          />
          {editing && (
            <form id="delete-rule" action={deleteRule}>
              <input type="hidden" name="id" value={editing.id} />
            </form>
          )}
        </Sheet>
      )}
    </>
  );
}
