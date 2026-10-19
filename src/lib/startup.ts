import path from "node:path";
import { asc, eq, isNotNull } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "@/db";
import { CATEGORY_ICONS, DEFAULT_CATEGORY_ICON, EMOJI_TO_ICON } from "@/components/category-icon";
import { categories, emailAccounts, users } from "@/db/schema";
import { DEFAULT_AI_MODELS } from "@/lib/ai-models";
import { uid } from "@/lib/context";
import { restartAllWatchers, syncAccount } from "@/lib/email/sync";
import { runPaymentScheduler } from "@/lib/payments";
import { refreshRates } from "@/lib/rates";
import { installPresets, markLegacyGenericRules } from "@/lib/seed";
import {
  activeEmailAccounts,
  appSettings,
  encrypt,
  getGlobalSetting,
  getSetting,
  GLOBAL_KEYS,
  KEYS,
  runAsUser,
  setGlobalSetting,
  setSetting,
} from "@/lib/settings";

const g = globalThis as unknown as { __financeTicker?: ReturnType<typeof setInterval>; __financeReady?: boolean };

/** Tareas periódicas de un usuario: sincronización de respaldo, tasas de cambio (cada 12 h) y pagos. */
async function tickUser() {
  try {
    const interval = appSettings().syncIntervalMinutes;
    if (interval > 0) {
      const rows = await db
        .select({ id: emailAccounts.id, lastSyncAt: emailAccounts.lastSyncAt })
        .from(emailAccounts)
        .where(eq(emailAccounts.userId, uid()));
      for (const acc of activeEmailAccounts()) {
        const last = rows.find((r) => r.id === acc.id)?.lastSyncAt;
        if (!last || Date.now() - last.getTime() >= interval * 60_000) await syncAccount(acc.id);
      }
    }
    const ratesAt = await getSetting(KEYS.ratesUpdatedAt);
    if (appSettings().currencies.length > 1 && (!ratesAt || Date.now() - new Date(ratesAt).getTime() > 12 * 3600_000)) {
      const r = await refreshRates();
      if (!r.ok) console.warn(`[rates] usuario ${uid()}:`, r.message);
    }
  } catch (err) {
    console.error(`[tick] usuario ${uid()}`, err);
  }
  // Recordatorios y cargos automáticos de pagos programados (se revisa cada 5 min)
  try {
    await runPaymentScheduler();
  } catch (err) {
    console.error(`[payments] usuario ${uid()}`, err);
  }
}

async function tick() {
  try {
    const list = await db.select({ id: users.id }).from(users).where(isNotNull(users.onboardedAt));
    for (const u of list) await runAsUser(u.id, tickUser);
  } catch (err) {
    console.error("[tick]", err);
  }
}

/** Datos de versiones anteriores: íconos emoji, reglas genéricas y presets nuevos para cada usuario. */
async function upgradeData() {
  const cats = await db.select({ id: categories.id, icon: categories.icon }).from(categories);
  for (const c of cats) {
    if (c.icon in CATEGORY_ICONS) continue;
    const icon = EMOJI_TO_ICON[c.icon] ?? EMOJI_TO_ICON[c.icon.replace(/\uFE0F/g, "")] ?? DEFAULT_CATEGORY_ICON;
    await db.update(categories).set({ icon }).where(eq(categories.id, c.id));
  }
  await markLegacyGenericRules();
  const list = await db.select({ id: users.id }).from(users).where(isNotNull(users.onboardedAt));
  for (const u of list) {
    const n = await installPresets(u.id);
    if (n) console.log(`[startup] usuario ${u.id}: ${n} reglas de bancos instaladas`);
  }
}

/**
 * Antes la clave de IA era una variable de entorno (ANTHROPIC_API_KEY) de la instancia. Ahora cada usuario
 * pone la suya; la del entorno se le asigna una sola vez al primer usuario para no perder la configuración.
 */
async function importEnvAiKey() {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key || (await getGlobalSetting(GLOBAL_KEYS.envAiImported))) return;
  const [first] = await db.select({ id: users.id }).from(users).orderBy(asc(users.id)).limit(1);
  if (!first) return;
  if (!(await getSetting(KEYS.aiKey, first.id))) {
    await setSetting(KEYS.aiProvider, "anthropic", first.id);
    await setSetting(KEYS.aiKey, await encrypt(key), first.id);
    await setSetting(KEYS.aiModel, DEFAULT_AI_MODELS.anthropic, first.id);
    console.log(`[startup] clave de IA del entorno asignada al usuario ${first.id}`);
  }
  await setGlobalSetting(GLOBAL_KEYS.envAiImported, new Date().toISOString());
}

async function init(attempt = 1): Promise<void> {
  try {
    const migrationsFolder = process.env.MIGRATIONS_DIR || path.join(process.cwd(), "drizzle");
    await migrate(db, { migrationsFolder });
    await upgradeData();
    await importEnvAiKey();
    g.__financeReady = true;
    console.log("[startup] base de datos lista");
  } catch (err) {
    const code = (err as { cause?: { code?: string } })?.cause?.code ?? (err as { code?: string })?.code;
    console.error(
      `[startup] no se pudo preparar la base de datos (intento ${attempt})${code ? `: ${code}` : ""}.` +
        (code === "ECONNREFUSED" ? " ¿Está corriendo Postgres? En local: bun run db:up" : ""),
    );
    if (code !== "ECONNREFUSED" && code !== "ENOTFOUND" && code !== "57P03") console.error(err);
    // Reintenta sin tumbar el servidor
    await new Promise((r) => setTimeout(r, Math.min(30_000, 2_000 * attempt)));
    return init(attempt + 1);
  }

  await restartAllWatchers();
  if (!g.__financeTicker) {
    g.__financeTicker = setInterval(() => void tick(), 60_000);
    g.__financeTicker.unref?.();
    setTimeout(() => void tick(), 15_000);
  }
}

export async function startup() {
  if (!process.env.DATABASE_URL) {
    console.error("[startup] Falta la variable DATABASE_URL");
    return;
  }
  // No bloquea el arranque del servidor: si la BD tarda, se reintenta en segundo plano
  void init();
}

export function isReady() {
  return Boolean(g.__financeReady);
}
