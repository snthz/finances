"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { currencies, emailAccounts, users } from "@/db/schema";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";
import { getLocale, getT } from "@/i18n/server";
import { storeAiKey } from "@/lib/ai";
import { endSession, hashPassword, initScope, LANG_COOKIE, requireAuth, setLangCookie, startSession, verifyPassword } from "@/lib/auth";
import { uid } from "@/lib/context";
import { catalogFor, initialAliases } from "@/lib/currency-catalog";
import { stopWatchers } from "@/lib/email/sync";
import { refreshRates } from "@/lib/rates";
import { seedUser } from "@/lib/seed";
import { forgetSettings, isAiProvider, KEYS, reloadSettings, setSetting } from "@/lib/settings";
import type { FormState } from "./types";

const registerSchema = z
  .object({
    name: z.string().trim().min(1, { error: () => getT().auth.errors.nameRequired }).max(80),
    email: z.email({ error: () => getT().auth.errors.invalidEmail }).trim().toLowerCase(),
    password: z.string().min(8, { error: () => getT().auth.errors.passwordTooShort }).max(200),
    confirm: z.string(),
    terms: z.literal("on", { error: () => getT().auth.errors.termsRequired }),
  })
  .refine((d) => d.password === d.confirm, { error: () => getT().auth.errors.passwordsMismatch, path: ["confirm"] });

/** Idioma del visitante (cookie) para guardarlo como el de la cuenta nueva. */
async function visitorLocale(): Promise<Locale> {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

/** Crea la cuenta (registro abierto). La moneda y la zona horaria se eligen después, en /onboarding. */
export async function register(_prev: FormState, formData: FormData): Promise<FormState> {
  await initScope();
  const t = getT();
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.common.errors.invalidData };
  const d = parsed.data;

  const existing = await db.query.users.findFirst({ where: eq(users.email, d.email) });
  if (existing) return { error: t.auth.errors.emailTaken };

  const [user] = await db
    .insert(users)
    .values({ name: d.name, email: d.email, passwordHash: await hashPassword(d.password) })
    .onConflictDoNothing()
    .returning({ id: users.id });
  if (!user) return { error: t.auth.errors.emailTaken };
  await setSetting(KEYS.language, await visitorLocale(), user.id);
  await startSession(user.id);
  redirect("/onboarding");
}

const onboardingSchema = z.object({
  baseCurrency: z.string().trim().length(3, { error: () => getT().auth.errors.baseCurrencyRequired }).toUpperCase(),
  timezone: z.string().min(1),
  language: z.string().optional(),
  extraCurrencies: z.array(z.string().length(3)).default([]),
  aiProvider: z.string().optional(),
  aiKey: z.string().trim().max(400).optional(),
});

/** Configuración inicial: moneda principal, zona horaria, idioma y (opcional) clave de IA. */
export async function completeOnboarding(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAuth({ onboarding: true });
  const t = getT();
  const parsed = onboardingSchema.safeParse({
    ...Object.fromEntries(formData),
    extraCurrencies: formData.getAll("extraCurrencies").map(String),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.common.errors.invalidData };
  const d = parsed.data;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: d.timezone });
  } catch {
    return { error: t.auth.errors.invalidTimezone };
  }

  const userId = uid();
  const locale = isLocale(d.language) ? d.language : getLocale();
  await setSetting(KEYS.language, locale);
  await setSetting(KEYS.baseCurrency, d.baseCurrency);
  await setSetting(KEYS.timezone, d.timezone);
  const catalog = catalogFor(locale);
  const codes = Array.from(new Set([d.baseCurrency, ...d.extraCurrencies.map((c) => c.toUpperCase())]));
  for (const code of codes) {
    const cat = catalog.find((c) => c.code === code);
    await db
      .insert(currencies)
      .values({
        userId,
        code,
        name: cat?.name ?? code,
        symbol: cat?.symbol ?? code,
        aliases: initialAliases(code, d.baseCurrency),
        rate: code === d.baseCurrency ? "1" : null,
      })
      .onConflictDoNothing();
  }
  await seedUser(userId, locale);
  await reloadSettings();

  // La clave de IA es opcional: si falla la verificación se avisa, pero la cuenta queda configurada
  let aiError: string | null = null;
  if (d.aiKey && isAiProvider(d.aiProvider)) {
    const r = await storeAiKey(d.aiProvider, d.aiKey);
    if (!r.ok) aiError = r.error;
  }

  if (!user.onboardedAt) await db.update(users).set({ onboardedAt: new Date() }).where(eq(users.id, userId));
  await setLangCookie(locale);
  await refreshRates().catch(() => {});
  if (aiError) redirect(`/settings?tab=ia&aiError=${encodeURIComponent(aiError)}`);
  redirect("/");
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string(),
});

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  await initScope();
  const { email, password } = loginSchema.parse(Object.fromEntries(formData));
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (user && !user.passwordHash && user.googleId) return { error: getT().auth.errors.useGoogle };
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    // Frena intentos de fuerza bruta
    await new Promise((r) => setTimeout(r, 1500));
    return { error: getT().auth.errors.wrongCredentials };
  }
  await startSession(user.id);
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

/** Cambia el idioma desde las páginas públicas (y en la cuenta, si hay sesión). */
export async function setLanguage(locale: string) {
  if (!isLocale(locale)) return;
  const user = await initScope();
  await setLangCookie(locale);
  if (user) {
    await setSetting(KEYS.language, locale);
    await reloadSettings();
  }
}

/** Borra la cuenta y todos sus datos (las tablas tienen ON DELETE CASCADE). */
export async function deleteAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAuth({ onboarding: true });
  if (String(formData.get("confirm") ?? "").trim().toLowerCase() !== user.email.toLowerCase()) {
    return { error: getT().auth.errors.deleteConfirm };
  }
  const accs = await db.select({ id: emailAccounts.id }).from(emailAccounts).where(eq(emailAccounts.userId, user.id));
  await stopWatchers(accs.map((a) => a.id));
  await db.delete(users).where(eq(users.id, user.id));
  forgetSettings(user.id);
  await endSession();
  redirect("/welcome");
}
