import "server-only";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { db } from "@/db";
import { accounts, categories, currencies, emailAccounts, emailMessages, emailRules, transactions } from "@/db/schema";
import { catalogFor } from "@/lib/currency-catalog";
import { currentUserId, uid } from "@/lib/context";
import { activeEmailAccounts, appSettings, reloadSettings, runAsUser, type EmailAccountInfo } from "@/lib/settings";
import { aiAutoEnabled, createRuleWithAi } from "@/lib/ai";
import { localToUtc, toLocalYmd } from "@/lib/format";
import { matchTransactionToPayment } from "@/lib/payment-matching";
import { fmt, getLocale, getT } from "@/i18n/server";
import { extract, type LocalDate, matchAccount, matchCategory, normalizeText, ruleMatches } from "./parser";

const MAX_BODY = 20_000;

export type SyncResult = {
  ok: boolean;
  fetched: number;
  created: number;
  unmatched: number;
  ignored: number;
  errors: number;
  message?: string;
  /** true si no se sincronizó porque ya había otra sincronización en curso (no es un error real) */
  busy?: boolean;
  finishedAt: string;
};

export type WatcherStatus = { state: "off" | "connecting" | "watching" | "error"; since?: string; message?: string };

type WatcherEntry = {
  client: ImapFlow | null;
  status: WatcherStatus;
  retry?: ReturnType<typeof setTimeout>;
  stopped: boolean;
  generation: number;
};

const g = globalThis as unknown as {
  __financeSyncRunning?: Set<number>;
  __financeSyncAgain?: Set<number>;
  __financeWatchers?: Map<number, WatcherEntry>;
};
const running = (g.__financeSyncRunning ??= new Set());
const again = (g.__financeSyncAgain ??= new Set());
const watchers = (g.__financeWatchers ??= new Map());

function htmlToText(html: string) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d|table)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, "  ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function newClient(acc: EmailAccountInfo, forWatcher = false) {
  return new ImapFlow({
    host: acc.host,
    port: acc.port,
    secure: true,
    auth: { user: acc.address, pass: acc.pass },
    logger: false,
    ...(forWatcher
      ? {
          // Entra en IDLE casi de inmediato (por defecto espera 15 s) y lo reinicia
          // antes del corte de ~29 min de Gmail
          autoIdleDelay: 1000,
          maxIdleTime: 9 * 60_000,
        }
      : { disableAutoIdle: true }),
  });
}

function findAccount(id: number) {
  return appSettings().emailAccounts.find((a) => a.id === id);
}

/** Dueño de una cuenta de correo (para correr watchers y sincronizaciones como ese usuario). */
async function ownerOf(accountId: number) {
  const [row] = await db.select({ userId: emailAccounts.userId }).from(emailAccounts).where(eq(emailAccounts.id, accountId));
  return row?.userId ?? null;
}

/** Ejecuta `fn` como el dueño de la cuenta. Nunca permite operar sobre la cuenta de otro usuario. */
async function asOwner<T>(accountId: number, fn: () => Promise<T>, fallback: T): Promise<T> {
  const owner = await ownerOf(accountId);
  if (!owner) return fallback;
  const current = currentUserId();
  if (current && current !== owner) throw new Error(`La cuenta de correo ${accountId} no pertenece al usuario ${current}`);
  return runAsUser(owner, fn);
}

/** Si el correo trae una moneda que aún no existe, se crea (sin tasa) para que aparezca en Ajustes. */
async function ensureCurrency(code: string) {
  if (appSettings().currencies.some((c) => c.code === code)) return;
  const cat = catalogFor(getLocale()).find((c) => c.code === code);
  await db
    .insert(currencies)
    .values({ userId: uid(), code, name: cat?.name ?? code, symbol: cat?.symbol ?? code, aliases: cat?.aliases ?? [code] })
    .onConflictDoNothing();
  await reloadSettings();
}

/** Usa la fecha escrita en el correo si es coherente con la de recepción; si no, la de recepción. */
function resolveDate(found: LocalDate | null, receivedAt: Date) {
  if (!found) return receivedAt;
  // Sin hora y del mismo día: la hora de recepción es más precisa
  if (!found.time && toLocalYmd(receivedAt) === found.ymd) return receivedAt;
  const d = localToUtc(found.ymd, found.time ?? "12:00");
  // Fechas absurdas (mal interpretadas) se descartan
  return Math.abs(d.getTime() - receivedAt.getTime()) > 60 * 86_400_000 ? receivedAt : d;
}

type Status = "parsed" | "unmatched" | "ignored" | "error" | "duplicate";

/** Aplica las reglas a un correo ya guardado y crea la transacción si corresponde. */
export async function processMessage(messageId: number, opts: { allowAi?: boolean } = {}): Promise<Status> {
  const allowAi = opts.allowAi ?? true;
  const userId = uid();
  const msg = await db.query.emailMessages.findFirst({ where: and(eq(emailMessages.id, messageId), eq(emailMessages.userId, userId)) });
  if (!msg) return "error";

  const existing = await db.query.transactions.findFirst({ where: and(eq(transactions.emailMessageId, msg.id), eq(transactions.userId, userId)) });
  if (existing) {
    await db.update(emailMessages).set({ status: "parsed", error: null }).where(and(eq(emailMessages.id, msg.id), eq(emailMessages.userId, userId)));
    return "parsed";
  }

  const [rules, accountList, categoryList] = await Promise.all([
    db
      .select()
      .from(emailRules)
      .where(and(eq(emailRules.userId, userId), eq(emailRules.enabled, true)))
      .orderBy(asc(emailRules.priority), asc(emailRules.id)),
    db.select().from(accounts).where(eq(accounts.userId, userId)),
    db.select().from(categories).where(eq(categories.userId, userId)),
  ]);

  const input = { from: msg.fromAddress ?? "", subject: msg.subject ?? "", body: msg.body ?? "" };
  const rule = rules.find((r) => ruleMatches(r, input));
  const ex = rule && !rule.ignore ? extract(rule, input, appSettings().currencies) : null;

  // Sin regla, sólo una regla genérica, o la regla no logra leer el monto: se intenta crear una regla específica con IA
  const needsAi = !rule || (rule.source === "generic" && !rule.ignore) || (ex !== null && ex.amount === null);
  if (needsAi && allowAi && msg.aiAttemptAt === null && aiAutoEnabled()) {
    const created = await createRuleWithAi(msg.id).catch((err) => {
      console.error("[ai-rules]", err);
      return null;
    });
    if (created?.ruleId) return processMessage(msg.id, { allowAi: false });
  }

  if (!rule) {
    await db.update(emailMessages).set({ status: "unmatched", ruleId: null, error: null }).where(and(eq(emailMessages.id, msg.id), eq(emailMessages.userId, userId)));
    return "unmatched";
  }
  if (rule.ignore || !ex) {
    await db.update(emailMessages).set({ status: "ignored", ruleId: rule.id, error: null }).where(and(eq(emailMessages.id, msg.id), eq(emailMessages.userId, userId)));
    return "ignored";
  }
  if (ex.amount === null) {
    await db
      .update(emailMessages)
      .set({ status: "error", ruleId: rule.id, error: getT().email.syncStatus.noAmount })
      .where(and(eq(emailMessages.id, msg.id), eq(emailMessages.userId, userId)));
    return "error";
  }

  const account =
    (rule.accountId ? accountList.find((a) => a.id === rule.accountId) : null) ?? matchAccount(accountList, ex.identifier);
  const relevantCats = categoryList.filter((c) => (rule.type === "income" ? c.kind === "income" : c.kind === "expense"));
  const categoryId =
    rule.type === "transfer"
      ? null
      : ((rule.categoryId && categoryList.some((c) => c.id === rule.categoryId) ? rule.categoryId : null) ??
        matchCategory(relevantCats, ex.merchant, msg.subject)?.id ??
        null);
  const currency = ex.currency ?? account?.currency ?? appSettings().baseCurrency;
  const date = resolveDate(ex.date, msg.receivedAt);
  const amount = ex.amount.toFixed(2);

  // Duplicados: por la clave del documento (ej. quincena) o, si no hay, mismo movimiento en pocos minutos
  const dedupeKey = ex.dedupeKey ? `r${rule.id}:${ex.dedupeKey}` : null;
  const dup = dedupeKey
    ? await db.query.transactions.findFirst({ where: and(eq(transactions.userId, userId), eq(transactions.dedupeKey, dedupeKey)) })
    : await db.query.transactions.findFirst({
        where: and(
          eq(transactions.userId, userId),
          eq(transactions.source, "email"),
          eq(transactions.type, rule.type),
          eq(transactions.amount, amount),
          eq(transactions.currency, currency),
          ex.merchant ? eq(transactions.merchant, ex.merchant) : isNull(transactions.merchant),
          ex.identifier ? eq(transactions.detectedIdentifier, ex.identifier) : isNull(transactions.detectedIdentifier),
          sql`abs(extract(epoch from (${transactions.date} - ${date.toISOString()}::timestamptz))) < 600`,
        ),
      });
  if (dup) {
    await db
      .update(emailMessages)
      .set({ status: "duplicate", ruleId: rule.id, error: fmt(getT().email.syncStatus.duplicateOf, { id: dup.id }) })
      .where(and(eq(emailMessages.id, msg.id), eq(emailMessages.userId, userId)));
    return "duplicate";
  }

  await ensureCurrency(currency);
  const [created] = await db.insert(transactions).values({
    userId,
    date,
    amount,
    type: rule.type,
    currency,
    description: msg.subject,
    merchant: ex.merchant,
    accountId: account?.id ?? null,
    categoryId,
    source: "email",
    emailMessageId: msg.id,
    detectedIdentifier: ex.identifier,
    dedupeKey,
  }).returning({ id: transactions.id });
  // Si el comercio coincide con un pago programado (ej. "ENEE PAGOS X INTERNET" → Electricidad), se da por pagado
  try {
    await matchTransactionToPayment(created.id);
  } catch (err) {
    console.error("[payments] no se pudo vincular el movimiento", err);
  }
  await db.update(emailMessages).set({ status: "parsed", ruleId: rule.id, error: null }).where(and(eq(emailMessages.id, msg.id), eq(emailMessages.userId, userId)));
  return "parsed";
}

/** Reprocesa correos que no generaron transacción (tras crear/editar reglas). */
export async function reprocessPending() {
  const pending = await db
    .select({ id: emailMessages.id })
    .from(emailMessages)
    .leftJoin(transactions, and(eq(transactions.emailMessageId, emailMessages.id), eq(transactions.userId, emailMessages.userId)))
    .where(and(eq(emailMessages.userId, uid()), inArray(emailMessages.status, ["unmatched", "error", "ignored"]), isNull(transactions.id)));
  const counts = { parsed: 0, unmatched: 0, ignored: 0, error: 0, duplicate: 0 };
  for (const p of pending) counts[await processMessage(p.id)]++;
  return counts;
}


/** Rango de fechas locales (YYYY-MM-DD, ambos incluidos) para importar correos de un periodo concreto. */
export type SyncRange = { from: string; to: string };

export async function syncAll(range?: SyncRange) {
  const results: (SyncResult & { accountId: number; label: string })[] = [];
  for (const acc of activeEmailAccounts()) results.push({ ...(await syncAccount(acc.id, range)), accountId: acc.id, label: acc.label });
  return results;
}

/** Sincroniza todas las cuentas de todos los usuarios (cron externo). */
export async function syncEveryone() {
  const owners = await db.selectDistinct({ userId: emailAccounts.userId }).from(emailAccounts).where(eq(emailAccounts.enabled, true));
  const results: (SyncResult & { accountId: number; label: string })[] = [];
  for (const { userId } of owners) results.push(...(await runAsUser(userId, syncAll)));
  return results;
}

const EMPTY_RESULT = (): SyncResult => ({ ok: false, fetched: 0, created: 0, unmatched: 0, ignored: 0, errors: 0, finishedAt: new Date().toISOString() });

/** Sincroniza una cuenta de correo como su dueño (se puede llamar desde tareas de fondo). */
export function syncAccount(accountId: number, range?: SyncRange): Promise<SyncResult> {
  return asOwner(accountId, () => syncAccountAsOwner(accountId, range), EMPTY_RESULT());
}

/** Espera a que termine la sincronización en curso de una cuenta, si hay una. */
export async function waitForSync(accountId: number, timeoutMs = 120_000) {
  const end = Date.now() + timeoutMs;
  while (running.has(accountId) && Date.now() < end) await new Promise((r) => setTimeout(r, 500));
}

// IMAP SINCE/BEFORE sólo comparan la fecha: el mediodía UTC evita que la zona horaria la mueva de día
const imapDay = (ymd: string, addDays = 0) => new Date(Date.parse(`${ymd}T12:00:00Z`) + addDays * 86_400_000);

async function syncAccountAsOwner(accountId: number, range?: SyncRange): Promise<SyncResult> {
  const userId = uid();
  const base = { fetched: 0, created: 0, unmatched: 0, ignored: 0, errors: 0 };
  const acc = findAccount(accountId);
  if (!acc || !acc.enabled || !acc.pass) {
    return { ok: false, ...base, message: getT().email.syncStatus.notConfigured, finishedAt: new Date().toISOString() };
  }
  if (running.has(accountId)) {
    // Llegó otro aviso mientras sincronizábamos: repetir al terminar
    again.add(accountId);
    return { ok: false, ...base, busy: true, message: getT().email.syncStatus.alreadyRunning, finishedAt: new Date().toISOString() };
  }
  running.add(accountId);
  const startedAt = new Date();
  const result: SyncResult = { ok: true, ...base, finishedAt: "" };
  const client = newClient(acc);

  try {
    const row = await db.query.emailAccounts.findFirst({ where: and(eq(emailAccounts.id, accountId), eq(emailAccounts.userId, userId)) });
    // 2 días de solapamiento: IMAP SINCE sólo compara por fecha; los duplicados se descartan por Message-ID
    const since = row?.lastSyncAt
      ? new Date(row.lastSyncAt.getTime() - 2 * 86_400_000)
      : new Date(Date.now() - acc.initialDays * 86_400_000);

    await client.connect();
    const lock = await client.getMailboxLock(acc.mailbox, { readOnly: true });
    try {
      // Con rango: sólo ese periodo (BEFORE excluye el día, por eso +1). Los ya importados se saltan igual
      const query = range ? { since: imapDay(range.from), before: imapDay(range.to, 1) } : { since };
      const uids = (await client.search(query, { uid: true })) || [];
      if (uids.length) {
        const envelopes = await client.fetchAll(uids, { uid: true, envelope: true }, { uid: true });
        const ids = envelopes.map((e) => e.envelope?.messageId || `uid:${acc.address}:${acc.mailbox}:${e.uid}`);
        const known = new Set(
          (
            await db
              .select({ m: emailMessages.messageId })
              .from(emailMessages)
              .where(and(eq(emailMessages.userId, userId), inArray(emailMessages.messageId, ids)))
          ).map((r) => r.m),
        );
        const newUids = envelopes.filter((_, i) => !known.has(ids[i])).map((e) => e.uid);

        if (newUids.length) {
          const full = await client.fetchAll(newUids, { uid: true, envelope: true, source: true, internalDate: true }, { uid: true });
          for (const m of full) {
            result.fetched++;
            const messageId = m.envelope?.messageId || `uid:${acc.address}:${acc.mailbox}:${m.uid}`;
            try {
              const parsed = await simpleParser(m.source as Buffer);
              const rawText = parsed.text?.trim() ? parsed.text : parsed.html ? htmlToText(parsed.html) : "";
              const from = parsed.from?.value.map((v) => `${v.name ?? ""} <${v.address ?? ""}>`).join(", ") ?? "";
              const receivedAt = parsed.date ?? (m.internalDate ? new Date(m.internalDate) : new Date());
              const [inserted] = await db
                .insert(emailMessages)
                .values({
                  userId,
                  messageId,
                  emailAccountId: acc.id,
                  mailbox: acc.mailbox,
                  uid: m.uid,
                  fromAddress: from,
                  subject: parsed.subject ?? "",
                  receivedAt,
                  body: normalizeText(rawText).slice(0, MAX_BODY),
                  status: "unmatched",
                })
                .onConflictDoNothing({ target: [emailMessages.userId, emailMessages.messageId] })
                .returning({ id: emailMessages.id });
              if (!inserted) continue;
              const status = await processMessage(inserted.id);
              if (status === "parsed") result.created++;
              else if (status === "unmatched") result.unmatched++;
              else if (status === "ignored" || status === "duplicate") result.ignored++;
              else result.errors++;
            } catch (err) {
              result.errors++;
              console.error(`[email-sync] ${acc.address} error procesando`, messageId, err);
            }
          }
        }
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err) {
    result.ok = false;
    result.message = friendlyImapError(err, acc.mailbox, `${acc.host}:${acc.port}`).message;
    console.error(`[email-sync] ${acc.address}:`, result.message);
    try {
      client.close();
    } catch {}
  } finally {
    running.delete(accountId);
  }

  result.finishedAt = new Date().toISOString();
  await db
    .update(emailAccounts)
    // Un rango antiguo no cuenta como sincronización al día
    .set({ lastResult: result, ...(result.ok && !range ? { lastSyncAt: startedAt } : {}) })
    .where(and(eq(emailAccounts.id, accountId), eq(emailAccounts.userId, userId)))
    .catch(() => {});
  if (result.created) console.log(`[email-sync] ${acc.address}: ${result.created} movimientos nuevos`);

  if (again.has(accountId)) {
    again.delete(accountId);
    void syncAccount(accountId);
  }
  return result;
}

type ImapErrorKind = "mailbox" | "auth" | "network" | "dns" | "reset" | "other";

/** Mensaje legible (en el idioma de Ajustes) y tipo de error, para decidir cada cuánto reintentar. */
function friendlyImapError(err: unknown, mailbox: string, host = "imap.gmail.com:993"): { kind: ImapErrorKind; message: string } {
  const s = getT().email.syncStatus;
  const e = (err ?? {}) as { message?: string; responseText?: string; code?: string; authenticationFailed?: boolean };
  const msg = e.message ?? String(err ?? "");
  const response = e.responseText ?? "";
  const text = `${msg} ${response} ${e.code ?? ""}`;
  if (/Mailbox doesn't exist|NONEXISTENT|Unknown Mailbox|No such (folder|mailbox)/i.test(text))
    return { kind: "mailbox", message: fmt(s.mailboxMissing, { mailbox }) };
  if (e.authenticationFailed || /AUTHENTICATIONFAILED|Invalid credentials|authenticat/i.test(text)) return { kind: "auth", message: s.authFailed };
  if (/ETIMEDOUT|ECONNREFUSED|ENETUNREACH|EHOSTUNREACH/i.test(text))
    return { kind: "network", message: fmt(s.network, { host, code: e.code ?? "timeout" }) };
  if (/ENOTFOUND|EAI_AGAIN/i.test(text)) return { kind: "dns", message: fmt(s.dns, { host }) };
  if (/ECONNRESET|EPIPE/i.test(text)) return { kind: "reset", message: s.reset };
  return { kind: "other", message: response || msg || e.code || s.unknown };
}

// ---------------------------------------------------------------------------
// Watchers en tiempo real (IMAP IDLE), uno por cuenta de correo: el servidor avisa
// al instante cuando entra un correo en la etiqueta y se sincroniza esa cuenta.
// ---------------------------------------------------------------------------

function entry(id: number) {
  let w = watchers.get(id);
  if (!w) watchers.set(id, (w = { client: null, status: { state: "off" }, stopped: true, generation: 0 }));
  return w;
}

export function getWatcherStatus(accountId: number): WatcherStatus {
  return watchers.get(accountId)?.status ?? { state: "off" };
}

async function stopWatcher(id: number) {
  const w = entry(id);
  w.stopped = true;
  w.generation++;
  if (w.retry) clearTimeout(w.retry);
  const c = w.client;
  w.client = null;
  w.status = { state: "off" };
  if (c) {
    try {
      await c.logout();
    } catch {
      try {
        c.close();
      } catch {}
    }
  }
}

/** (Re)inicia el watcher de una cuenta con su configuración actual (o lo detiene si ya no existe). */
export async function restartWatcher(id: number) {
  await stopWatcher(id);
  await asOwner(
    id,
    async () => {
      const acc = findAccount(id);
      if (!acc || !acc.enabled || !acc.pass || !acc.realtime) return;
      const w = entry(id);
      w.stopped = false;
      void connectWatcher(id, w.generation, 0);
    },
    undefined,
  );
}

/** Sincroniza los watchers con las cuentas de todos los usuarios (detiene los de cuentas eliminadas). */
export async function restartAllWatchers() {
  const ids = new Set((await db.select({ id: emailAccounts.id }).from(emailAccounts)).map((a) => a.id));
  for (const id of watchers.keys()) if (!ids.has(id)) await stopWatcher(id);
  for (const id of ids) await restartWatcher(id);
}

/** Detiene los watchers de un usuario (al borrar su cuenta). */
export async function stopWatchers(accountIds: number[]) {
  for (const id of accountIds) await stopWatcher(id);
}

function connectWatcher(id: number, generation: number, attempt: number) {
  return asOwner(id, () => connectWatcherAsOwner(id, generation, attempt), undefined);
}

async function connectWatcherAsOwner(id: number, generation: number, attempt: number) {
  const w = entry(id);
  const acc = findAccount(id);
  if (!acc || w.stopped || generation !== w.generation) return;
  w.status = { state: "connecting" };
  const client = newClient(acc, true);
  w.client = client;

  let debounce: ReturnType<typeof setTimeout> | undefined;
  client.on("exists", (data: { count: number; prevCount: number }) => {
    if (data.count <= data.prevCount) return;
    // Agrupa varios avisos seguidos en una sola sincronización
    clearTimeout(debounce);
    debounce = setTimeout(() => void syncAccount(id), 1500);
  });
  client.on("error", (err: Error) => {
    console.error(`[email-watcher] ${acc.address} error`, err.message);
  });
  client.on("close", () => {
    if (w.stopped || generation !== w.generation || w.client !== client || w.status.state !== "watching") return;
    w.status = { state: "connecting", message: getT().email.syncStatus.reconnecting };
    scheduleReconnect(id, generation, 0);
  });

  try {
    await client.connect();
    await client.mailboxOpen(acc.mailbox, { readOnly: true });
    w.status = { state: "watching", since: new Date().toISOString() };
    console.log(`[email-watcher] ${acc.address}: escuchando "${acc.mailbox}" en tiempo real`);
    // Al conectar (o reconectar) se recupera lo que haya entrado mientras tanto
    void syncAccount(id);
  } catch (err) {
    const { kind, message } = friendlyImapError(err, acc.mailbox, `${acc.host}:${acc.port}`);
    w.status = { state: "error", message };
    console.error(`[email-watcher] ${acc.address}:`, message);
    try {
      client.close();
    } catch {}
    // Credenciales malas o etiqueta inexistente: no insistir agresivamente
    const slowMs = kind === "auth" ? 15 * 60_000 : kind === "mailbox" ? 2 * 60_000 : undefined;
    scheduleReconnect(id, generation, attempt + 1, slowMs);
  }
}

function scheduleReconnect(id: number, generation: number, attempt: number, fixedDelayMs?: number) {
  const w = entry(id);
  if (w.stopped || generation !== w.generation) return;
  if (w.retry) clearTimeout(w.retry);
  const delay = fixedDelayMs ?? Math.min(5 * 60_000, 5_000 * 2 ** Math.min(attempt, 6));
  w.retry = setTimeout(() => void connectWatcher(id, generation, attempt), delay);
}
