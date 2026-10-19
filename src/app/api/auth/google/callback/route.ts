import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { isLocale } from "@/i18n/config";
import { currentUser, LANG_COOKIE, startSession } from "@/lib/auth";
import { CALLBACK_PATH, exchangeCode, OAUTH_COOKIE, publicOrigin, type OAuthState } from "@/lib/google-oauth";
import { sessionCutoff } from "@/lib/session";
import { KEYS, setSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

function fail(origin: string, code: string) {
  const res = NextResponse.redirect(`${origin}/login?error=${code}`);
  res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth/google" });
  return res;
}

/** Vuelta de Google: valida el state, verifica el id_token y entra (o crea la cuenta). */
export async function GET(request: NextRequest) {
  const origin = publicOrigin(request);
  const params = request.nextUrl.searchParams;
  let saved: OAuthState | null = null;
  try {
    saved = JSON.parse(request.cookies.get(OAUTH_COOKIE)?.value ?? "null");
  } catch {}
  const code = params.get("code");
  if (params.get("error")) return fail(origin, "google_cancelled");
  if (!saved || !code || params.get("state") !== saved.state) return fail(origin, "google");

  let profile;
  try {
    profile = await exchangeCode(code, saved, `${origin}${CALLBACK_PATH}`);
  } catch (err) {
    console.error("[google-oauth]", err instanceof Error ? err.message : err);
    return fail(origin, "google");
  }
  if (!profile.emailVerified) return fail(origin, "google_unverified");

  // 1) Ya vinculada con Google  2) Sesión iniciada sin Google: se vincula a esa cuenta (Ajustes → Cuenta)
  // 3) Misma dirección verificada en una cuenta sólo-Google  4) Cuenta nueva
  let user = await db.query.users.findFirst({ where: eq(users.googleId, profile.sub) });
  const current = user ? null : await currentUser();
  if (!user && current && !current.googleId) {
    [user] = await db.update(users).set({ googleId: profile.sub }).where(eq(users.id, current.id)).returning();
  }
  // Al vincular una cuenta con contraseña se avisa en Ajustes → Cuenta
  let passwordRemoved = false;
  if (!user) {
    const byEmail = await db.query.users.findFirst({ where: eq(users.email, profile.email) });
    if (byEmail?.googleId) return fail(origin, "google_exists"); // ya vinculada a otra cuenta de Google
    if (byEmail) {
      // Google confirmó que el email es de esta persona, así que se vincula. El registro con contraseña no
      // verifica el email: esa contraseña (y sus sesiones) pudo crearlas otra persona, por eso se quitan.
      passwordRemoved = Boolean(byEmail.passwordHash);
      [user] = await db
        .update(users)
        .set({ googleId: profile.sub, passwordHash: null, sessionsValidAfter: sessionCutoff() })
        .where(eq(users.id, byEmail.id))
        .returning();
    } else {
      [user] = await db
        .insert(users)
        .values({ name: profile.name.slice(0, 80), email: profile.email, googleId: profile.sub, passwordHash: null })
        .returning();
      const lang = request.cookies.get(LANG_COOKIE)?.value;
      await setSetting(KEYS.language, isLocale(lang) ? lang : "en", user.id);
    }
  }

  await startSession(user.id);
  const next = !user.onboardedAt ? "/onboarding" : passwordRemoved ? "/settings?tab=cuenta&linked=google" : saved.next;
  const res = NextResponse.redirect(`${origin}${next}`);
  res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth/google" });
  return res;
}
