import { NextResponse, type NextRequest } from "next/server";
import { authorizationUrl, CALLBACK_PATH, googleConfigured, newOAuthState, OAUTH_COOKIE, publicOrigin } from "@/lib/google-oauth";

export const dynamic = "force-dynamic";

/** Inicia el login con Google: guarda state/PKCE/nonce en una cookie y redirige a Google. */
export function GET(request: NextRequest) {
  const origin = publicOrigin(request);
  if (!googleConfigured()) return NextResponse.redirect(`${origin}/login?error=google_config`);
  const next = request.nextUrl.searchParams.get("next");
  const s = newOAuthState(next && /^\/(?![/\\])/.test(next) ? next : "/");
  const res = NextResponse.redirect(authorizationUrl(s, `${origin}${CALLBACK_PATH}`));
  res.cookies.set(OAUTH_COOKIE, JSON.stringify(s), {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https://"),
    path: "/api/auth/google",
    maxAge: 10 * 60,
  });
  return res;
}
