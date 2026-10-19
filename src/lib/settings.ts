import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { currencies, emailAccounts, settings as globalSettings, userSettings, type Currency } from "@/db/schema";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";
import { runInScope, uid } from "./context";

// Ajustes de cada usuario (tabla `user_settings`) con caché en memoria por usuario (un solo proceso).
// appSettings() devuelve los del usuario del contexto actual (ver lib/context.ts).
// La tabla `settings` queda sólo para valores globales de la instancia (secreto de sesiones).

export type CurrencyInfo = { code: string; name: string; symbol: string; aliases: string[]; rate: number | null; autoRate: boolean; rateUpdatedAt: Date | null };

export type EmailAccountInfo = {
  id: number;
  label: string;
  address: string;
  host: string;
  port: number;
  /** Contraseña descifrada ("" si no se pudo descifrar) */
  pass: string;
  mailbox: string;
  realtime: boolean;
  initialDays: number;
  enabled: boolean;
};

export const AI_PROVIDERS = ["anthropic", "openai"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];
export const isAiProvider = (v: unknown): v is AiProvider => typeof v === "string" && (AI_PROVIDERS as readonly string[]).includes(v);

export type AiSettings = {
  provider: AiProvider | null;
  /** Clave descifrada: sólo en el servidor, nunca se envía al navegador */
  apiKey: string;
  model: string;
  /** Últimos 4 caracteres de la clave, para mostrar "•••• abcd" */
  keyHint: string;
  /** Modelos disponibles para esa clave (consultados al guardarla) */
  models: string[];
};

export type AppSettings = {
  baseCurrency: string;
  timezone: string;
  /** Idioma de la interfaz (inglés por defecto, se cambia en Ajustes) */
  locale: Locale;
  currencies: CurrencyInfo[];
  emailAccounts: EmailAccountInfo[];
  /** Sincronización periódica de respaldo (el watcher IDLE es en tiempo real) */
  syncIntervalMinutes: number;
  /** Crear reglas con IA automáticamente para correos no reconocidos */
  aiAutoRules: boolean;
  ai: AiSettings;
};

/** Claves por usuario (tabla user_settings) */
export const KEYS = {
  baseCurrency: "app.baseCurrency",
  timezone: "app.timezone",
  language: "app.language",
  syncInterval: "imap.intervalMinutes",
  aiAutoRules: "ai.autoRules",
  aiProvider: "ai.provider",
  aiKey: "ai.key",
  aiModel: "ai.model",
  aiModels: "ai.models",
  presetsVersion: "rules.presetsVersion",
  ratesUpdatedAt: "rates.updatedAt",
} as const;

/** Claves globales (tabla settings) */
export const GLOBAL_KEYS = {
  secret: "auth.secret",
  envAiImported: "ai.envKeyImported",
} as const;

const g = globalThis as unknown as { __financeUserSettings?: Map<number, AppSettings>; __financeSecret?: string };
const cache = (g.__financeUserSettings ??= new Map<number, AppSettings>());

function defaults(): Omit<AppSettings, "currencies" | "emailAccounts"> {
  return {
    baseCurrency: (process.env.DEFAULT_CURRENCY || "USD").toUpperCase(),
    timezone: process.env.TZ || "UTC",
    locale: DEFAULT_LOCALE,
    syncIntervalMinutes: Number(process.env.EMAIL_SYNC_INTERVAL_MINUTES || 30),
    aiAutoRules: true,
    ai: { provider: null, apiKey: "", model: "", keyHint: "", models: [] },
  };
}

/** Ajustes del usuario actual (síncrono). Se cargan con requireAuth()/initScope() o runAsUser(). */
export function appSettings(): AppSettings {
  const id = uid();
  const s = cache.get(id);
  if (!s) throw new Error(`Ajustes del usuario ${id} sin cargar (falta loadSettings)`);
  return s;
}

/** Carga (o devuelve de la caché) los ajustes de un usuario. */
export async function loadSettings(userId: number) {
  return cache.get(userId) ?? reloadSettings(userId);
}

export function forgetSettings(userId: number) {
  cache.delete(userId);
}

/** Ejecuta `fn` como ese usuario (tareas de fondo: watchers, cron, pagos). */
export async function runAsUser<T>(userId: number, fn: () => Promise<T>): Promise<T> {
  const s = await loadSettings(userId);
  return runInScope({ userId, locale: s.locale }, fn);
}

// ---------- Ajustes por usuario ----------

export async function getSetting(key: string, userId = uid()) {
  const row = await db.query.userSettings.findFirst({ where: and(eq(userSettings.userId, userId), eq(userSettings.key, key)) });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string, userId = uid()) {
  await db
    .insert(userSettings)
    .values({ userId, key, value })
    .onConflictDoUpdate({ target: [userSettings.userId, userSettings.key], set: { value, updatedAt: new Date() } });
}

export async function deleteSetting(key: string, userId = uid()) {
  await db.delete(userSettings).where(and(eq(userSettings.userId, userId), eq(userSettings.key, key)));
}

// ---------- Ajustes globales ----------

export async function getGlobalSetting(key: string) {
  const row = await db.query.settings.findFirst({ where: eq(globalSettings.key, key) });
  return row?.value ?? null;
}

export async function setGlobalSetting(key: string, value: string) {
  await db
    .insert(globalSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: globalSettings.key, set: { value, updatedAt: new Date() } });
}

/** Secreto para firmar sesiones y cifrar contraseñas de correo y claves de IA. Se genera la primera vez. */
export async function getSecret() {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32) return process.env.SESSION_SECRET;
  if (g.__financeSecret) return g.__financeSecret;
  let secret = await getGlobalSetting(GLOBAL_KEYS.secret);
  if (!secret) {
    secret = randomBytes(48).toString("base64url");
    await setGlobalSetting(GLOBAL_KEYS.secret, secret);
  }
  g.__financeSecret = secret;
  return secret;
}

async function cipherKey() {
  return createHash("sha256").update(`${await getSecret()}:imap`).digest();
}

/** AES-256-GCM con una clave derivada del secreto de la instancia. */
export async function encrypt(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", await cipherKey(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1:${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${data.toString("base64")}`;
}

export async function decrypt(value: string) {
  const [v, iv, tag, data] = value.split(":");
  if (v !== "v1") return null;
  try {
    const d = createDecipheriv("aes-256-gcm", await cipherKey(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

function toInfo(c: Currency): CurrencyInfo {
  return {
    code: c.code,
    name: c.name,
    symbol: c.symbol,
    aliases: c.aliases,
    rate: c.rate === null ? null : Number(c.rate),
    autoRate: c.autoRate,
    rateUpdatedAt: c.rateUpdatedAt,
  };
}

/** Servidor IMAP por defecto (sobreescribible por entorno, útil para pruebas). */
export function defaultImapHost() {
  return { host: process.env.IMAP_HOST || "imap.gmail.com", port: Number(process.env.IMAP_PORT || 993) };
}

function parseModels(raw: string | undefined) {
  try {
    const v = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Recarga la caché de un usuario desde la base de datos. Llamar tras cualquier cambio de sus ajustes. */
export async function reloadSettings(userId = uid()) {
  const d = defaults();
  const [rows, curr, accs] = await Promise.all([
    db.select().from(userSettings).where(eq(userSettings.userId, userId)),
    db.select().from(currencies).where(eq(currencies.userId, userId)).orderBy(asc(currencies.code)),
    db.select().from(emailAccounts).where(eq(emailAccounts.userId, userId)).orderBy(asc(emailAccounts.id)),
  ]);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const lang = map.get(KEYS.language);
  const provider = map.get(KEYS.aiProvider);
  const keyEnc = map.get(KEYS.aiKey);
  const apiKey = keyEnc ? ((await decrypt(keyEnc)) ?? "") : "";

  const s: AppSettings = {
    baseCurrency: map.get(KEYS.baseCurrency) ?? d.baseCurrency,
    timezone: map.get(KEYS.timezone) ?? d.timezone,
    locale: isLocale(lang) ? lang : d.locale,
    currencies: curr.map(toInfo),
    emailAccounts: await Promise.all(
      accs.map(async (a) => ({
        id: a.id,
        label: a.label,
        address: a.address,
        host: a.host,
        port: a.port,
        pass: (await decrypt(a.passwordEnc)) ?? "",
        mailbox: a.mailbox,
        realtime: a.realtime,
        initialDays: a.initialDays,
        enabled: a.enabled,
      })),
    ),
    syncIntervalMinutes: Number(map.get(KEYS.syncInterval) ?? d.syncIntervalMinutes),
    aiAutoRules: (map.get(KEYS.aiAutoRules) ?? "true") === "true",
    ai: {
      provider: isAiProvider(provider) && apiKey ? provider : null,
      apiKey,
      model: map.get(KEYS.aiModel) ?? "",
      keyHint: apiKey ? apiKey.slice(-4) : "",
      models: parseModels(map.get(KEYS.aiModels)),
    },
  };
  cache.set(userId, s);
  return s;
}

/** Cuentas de correo del usuario actual listas para conectarse */
export function activeEmailAccounts() {
  return appSettings().emailAccounts.filter((a) => a.enabled && a.pass);
}

export function imapConfigured() {
  return activeEmailAccounts().length > 0;
}

export function currencyInfo(code: string): CurrencyInfo | undefined {
  return appSettings().currencies.find((c) => c.code === code);
}
