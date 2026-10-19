import "server-only";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";
import { setRequestScope } from "./context";
import { loadSettings } from "./settings";
import { createSessionToken, SESSION_COOKIE, SESSION_DAYS, verifySessionToken } from "./session";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

/** Idioma elegido por el visitante (landing, login, registro). Los usuarios usan el de sus ajustes. */
export const LANG_COOKIE = "fin_lang";

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt:${salt.toString("base64")}:${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null) {
  const [algo, salt, hash] = (stored ?? "").split(":");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scrypt(password, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

export async function startSession(userId: number) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Guarda el idioma en una cookie (dura un año) para las páginas públicas. */
export async function setLangCookie(locale: Locale) {
  const store = await cookies();
  store.set(LANG_COOKIE, locale, { sameSite: "lax", path: "/", maxAge: 365 * 24 * 60 * 60 });
}

export async function currentUser() {
  const store = await cookies();
  const session = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  // Sesiones revocadas (ej. al vincular la cuenta con Google)
  if (!user || (user.sessionsValidAfter && session.issuedAt < user.sessionsValidAfter)) return null;
  return user;
}

/**
 * Resuelve el usuario de la sesión (si hay) y fija el contexto de la petición: ajustes, idioma
 * y uid(). Para visitantes, el idioma sale de la cookie (inglés por defecto).
 * Memoizado por petición en Server Components; en Server Actions se ejecuta en cada llamada.
 */
export const initScope = cache(async () => {
  const user = await currentUser();
  if (user) {
    const s = await loadSettings(user.id);
    setRequestScope({ userId: user.id, locale: s.locale });
    return user;
  }
  const lang = (await cookies()).get(LANG_COOKIE)?.value;
  setRequestScope({ userId: null, locale: isLocale(lang) ? lang : DEFAULT_LOCALE });
  return null;
});

/**
 * Llamar al inicio de cada página protegida, Server Action y route handler privado.
 * Si el usuario aún no completó la configuración inicial, lo manda a /onboarding.
 */
export async function requireAuth({ onboarding = false }: { onboarding?: boolean } = {}) {
  const user = await initScope();
  if (!user) redirect("/login");
  if (!onboarding && !user.onboardedAt) redirect("/onboarding");
  return user;
}
