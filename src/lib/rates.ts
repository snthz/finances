import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { currencies } from "@/db/schema";
import { fmt, getT } from "@/i18n/server";
import { uid } from "./context";
import { appSettings, KEYS, reloadSettings, setSetting } from "./settings";

// API pública y gratuita, sin clave. Sólo se envía el código de la moneda base.
const RATES_URL = "https://open.er-api.com/v6/latest/";

export type RatesResult = { ok: boolean; updated: number; missing: string[]; message?: string };

/** Actualiza las tasas de las monedas en modo automático respecto a la moneda base. */
export async function refreshRates(): Promise<RatesResult> {
  const userId = uid();
  const base = appSettings().baseCurrency;
  await db
    .update(currencies)
    .set({ rate: "1", rateUpdatedAt: new Date() })
    .where(and(eq(currencies.userId, userId), eq(currencies.code, base)));
  const list = await db
    .select()
    .from(currencies)
    .where(and(eq(currencies.userId, userId), eq(currencies.autoRate, true), ne(currencies.code, base)));
  if (list.length === 0) {
    await reloadSettings();
    return { ok: true, updated: 0, missing: [] };
  }
  try {
    const res = await fetch(`${RATES_URL}${base}`, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
    const json = (await res.json()) as { result?: string; rates?: Record<string, number>; "error-type"?: string };
    if (json.result !== "success" || !json.rates) throw new Error(json["error-type"] ?? `HTTP ${res.status}`);
    let updated = 0;
    const missing: string[] = [];
    for (const c of list) {
      const perBase = json.rates[c.code]; // 1 base = perBase c
      if (!perBase) {
        missing.push(c.code);
        continue;
      }
      await db
        .update(currencies)
        .set({ rate: (1 / perBase).toFixed(10), rateUpdatedAt: new Date() })
        .where(and(eq(currencies.userId, userId), eq(currencies.code, c.code)));
      updated++;
    }
    await setSetting(KEYS.ratesUpdatedAt, new Date().toISOString());
    await reloadSettings();
    return { ok: true, updated, missing };
  } catch (err) {
    await reloadSettings();
    return {
      ok: false,
      updated: 0,
      missing: [],
      message: fmt(getT().payments.errors.ratesFetchFailed, { error: err instanceof Error ? err.message : String(err) }),
    };
  }
}

/** Cambia la moneda base y re-expresa las tasas manuales en la nueva base. */
export async function changeBaseCurrency(newBase: string) {
  const userId = uid();
  const list = await db.select().from(currencies).where(eq(currencies.userId, userId));
  const target = list.find((c) => c.code === newBase);
  const factor = target?.rate ? Number(target.rate) : null; // valor de newBase en la base anterior
  for (const c of list) {
    let rate: string | null = null;
    if (c.code === newBase) rate = "1";
    else if (c.rate && factor) rate = (Number(c.rate) / factor).toFixed(10);
    await db
      .update(currencies)
      .set({ rate })
      .where(and(eq(currencies.userId, userId), eq(currencies.code, c.code)));
  }
  await setSetting(KEYS.baseCurrency, newBase);
  await reloadSettings();
  return refreshRates();
}
