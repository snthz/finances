"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { accounts, budgetPlans, categories, currencies, emailAccounts, emailMessages, emailRules, notifications, scheduledPayments, transactions, users } from "@/db/schema";
import { isValidAvatar } from "@/components/avatar";
import { isLocale } from "@/i18n/config";
import { fmt, getT, plural } from "@/i18n/server";
import { removeAiKey, setAiModel, storeAiKey } from "@/lib/ai";
import { hashPassword, requireAuth, setLangCookie, verifyPassword } from "@/lib/auth";
import { uid } from "@/lib/context";
import { catalogFor, initialAliases } from "@/lib/currency-catalog";
import { restartWatcher, stopWatchers, syncAccount, waitForSync, type SyncResult } from "@/lib/email/sync";
import { changeBaseCurrency, refreshRates } from "@/lib/rates";
import { seedUser } from "@/lib/seed";
import { appSettings, defaultImapHost, encrypt, isAiProvider, KEYS, reloadSettings, setSetting } from "@/lib/settings";
import type { FormState } from "./types";

/** Revalida todo el layout (incluye el cambio de idioma) y devuelve el mensaje o el estado dado. */
const done = (result: string | FormState): FormState => {
  revalidatePath("/", "layout");
  return typeof result === "string" ? { ok: true, message: result } : result;
};

const isUniqueViolation = (err: unknown) => String((err as { cause?: { code?: string } })?.cause?.code ?? "") === "23505";

/** La cuenta de correo existe y es del usuario actual. */
const ownsEmailAccount = (id: number | null | undefined) => Boolean(id) && appSettings().emailAccounts.some((a) => a.id === id);

export async function saveProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAuth();
  const t = getT();
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(80),
      email: z.email(t.settings.errors.invalidEmail).trim().toLowerCase(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.common.errors.invalidData };
  try {
    await db.update(users).set(parsed.data).where(eq(users.id, user.id));
  } catch (err) {
    // El email es único entre todas las cuentas
    if (isUniqueViolation(err)) return { error: t.auth.errors.emailTaken };
    throw err;
  }
  return done(t.settings.actions.profileUpdated);
}

/** "" = iniciales, "icon:<nombre>" o data URL de la foto */
export async function saveAvatar(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAuth();
  const t = getT();
  const avatar = String(formData.get("avatar") ?? "");
  if (avatar && !isValidAvatar(avatar)) return { error: t.settings.errors.invalidAvatar };
  await db.update(users).set({ avatar: avatar || null }).where(eq(users.id, user.id));
  return done(t.settings.actions.avatarUpdated);
}

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAuth();
  const t = getT();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  // Las cuentas creadas con Google no tienen contraseña: pueden definir una sin la actual
  if (user.passwordHash && !(await verifyPassword(current, user.passwordHash))) return { error: t.settings.errors.wrongCurrentPassword };
  if (next.length < 8) return { error: t.settings.errors.newPasswordTooShort };
  if (next !== formData.get("confirm")) return { error: t.settings.errors.passwordsMismatch };
  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, user.id));
  return done(t.settings.actions.passwordUpdated);
}

export async function saveGeneral(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  const timezone = String(formData.get("timezone") ?? "");
  const base = String(formData.get("baseCurrency") ?? "").toUpperCase();
  const language = formData.get("language");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    return { error: getT().settings.errors.invalidTimezone };
  }
  await setSetting(KEYS.timezone, timezone);
  if (isLocale(language) && language !== appSettings().locale) {
    await setSetting(KEYS.language, language);
    await setLangCookie(language);
  }
  await reloadSettings();
  // getT() después de recargar: los mensajes salen ya en el idioma nuevo
  const t = getT();
  if (base && base !== appSettings().baseCurrency) {
    if (!appSettings().currencies.some((c) => c.code === base)) return done({ error: t.settings.errors.addCurrencyFirst });
    const r = await changeBaseCurrency(base);
    if (!r.ok) return done({ error: fmt(t.settings.errors.baseChangedBut, { error: r.message ?? "" }) });
  }
  return done(t.settings.actions.settingsSaved);
}

// ---------- Monedas ----------

const currencySchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, { error: () => getT().settings.errors.currencyCode }),
  name: z.string().trim().max(60).optional(),
  symbol: z.string().trim().max(8).optional(),
  aliases: z.string().optional(),
  rateMode: z.enum(["auto", "manual"]).default("auto"),
  rate: z.string().optional(),
});

export async function saveCurrency(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  const t = getT();
  const raw = Object.fromEntries(formData);
  const parsed = currencySchema.safeParse({ ...raw, code: String(raw.customCode || raw.code || "") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.common.errors.invalidData };
  const d = parsed.data;
  const base = appSettings().baseCurrency;
  const cat = catalogFor(appSettings().locale).find((c) => c.code === d.code);
  const aliases = d.aliases?.trim()
    ? Array.from(new Set(d.aliases.split(",").map((a) => a.trim()).filter(Boolean)))
    : initialAliases(d.code, base);

  let rate: string | null | undefined = undefined;
  const isBase = d.code === base;
  if (isBase) rate = "1";
  else if (d.rateMode === "manual") {
    const n = Number(String(d.rate ?? "").replace(/,/g, ""));
    if (!Number.isFinite(n) || n <= 0) return { error: fmt(t.settings.errors.rateRequired, { code: d.code, base }) };
    rate = n.toFixed(10);
  }

  const values = {
    name: d.name || cat?.name || d.code,
    symbol: d.symbol || cat?.symbol || d.code,
    aliases,
    autoRate: isBase ? false : d.rateMode === "auto",
    ...(rate !== undefined ? { rate, rateUpdatedAt: new Date() } : {}),
  };
  await db
    .insert(currencies)
    .values({ userId: uid(), code: d.code, ...values })
    .onConflictDoUpdate({ target: [currencies.userId, currencies.code], set: values });
  await reloadSettings();

  if (!isBase && d.rateMode === "auto") {
    const r = await refreshRates();
    if (!r.ok) return { error: fmt(t.settings.errors.currencySavedRatesFailed, { code: d.code, error: r.message ?? "" }) };
    if (r.missing.includes(d.code)) return { error: fmt(t.settings.errors.currencySavedNoAutoRate, { code: d.code }) };
  }
  revalidatePath("/", "layout");
  redirect("/settings?tab=monedas");
}

export async function deleteCurrency(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  const t = getT();
  const code = String(formData.get("code") ?? "");
  if (code === appSettings().baseCurrency) return { error: t.settings.errors.cantDeleteBase };
  const userId = uid();
  const [used] = await db.execute<{ n: number }>(
    sql`select (select count(*) from ${transactions} where currency = ${code} and user_id = ${userId}) + (select count(*) from ${accounts} where currency = ${code} and user_id = ${userId}) as n`,
  );
  if (Number(used?.n) > 0) return { error: fmt(t.settings.errors.currencyInUse, { code }) };
  await db.delete(currencies).where(and(eq(currencies.userId, userId), eq(currencies.code, code)));
  await reloadSettings();
  revalidatePath("/", "layout");
  redirect("/settings?tab=monedas");
}

export async function updateRatesNow(_prev: FormState, _formData: FormData): Promise<FormState> {
  await requireAuth();
  const r = await refreshRates();
  if (!r.ok) return { error: r.message };
  const t = getT();
  return done(
    plural(r.updated, t.settings.actions.ratesUpdated) +
      (r.missing.length ? fmt(t.settings.actions.ratesMissing, { codes: r.missing.join(", ") }) : ""),
  );
}

// ---------- Cuentas de correo ----------

const emailAccountSchema = z.object({
  id: z.preprocess((v) => (v ? Number(v) : null), z.number().int().positive().nullable()),
  label: z.string().trim().max(60).optional(),
  // Acepta cualquier usuario@servidor (algunos servidores IMAP usan dominios internos)
  address: z.string().trim().toLowerCase().regex(/^[^\s@]+@[^\s@]+$/, { error: () => getT().settings.errors.invalidAddress }),
  pass: z.string().optional(),
  mailbox: z.string().trim().min(1, { error: () => getT().settings.errors.mailboxRequired }),
  initialDays: z.coerce.number().int().min(1).max(3650).catch(60),
  realtime: z.preprocess((v) => v === "on", z.boolean()),
  enabled: z.preprocess((v) => v === "on", z.boolean()),
  host: z.string().trim().optional(),
  port: z.coerce.number().int().min(1).max(65535).optional().catch(undefined),
});

export async function saveEmailAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  const t = getT();
  const parsed = emailAccountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.common.errors.invalidData };
  const d = parsed.data;
  const pass = (d.pass ?? "").replace(/\s+/g, "");
  const def = defaultImapHost();
  const values = {
    label: d.label || d.address.split("@")[0],
    address: d.address,
    mailbox: d.mailbox,
    initialDays: d.initialDays,
    realtime: d.realtime,
    enabled: d.enabled,
    host: d.host || def.host,
    port: d.port ?? def.port,
    ...(pass ? { passwordEnc: await encrypt(pass) } : {}),
  };

  let id = d.id;
  const userId = uid();
  try {
    if (id) {
      // Sólo se editan las cuentas propias
      const prev = appSettings().emailAccounts.find((a) => a.id === id);
      if (!prev) return { error: t.common.errors.invalidData };
      // Etiqueta nueva = primera importación otra vez (los repetidos se descartan por Message-ID)
      const relabeled = prev.mailbox !== d.mailbox ? { lastSyncAt: null } : {};
      await db
        .update(emailAccounts)
        .set({ ...values, ...relabeled })
        .where(and(eq(emailAccounts.id, id), eq(emailAccounts.userId, userId)));
    } else {
      if (!pass) return { error: t.settings.errors.appPasswordRequired };
      [{ id }] = await db
        .insert(emailAccounts)
        .values({ ...values, userId, passwordEnc: await encrypt(pass) })
        .returning({ id: emailAccounts.id });
    }
  } catch (err) {
    if (isUniqueViolation(err)) return { error: t.settings.errors.emailAlreadyConnected };
    throw err;
  }
  await reloadSettings();
  await restartWatcher(id!);
  revalidatePath("/", "layout");
  // El sheet se cierra y la primera sincronización (que prueba la conexión) corre aparte con su propio aviso
  return d.enabled ? { ok: true, data: { syncId: id } } : { ok: true, message: t.settings.actions.saved };
}

/** Cambia la etiqueta que vigila una cuenta (desde el generador de filtros). */
export async function setEmailAccountMailbox(id: number, mailbox: string): Promise<FormState> {
  await requireAuth();
  const label = mailbox.trim();
  const t = getT();
  if (!Number.isInteger(id) || !label || !ownsEmailAccount(id)) return { error: t.common.errors.invalidData };
  // Etiqueta nueva = primera importación otra vez (los repetidos se descartan por Message-ID)
  await db
    .update(emailAccounts)
    .set({ mailbox: label, lastSyncAt: null })
    .where(and(eq(emailAccounts.id, id), eq(emailAccounts.userId, uid())));
  await reloadSettings();
  await restartWatcher(id);
  return done(fmt(t.settings.actions.mailboxChanged, { label }));
}

export async function deleteEmailAccount(formData: FormData) {
  await requireAuth();
  const id = Number(formData.get("id"));
  if (Number.isInteger(id) && ownsEmailAccount(id)) {
    await stopWatchers([id]);
    await db.delete(emailAccounts).where(and(eq(emailAccounts.id, id), eq(emailAccounts.userId, uid())));
  }
  await reloadSettings();
  revalidatePath("/", "layout");
  redirect("/settings?tab=correos");
}

export async function saveSyncInterval(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  const n = Number(formData.get("intervalMinutes"));
  const t = getT();
  if (!Number.isInteger(n) || n < 0 || n > 1440) return { error: t.settings.errors.invalidMinutes };
  await setSetting(KEYS.syncInterval, String(n));
  await reloadSettings();
  return done(t.settings.actions.saved);
}

/** Sincroniza una cuenta y espera el resultado (se llama desde el cliente con un aviso de carga). */
export async function syncEmailAccount(id: number): Promise<FormState> {
  await requireAuth();
  if (!Number.isInteger(id) || !ownsEmailAccount(id)) return { error: getT().common.errors.invalidData };
  let r = await syncAccount(id);
  if (r.busy) {
    // El watcher ya estaba sincronizando (p. ej. al conectar): se espera su resultado
    await waitForSync(id);
    const [row] = await db
      .select({ lastResult: emailAccounts.lastResult })
      .from(emailAccounts)
      .where(and(eq(emailAccounts.id, id), eq(emailAccounts.userId, uid())));
    r = (row?.lastResult as SyncResult | null) ?? r;
  }
  revalidatePath("/", "layout");
  const t = getT();
  if (r.busy) return { ok: true, message: t.settings.actions.syncInBackground };
  if (!r.ok) return { error: fmt(t.settings.errors.connectionFailed, { error: r.message ?? "" }) };
  return {
    ok: true,
    message: `${plural(r.fetched, t.settings.actions.syncEmails)} · ${plural(r.created, t.settings.actions.syncTransactions)}`,
  };
}

// ---------- Zona de peligro ----------

/** Borra el registro de correos importados. Los movimientos que crearon se conservan. */
export async function deleteImportedEmails(_prev: FormState, _formData: FormData): Promise<FormState> {
  await requireAuth();
  const deleted = await db.delete(emailMessages).where(eq(emailMessages.userId, uid())).returning({ id: emailMessages.id });
  return done(plural(deleted.length, getT().settings.actions.emailsDeleted));
}

/**
 * Deja la cuenta como recién creada: borra movimientos, correos, cuentas, categorías, reglas, pagos,
 * presupuestos y notificaciones, y restaura las categorías y reglas por defecto. Conserva el perfil,
 * los ajustes, las monedas, los correos conectados y la clave de IA.
 */
export async function resetAccountData(_prev: FormState, _formData: FormData): Promise<FormState> {
  await requireAuth();
  const userId = uid();
  await db.transaction(async (tx) => {
    await tx.delete(notifications).where(eq(notifications.userId, userId));
    await tx.delete(transactions).where(eq(transactions.userId, userId));
    await tx.delete(emailMessages).where(eq(emailMessages.userId, userId));
    await tx.delete(scheduledPayments).where(eq(scheduledPayments.userId, userId));
    await tx.delete(budgetPlans).where(eq(budgetPlans.userId, userId));
    await tx.delete(emailRules).where(eq(emailRules.userId, userId));
    await tx.delete(accounts).where(eq(accounts.userId, userId));
    await tx.delete(categories).where(eq(categories.userId, userId));
  });
  // Las reglas de bancos conocidos sólo se instalan una vez por versión: se reinicia la marca
  await setSetting(KEYS.presetsVersion, "0");
  await seedUser(userId, appSettings().locale);
  await reloadSettings();
  return done(getT().settings.actions.dataReset);
}

// ---------- IA (clave y modelo de cada usuario) ----------

/** Verifica la clave con el proveedor y la guarda cifrada. Nunca se devuelve al navegador. */
export async function saveAiKey(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  const t = getT();
  const provider = formData.get("provider");
  if (!isAiProvider(provider)) return { error: t.settings.ai.invalidProvider };
  const r = await storeAiKey(provider, String(formData.get("apiKey") ?? ""));
  if (!r.ok) return { error: r.error };
  revalidatePath("/", "layout");
  redirect("/settings?tab=ia");
}

export async function deleteAiKey(_prev: FormState, _formData: FormData): Promise<FormState> {
  await requireAuth();
  await removeAiKey();
  return done(getT().settings.actions.aiKeyRemoved);
}

export async function saveAiModel(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  const r = await setAiModel(String(formData.get("model") ?? ""));
  if (!r.ok) return { error: r.error };
  return done(getT().settings.actions.aiModelSaved);
}
