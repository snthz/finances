import { count, desc, eq } from "drizzle-orm";
import { ChevronRight, CircleDollarSign, ExternalLink, Filter, Globe, KeyRound, LogOut, Mail, Plus, RefreshCw, Settings2, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { GoogleButton } from "@/components/google-button";
import { googleConfigured } from "@/lib/google-oauth";
import { deleteAccount, logout } from "@/actions/auth";
import { setAiAuto } from "@/actions/email";
import {
  changePassword,
  deleteAiKey,
  deleteCurrency,
  deleteEmailAccount,
  deleteImportedEmails,
  resetAccountData,
  saveAiKey,
  saveAiModel,
  saveCurrency,
  saveGeneral,
  saveProfile,
  saveSyncInterval,
  updateRatesNow,
} from "@/actions/settings";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { AvatarPicker } from "@/components/avatar-picker";
import { ConfirmButton } from "@/components/confirm-button";
import { EmailAccountForm, SyncAccountButton } from "@/components/email-sync";
import { Field, Segmented, Switch, TagInput } from "@/components/form/controls";
import { PasswordInput } from "@/components/form/password-input";
import { Select } from "@/components/form/select";
import { Sheet, SheetFooter } from "@/components/form/sheet";
import { Badge, Card, Empty, Notice, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { emailAccounts, emailMessages } from "@/db/schema";
import { initScope, requireAuth } from "@/lib/auth";
import { catalogFor, COMMON_TIMEZONES } from "@/lib/currency-catalog";
import type { SyncResult } from "@/lib/email/sync";
import { getWatcherStatus } from "@/lib/email/sync";
import { formatDateTime } from "@/lib/format";
import { extractAddress } from "@/lib/email/gmail-filter";
import { GmailFilterGenerator } from "@/components/gmail-filter-generator";
import { aiConfigured } from "@/lib/ai";
import { AI_PRICING_URLS, AI_PROVIDER_NAMES, aiModelPrice, SUGGESTED_AI_MODELS, type AiProviderId } from "@/lib/ai-models";
import { uid } from "@/lib/context";
import { appSettings, defaultImapHost, getSetting } from "@/lib/settings";
import { LOCALES, LOCALE_NAMES } from "@/i18n/config";
import { fmt, getT } from "@/i18n/server";

export async function generateMetadata() {
  await initScope();
  return { title: getT().settings.page.metaTitle };
}

// Los ids son valores de la URL (?tab=…); el texto sale del diccionario por `key`
const TABS = [
  { id: "general", key: "general", icon: Settings2 },
  { id: "monedas", key: "currencies", icon: CircleDollarSign },
  { id: "correos", key: "email", icon: Mail },
  { id: "ia", key: "ai", icon: Sparkles },
  { id: "cuenta", key: "account", icon: UserRound },
] as const;
type TabId = (typeof TABS)[number]["id"];

type SP = Promise<{ tab?: string; edit?: string; new?: string; filter?: string; aiError?: string; linked?: string }>;

function fmtRate(n: number) {
  return n >= 1 ? n.toLocaleString("en-US", { maximumFractionDigits: 4 }) : n.toLocaleString("en-US", { maximumSignificantDigits: 4 });
}

/** Encabezado de sección estilo "ajustes de sistema" */
function Section({ title, description, children, action }: { title: string; description?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Fila de ajuste: texto a la izquierda y control a la derecha (en una columna en móvil) */
function Row({ label, hint, htmlFor, children }: { label: string; hint?: React.ReactNode; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2.5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] sm:items-center sm:gap-6">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="block text-sm font-medium">
          {label}
        </label>
        {hint && <p className="mt-0.5 text-xs leading-relaxed text-muted">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Barra inferior con las acciones de una tarjeta de ajustes */
function CardFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-2/40 px-5 py-3">{children}</div>;
}

export default async function SettingsPage({ searchParams }: { searchParams: SP }) {
  const user = await requireAuth();
  const sp = await searchParams;
  const tab: TabId = TABS.some((t) => t.id === sp.tab) ? (sp.tab as TabId) : "general";
  const tr = getT().settings.page;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={tr.title} subtitle={user.email} />
      <div className="md:grid md:grid-cols-[176px_minmax(0,1fr)] md:gap-10">
        <nav className="-mx-4 mb-6 flex gap-1.5 overflow-x-auto px-4 md:sticky md:top-10 md:mx-0 md:mb-0 md:flex-col md:gap-0.5 md:self-start md:px-0">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = t.id === tab;
            return (
              <Link
                key={t.id}
                href={`/settings?tab=${t.id}`}
                className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2 text-sm font-medium transition md:px-3 ${
                  active ? "bg-ink text-bg md:bg-surface-2 md:text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                <Icon className="size-4" />
                {tr.tabs[t.key]}
              </Link>
            );
          })}
        </nav>
        <div className="min-w-0 space-y-8">
          {tab === "general" && <GeneralTab />}
          {tab === "monedas" && <CurrenciesTab sp={sp} />}
          {tab === "correos" && <EmailTab sp={sp} />}
          {tab === "ia" && <AiTab sp={sp} />}
          {tab === "cuenta" && (
            <AccountTab name={user.name} email={user.email} avatar={user.avatar} hasPassword={Boolean(user.passwordHash)} googleLinked={Boolean(user.googleId)} linkedNotice={sp.linked === "google"} />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- General

function GeneralTab() {
  const { baseCurrency, timezone, currencies, locale } = appSettings();
  const t = getT();
  const tr = t.settings.page.general;
  const zones = COMMON_TIMEZONES.includes(timezone) ? COMMON_TIMEZONES : [timezone, ...COMMON_TIMEZONES];
  return (
    <Section title={tr.title} description={tr.description}>
      <ActionForm action={saveGeneral} className="card overflow-hidden">
        <div className="divide-y divide-line px-5">
          <Row label={tr.language} hint={tr.languageHint}>
            <Segmented name="language" defaultValue={locale} options={LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l] }))} />
          </Row>
          <Row label={tr.baseCurrency} htmlFor="baseCurrency" hint={tr.baseCurrencyHint}>
            <Select
              id="baseCurrency"
              name="baseCurrency"
              defaultValue={baseCurrency}
              options={currencies.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}`, hint: c.symbol }))}
            />
          </Row>
          <Row label={tr.timezone} htmlFor="timezone" hint={tr.timezoneHint}>
            <Select
              id="timezone"
              name="timezone"
              defaultValue={timezone}
              searchable
              options={zones.map((z) => ({ value: z, label: z.replace(/_/g, " ").replace("America/", ""), hint: z.split("/")[0] }))}
            />
          </Row>
        </div>
        <CardFooter>
          <SubmitButton className="btn-primary h-9">{t.common.actions.save}</SubmitButton>
        </CardFooter>
      </ActionForm>
    </Section>
  );
}

// ---------------------------------------------------------------- Monedas

function CurrenciesTab({ sp }: { sp: Awaited<SP> }) {
  const { baseCurrency, currencies } = appSettings();
  const baseSymbol = currencies.find((c) => c.code === baseCurrency)?.symbol ?? baseCurrency;
  const editing = sp.edit ? currencies.find((c) => c.code === sp.edit) : undefined;
  const available = catalogFor(appSettings().locale).filter((c) => !currencies.some((x) => x.code === c.code));
  const t = getT();
  const tr = t.settings.page.currencies;

  return (
    <>
      <Section
        title={tr.title}
        description={fmt(tr.description, { base: baseCurrency })}
        action={
          <Link href="/settings?tab=monedas&new=1" scroll={false} className="btn-primary h-9">
            <Plus className="size-4" /> {t.common.actions.add}
          </Link>
        }
      >
        <ul className="card divide-y divide-line overflow-hidden">
          {currencies.map((c) => {
            const isBase = c.code === baseCurrency;
            return (
              <li key={c.code}>
                <Link href={`/settings?tab=monedas&edit=${c.code}`} scroll={false} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-surface-2/50">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold">{c.symbol}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[15px] font-medium">
                      {c.name} {isBase && <Badge tone="solid">{tr.baseBadge}</Badge>}
                    </span>
                    <span className="block truncate font-mono text-xs text-muted">{c.aliases.join(" · ")}</span>
                  </span>
                  <span className="tabular shrink-0 text-right text-sm">
                    {isBase ? (
                      <span className="text-muted">{c.code}</span>
                    ) : c.rate ? (
                      <>
                        <span className="block font-medium">
                          {fmtRate(c.rate)} {baseSymbol}
                        </span>
                        <span className="block text-xs text-muted">{c.autoRate ? tr.auto : tr.manual}</span>
                      </>
                    ) : (
                      <Badge tone="warn">{tr.noRate}</Badge>
                    )}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
        <ActionForm action={updateRatesNow} className="flex flex-col items-start px-1">
          <SubmitButton className="btn-subtle h-9 text-xs" pendingText={tr.updating}>
            <RefreshCw className="size-3.5" /> {tr.updateNow}
          </SubmitButton>
        </ActionForm>
        <p className="px-1 text-xs text-muted">{tr.source}</p>
      </Section>

      {(editing || sp.new) && (
        <Sheet title={editing ? editing.name : tr.addTitle} description={editing ? editing.code : tr.addDescription} closeHref="/settings?tab=monedas">
          <ActionForm action={saveCurrency} className="space-y-5">
            {editing ? (
              <input type="hidden" name="code" value={editing.code} />
            ) : (
              <Field label={tr.currency} hint={tr.currencyHint}>
                <Select
                  name="code"
                  searchable
                  placeholder={tr.searchPlaceholder}
                  options={available.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}`, hint: c.symbol }))}
                />
              </Field>
            )}
            {!editing && (
              <Field label={tr.customCode} htmlFor="customCode">
                <input id="customCode" name="customCode" maxLength={3} placeholder={tr.customCodePlaceholder} className="input uppercase" />
              </Field>
            )}
            {editing && (
              <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                <Field label={tr.name} htmlFor="cname">
                  <input id="cname" name="name" defaultValue={editing.name} className="input" />
                </Field>
                <Field label={tr.symbol} htmlFor="csymbol">
                  <input id="csymbol" name="symbol" defaultValue={editing.symbol} className="input" />
                </Field>
              </div>
            )}
            <Field label={tr.aliases} hint={tr.aliasesHint}>
              <TagInput name="aliases" defaultValue={editing?.aliases ?? []} placeholder={editing ? tr.aliasesAddPlaceholder : tr.aliasesCatalogPlaceholder} mono />
            </Field>
            {editing?.code !== baseCurrency && (
              <div className="space-y-3">
                <Field label={tr.rate}>
                  <Segmented
                    name="rateMode"
                    defaultValue={editing && !editing.autoRate ? "manual" : "auto"}
                    options={[
                      { value: "auto", label: tr.rateAuto },
                      { value: "manual", label: tr.rateManual },
                    ]}
                  />
                </Field>
                <Field label={fmt(tr.rateLabel, { code: editing?.code ?? tr.unit, base: baseCurrency })} htmlFor="rate" hint={tr.rateHint}>
                  <input id="rate" name="rate" inputMode="decimal" defaultValue={editing?.rate ?? ""} className="input tabular" />
                </Field>
              </div>
            )}
            <SheetFooter>
              {editing && editing.code !== baseCurrency && (
                <ConfirmButton form="delete-currency" confirmLabel={tr.confirmDelete}>
                  {t.common.actions.delete}
                </ConfirmButton>
              )}
              <SubmitButton className="btn-primary ml-auto h-11 flex-1 sm:flex-none sm:px-8">{editing ? t.common.actions.save : tr.addCurrency}</SubmitButton>
            </SheetFooter>
          </ActionForm>
          {editing && (
            <ActionForm id="delete-currency" action={deleteCurrency}>
              <input type="hidden" name="code" value={editing.code} />
            </ActionForm>
          )}
        </Sheet>
      )}
    </>
  );
}

// ---------------------------------------------------------------- Correos

// El texto de cada estado sale de t.settings.page.email.status[state]
const WATCH_TONE = {
  watching: "solid",
  connecting: "neutral",
  error: "bad",
  off: "outline",
} as const;

async function EmailTab({ sp }: { sp: Awaited<SP> }) {
  const { emailAccounts: accs, syncIntervalMinutes } = appSettings();
  const userId = uid();
  const rows = await db.select().from(emailAccounts).where(eq(emailAccounts.userId, userId)).orderBy(desc(emailAccounts.id));
  const editing = sp.edit ? accs.find((a) => a.id === Number(sp.edit)) : undefined;
  const editingRow = editing ? rows.find((r) => r.id === editing.id) : undefined;
  const def = defaultImapHost();
  const seenSenders = sp.filter
    ? (
        await db
          .select({ accountId: emailMessages.emailAccountId, from: emailMessages.fromAddress, count: count() })
          .from(emailMessages)
          .where(eq(emailMessages.userId, userId))
          .groupBy(emailMessages.emailAccountId, emailMessages.fromAddress)
          .orderBy(desc(count()))
      )
        .map((r) => ({ accountId: r.accountId, address: extractAddress(r.from ?? ""), count: r.count }))
        .filter((r) => r.address)
    : [];
  const t = getT();
  const tr = t.settings.page.email;

  return (
    <>
      <Section
        title={tr.title}
        description={tr.description}
        action={
          <Link href="/settings?tab=correos&new=1" scroll={false} className="btn-primary h-9">
            <Plus className="size-4" /> {tr.connect}
          </Link>
        }
      >
        {accs.length === 0 ? (
          <Empty icon={<Mail className="size-5" />}>
            {tr.empty}
            <Link href="/settings?tab=correos&new=1" scroll={false} className="btn-primary mt-2 h-9">
              {tr.connectGmail}
            </Link>
          </Empty>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {accs.map((a) => {
              const status = a.enabled ? getWatcherStatus(a.id) : { state: "off" as const };
              const row = rows.find((r) => r.id === a.id);
              const last = row?.lastResult as SyncResult | null;
              const label = !a.enabled
                ? { tone: "outline" as const, text: tr.status.paused }
                : !a.pass
                  ? { tone: "bad" as const, text: tr.status.noPassword }
                  : { tone: WATCH_TONE[status.state], text: tr.status[status.state] };
              return (
                <li key={a.id}>
                  <Link href={`/settings?tab=correos&edit=${a.id}`} scroll={false} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-surface-2/50">
                    <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2">
                      <Mail className="size-4" />
                      {status.state === "watching" && <span className="absolute right-0 bottom-0 size-3 rounded-full border-2 border-surface bg-ink" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-[15px] font-medium">
                        <span className="truncate">{a.label}</span>
                        <Badge tone={label.tone}>{label.text}</Badge>
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {a.address} · {fmt(tr.labelLine, { mailbox: a.mailbox })}
                        {row?.lastSyncAt ? ` · ${formatDateTime(row.lastSyncAt)}` : ""}
                      </span>
                      {(status.state === "error" && status.message) || (last && !last.ok && last.message) ? (
                        <span className="mt-0.5 block truncate text-xs text-bad">{status.message ?? last?.message}</span>
                      ) : null}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title={tr.filterTitle} description={tr.filterDescription}>
        <Link href="/settings?tab=correos&filter=1" scroll={false} className="card flex items-center gap-3 px-4 py-3.5 transition hover:bg-surface-2/50">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2">
            <Filter className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium">{tr.generateFilter}</span>
            <span className="block truncate text-xs text-muted">{tr.generateFilterHint}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted" />
        </Link>
        <Link href="/email" className="card flex items-center gap-3 px-4 py-3.5 transition hover:bg-surface-2/50">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2">
            <Mail className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium">{tr.importedTitle}</span>
            <span className="block truncate text-xs text-muted">{tr.importedHint}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted" />
        </Link>
      </Section>

      <Section title={tr.backup.title} description={tr.backup.description}>
        <ActionForm action={saveSyncInterval} className="card overflow-hidden">
          <div className="px-5">
            <Row label={tr.backup.interval} htmlFor="intervalMinutes" hint={tr.backup.intervalHint}>
              <input id="intervalMinutes" name="intervalMinutes" type="number" min={0} max={1440} defaultValue={syncIntervalMinutes} className="input tabular" />
            </Row>
          </div>
          <CardFooter>
            <SubmitButton className="btn-subtle h-9">{t.common.actions.save}</SubmitButton>
          </CardFooter>
        </ActionForm>
      </Section>

      <Section title={tr.howTo.title}>
        <Card>
          <ol className="space-y-4 text-sm text-ink-2">
            {[
              <>{tr.howTo.step1}</>,
              <>
                {tr.howTo.step2Before}
                <strong className="text-ink">{tr.howTo.step2Strong}</strong>
                {tr.howTo.step2Mid}
                <a className="font-medium text-ink underline" href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">
                  myaccount.google.com/apppasswords
                </a>
                {tr.howTo.step2After}
              </>,
              <>
                {tr.howTo.step3Before}
                {/* "Finanzas" es el nombre de etiqueta por defecto (dato), no se traduce */}
                <strong className="text-ink">Finanzas</strong>
                {tr.howTo.step3Mid}
                <Link href="/settings?tab=correos&filter=1" scroll={false} className="font-medium text-ink underline">
                  {tr.howTo.step3Link}
                </Link>
                {tr.howTo.step3After}
              </>,
              <>{tr.howTo.step4}</>,
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-bg">{i + 1}</span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </Card>
      </Section>

      {sp.filter && (
        <Sheet title={tr.filterSheet.title} description={tr.filterSheet.description} closeHref="/settings?tab=correos">
          <GmailFilterGenerator
            accounts={accs.map(({ id, label, address, mailbox }) => ({ id, label, address, mailbox }))}
            seen={seenSenders}
            defaultAccountId={Number(sp.filter) || undefined}
          />
        </Sheet>
      )}

      {(editing || sp.new) && (
        <Sheet title={editing ? editing.label : tr.sheet.newTitle} description={editing?.address ?? tr.sheet.newDescription} closeHref="/settings?tab=correos">
          <EmailAccountForm closeHref="/settings?tab=correos" className="space-y-5">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <Field label={tr.sheet.address} htmlFor="address">
              <input
                id="address"
                name="address"
                type="email"
                required
                defaultValue={editing?.address}
                placeholder={tr.sheet.addressPlaceholder}
                className="input"
                autoFocus={!editing}
              />
            </Field>
            <Field label={tr.sheet.appPassword} htmlFor="pass" hint={editing ? tr.sheet.appPasswordKeepHint : tr.sheet.appPasswordNewHint}>
              <PasswordInput id="pass" name="pass" autoComplete="off" placeholder={editing ? "•••• •••• •••• ••••" : "xxxx xxxx xxxx xxxx"} required={!editing} className="font-mono" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={tr.sheet.displayName} htmlFor="label">
                <input id="label" name="label" defaultValue={editing?.label} placeholder={tr.sheet.displayNamePlaceholder} className="input" />
              </Field>
              <Field
                label={tr.sheet.mailbox}
                htmlFor="mailbox"
                hint={
                  editing ? (
                    <Link href={`/settings?tab=correos&filter=${editing.id}`} scroll={false} className="underline">
                      {tr.sheet.generateItsFilter}
                    </Link>
                  ) : undefined
                }
              >
                <input id="mailbox" name="mailbox" required defaultValue={editing?.mailbox ?? "Finanzas"} className="input" />
              </Field>
            </div>
            <div className="card divide-y divide-line px-4 shadow-none">
              <div className="py-2">
                <Switch name="realtime" defaultChecked={editing?.realtime ?? true} label={tr.sheet.realtime} hint={tr.sheet.realtimeHint} />
              </div>
              <div className="py-2">
                <Switch name="enabled" defaultChecked={editing?.enabled ?? true} label={tr.sheet.enabled} hint={tr.sheet.enabledHint} />
              </div>
            </div>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-ink-2">
                <ChevronRight className="size-4 transition group-open:rotate-90" /> {tr.sheet.advanced}
              </summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)_6.5rem]">
                <Field label={tr.sheet.initialDays} htmlFor="initialDays" hint={tr.sheet.initialDaysHint}>
                  <input id="initialDays" name="initialDays" type="number" min={1} defaultValue={editing?.initialDays ?? 60} className="input tabular" />
                </Field>
                <Field label={tr.sheet.imapHost} htmlFor="host">
                  <input id="host" name="host" defaultValue={editing?.host ?? def.host} className="input" />
                </Field>
                <Field label={tr.sheet.port} htmlFor="port">
                  <input id="port" name="port" type="number" defaultValue={editing?.port ?? def.port} className="input tabular" />
                </Field>
              </div>
            </details>
            {editingRow?.lastResult ? (
              <p className="flex items-center gap-2 text-xs text-muted">
                <Globe className="size-3.5" /> {fmt(tr.sheet.lastSync, { date: editingRow.lastSyncAt ? formatDateTime(editingRow.lastSyncAt) : "—" })}
              </p>
            ) : null}
            <SheetFooter>
              {editing && (
                <ConfirmButton form="delete-email-account" confirmLabel={tr.sheet.confirmDisconnect}>
                  {tr.sheet.disconnect}
                </ConfirmButton>
              )}
              {editing && <SyncAccountButton id={editing.id} label={tr.sheet.syncNow} />}
              <SubmitButton pendingText={tr.sheet.connecting} className="btn-primary ml-auto h-11 flex-1 sm:flex-none sm:px-8">
                {editing ? t.common.actions.save : tr.sheet.connect}
              </SubmitButton>
            </SheetFooter>
          </EmailAccountForm>
          {editing && (
            <form id="delete-email-account" action={deleteEmailAccount}>
              <input type="hidden" name="id" value={editing.id} />
            </form>
          )}
        </Sheet>
      )}
    </>
  );
}

// ---------------------------------------------------------------- IA

const AI_KEY_LINKS: Record<AiProviderId, { href: string; label: string }> = {
  anthropic: { href: "https://console.anthropic.com/settings/keys", label: "console.anthropic.com/settings/keys" },
  openai: { href: "https://platform.openai.com/api-keys", label: "platform.openai.com/api-keys" },
};

// Precio por millón de tokens: "0.05", "1.25", "20"
const usd = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

async function AiTab({ sp }: { sp: Awaited<SP> }) {
  // Sólo datos no secretos: proveedor, últimos 4 de la clave y modelos (la clave nunca llega al navegador)
  const { provider, keyHint, model, models } = appSettings().ai;
  const configured = aiConfigured();
  const aiToday = Number((await getSetting(`ai.usage.${new Date().toISOString().slice(0, 10)}`)) ?? 0);
  const t = getT();
  const tr = t.settings.page.ai;
  const modelOptions = provider ? (models.length ? models : SUGGESTED_AI_MODELS[provider]) : [];
  const providerOptions = (Object.keys(AI_PROVIDER_NAMES) as AiProviderId[]).map((p) => ({ value: p, label: p === "anthropic" ? "Claude" : "OpenAI" }));

  return (
    <>
      <Section title={tr.title} description={tr.description}>
        {sp.aiError && <Notice tone="bad">{fmt(tr.onboardingError, { error: sp.aiError.slice(0, 300) })}</Notice>}

        {configured && provider && (
          <div className="card overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2">
                <KeyRound className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium">{AI_PROVIDER_NAMES[provider]}</span>
                <span className="block truncate font-mono text-xs text-muted">{fmt(tr.savedKey, { hint: keyHint })}</span>
              </span>
              <ActionForm action={deleteAiKey}>
                <ConfirmButton confirmLabel={tr.confirmRemove} className="btn-danger h-9">
                  {tr.removeKey}
                </ConfirmButton>
              </ActionForm>
            </div>
            <ActionForm action={saveAiModel}>
              <div className="border-t border-line px-5">
                <Row
                  label={tr.model}
                  htmlFor="aiModel"
                  hint={
                    <>
                      {tr.modelHint}{" "}
                      <a href={AI_PRICING_URLS[provider]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-ink underline">
                        {tr.pricingLink} <ExternalLink className="size-3" />
                      </a>
                    </>
                  }
                >
                  <Select
                    id="aiModel"
                    name="model"
                    defaultValue={model || modelOptions[0]}
                    options={modelOptions.map((m) => {
                      const price = aiModelPrice(m);
                      return { value: m, label: m, hint: price ? fmt(tr.priceHint, { input: usd(price.input), output: usd(price.output) }) : tr.noPrice };
                    })}
                  />
                </Row>
              </div>
              <CardFooter>
                <SubmitButton className="btn-primary h-9">{t.common.actions.save}</SubmitButton>
              </CardFooter>
            </ActionForm>
          </div>
        )}

        <ActionForm action={saveAiKey} className="card overflow-hidden">
          <div className="space-y-4 p-5">
            {configured && <p className="text-sm font-medium">{tr.replaceKey}</p>}
            <Field label={tr.provider}>
              <Segmented name="provider" defaultValue={provider ?? "anthropic"} options={providerOptions} />
            </Field>
            <Field label={tr.apiKey} htmlFor="apiKey" hint={configured ? tr.replaceKeyHint : tr.apiKeyHint}>
              <PasswordInput id="apiKey" name="apiKey" required autoComplete="off" spellCheck={false} placeholder={tr.apiKeyPlaceholder} className="font-mono" />
            </Field>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <span>{tr.getKey}</span>
              {(Object.keys(AI_KEY_LINKS) as AiProviderId[]).map((p) => (
                <a key={p} href={AI_KEY_LINKS[p].href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-ink underline">
                  {AI_KEY_LINKS[p].label} <ExternalLink className="size-3" />
                </a>
              ))}
            </p>
          </div>
          <CardFooter>
            <SubmitButton className="btn-primary h-9" pendingText={tr.verifying}>
              {tr.saveKey}
            </SubmitButton>
          </CardFooter>
        </ActionForm>

        <div className="card flex gap-3 px-5 py-4">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium">{tr.securityTitle}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">{tr.security}</p>
          </div>
        </div>
      </Section>

      <Section title={tr.autoTitle} description={tr.autoDescription}>
        <Card>
          {configured ? (
            <ActionForm action={setAiAuto} className="space-y-4">
              <Switch name="enabled" defaultChecked={appSettings().aiAutoRules} label={tr.autoToggle} hint={fmt(tr.autoHint, { n: aiToday })} />
              <div className="flex justify-end">
                <SubmitButton className="btn-subtle">{t.common.actions.save}</SubmitButton>
              </div>
            </ActionForm>
          ) : (
            <p className="text-sm text-ink-2">{tr.autoNeedsKey}</p>
          )}
        </Card>
      </Section>
    </>
  );
}

// ---------------------------------------------------------------- Cuenta

function AccountTab({
  name,
  email,
  avatar,
  hasPassword,
  googleLinked,
  linkedNotice,
}: {
  name: string;
  email: string;
  avatar: string | null;
  hasPassword: boolean;
  googleLinked: boolean;
  linkedNotice: boolean;
}) {
  const t = getT();
  const tr = t.settings.page.account;
  return (
    <>
      {linkedNotice && <Notice tone="neutral">{tr.googleLinkedNotice}</Notice>}
      <Section title={tr.profileTitle} description={tr.profileDescription}>
        <div className="card overflow-hidden">
          <div className="border-b border-line p-5">
            <AvatarPicker name={name} email={email} avatar={avatar} />
          </div>
          <ActionForm action={saveProfile}>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label={tr.name} htmlFor="name">
                <input id="name" name="name" defaultValue={name} required className="input" />
              </Field>
              <Field label={tr.loginEmail} htmlFor="email">
                <input id="email" name="email" type="email" defaultValue={email} required className="input" />
              </Field>
            </div>
            <CardFooter>
              <SubmitButton className="btn-primary h-9">{t.common.actions.save}</SubmitButton>
            </CardFooter>
          </ActionForm>
        </div>
      </Section>

      <Section title={hasPassword ? tr.passwordTitle : tr.setPasswordTitle} description={hasPassword ? undefined : tr.setPasswordHint}>
        <ActionForm action={changePassword} className="card overflow-hidden">
          <div className="space-y-4 p-5">
            {hasPassword && (
              <Field label={tr.currentPassword} htmlFor="current">
                <PasswordInput id="current" name="current" required autoComplete="current-password" />
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={tr.newPassword} htmlFor="next" hint={tr.newPasswordHint}>
                <PasswordInput id="next" name="next" required minLength={8} autoComplete="new-password" />
              </Field>
              <Field label={tr.repeatPassword} htmlFor="confirmPw">
                <PasswordInput id="confirmPw" name="confirm" required minLength={8} autoComplete="new-password" />
              </Field>
            </div>
          </div>
          <CardFooter>
            <SubmitButton className="btn-primary h-9">{hasPassword ? tr.changePassword : tr.setPassword}</SubmitButton>
          </CardFooter>
        </ActionForm>
      </Section>

      {googleConfigured() && (
        <Section title={tr.googleTitle}>
          <div className="card flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">{googleLinked ? tr.googleLinked : tr.googleConnect}</p>
              <p className="mt-0.5 text-xs text-muted">{googleLinked ? tr.googleLinkedHint : tr.googleConnectHint}</p>
            </div>
            {googleLinked ? (
              <Badge tone="solid">Google</Badge>
            ) : (
              <div className="w-full sm:w-auto">
                <GoogleButton label={tr.googleConnect} next="/settings?tab=cuenta" />
              </div>
            )}
          </div>
        </Section>
      )}

      <Section title={tr.sessionTitle}>
        <form action={logout} className="card flex items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">{tr.logoutTitle}</p>
            <p className="mt-0.5 text-xs text-muted">{tr.logoutHint}</p>
          </div>
          <button className="btn-danger h-9 shrink-0">
            <LogOut className="size-4" /> {tr.logout}
          </button>
        </form>
      </Section>

      <Section title={tr.dataTitle} description={tr.dataDescription}>
        <div className="card divide-y divide-line overflow-hidden border-bad/30">
          {[
            { action: deleteImportedEmails, title: tr.deleteEmailsTitle, hint: tr.deleteEmailsHint, label: tr.deleteEmails, confirm: tr.deleteEmailsConfirm },
            { action: resetAccountData, title: tr.resetTitle, hint: tr.resetHint, label: tr.reset, confirm: tr.resetConfirm },
          ].map((d) => (
            <ActionForm key={d.title} action={d.action} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <div className="min-w-0">
                <p className="text-sm font-medium">{d.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{d.hint}</p>
              </div>
              <ConfirmButton confirmLabel={d.confirm} description={d.hint} className="btn-danger h-9 shrink-0 self-start sm:self-auto">
                {d.label}
              </ConfirmButton>
            </ActionForm>
          ))}
        </div>
      </Section>

      <Section title={tr.dangerTitle} description={tr.dangerDescription}>
        <ActionForm action={deleteAccount} className="card overflow-hidden border-bad/30">
          <div className="p-5">
            <Field label={fmt(tr.deleteConfirmLabel, { email })} htmlFor="deleteConfirm">
              <input id="deleteConfirm" name="confirm" required autoComplete="off" spellCheck={false} placeholder={email} className="input" />
            </Field>
          </div>
          <CardFooter>
            <ConfirmButton confirmLabel={tr.deleteConfirm} description={tr.dangerDescription} className="btn-danger h-9">
              {tr.deleteAccount}
            </ConfirmButton>
          </CardFooter>
        </ActionForm>
      </Section>
    </>
  );
}
