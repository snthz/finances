import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

// Inicio de sesión con Google (OpenID Connect, flujo "authorization code" con PKCE).
// Variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y, opcional, APP_URL (si no, se usa el host de la petición).
// URI de redirección a registrar en Google Cloud: <APP_URL>/api/auth/google/callback

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export const OAUTH_COOKIE = "fin_oauth";
export const CALLBACK_PATH = "/api/auth/google/callback";

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** Origen público de la app (detrás de un proxy como Traefik/Dokploy se usan los encabezados X-Forwarded-*). */
export function publicOrigin(request: Request) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  const h = request.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? new URL(request.url).host;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`;
}

const b64url = (buf: Buffer) => buf.toString("base64url");

/** Datos temporales del flujo (se guardan en una cookie httpOnly de 10 minutos). */
export type OAuthState = { state: string; verifier: string; nonce: string; next: string };

export function newOAuthState(next = "/"): OAuthState {
  return { state: b64url(randomBytes(24)), verifier: b64url(randomBytes(48)), nonce: b64url(randomBytes(24)), next };
}

export function authorizationUrl(s: OAuthState, redirectUri: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: s.state,
    nonce: s.nonce,
    code_challenge: b64url(createHash("sha256").update(s.verifier).digest()),
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `${AUTH_URL}?${params}`;
}

export type GoogleProfile = { sub: string; email: string; emailVerified: boolean; name: string; picture: string | null };

/** Canjea el código por tokens y verifica el id_token (firma, emisor, audiencia y nonce). */
export async function exchangeCode(code: string, s: OAuthState, redirectUri: string): Promise<GoogleProfile> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: s.verifier,
    }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  const json = (await res.json()) as { id_token?: string; error?: string; error_description?: string };
  if (!res.ok || !json.id_token) throw new Error(`token: ${json.error ?? res.status} ${json.error_description ?? ""}`.trim());

  const { payload } = await jwtVerify(json.id_token, JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  if (payload.nonce !== s.nonce) throw new Error("nonce inválido");
  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
  if (!payload.sub || !email) throw new Error("id_token sin sub/email");
  return {
    sub: payload.sub,
    email,
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : email.split("@")[0],
    picture: typeof payload.picture === "string" ? payload.picture : null,
  };
}
