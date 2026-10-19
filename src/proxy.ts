import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "fin_session";
const PUBLIC_PATHS = ["/welcome", "/login", "/register", "/terms", "/privacy", "/api/auth", "/api/health", "/api/sync"];

// Chequeo optimista (sólo existencia de la cookie). La verificación real de la sesión
// se hace en el servidor con requireAuth() en el layout y en cada Server Action.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  if (!request.cookies.get(SESSION_COOKIE)?.value) {
    const url = request.nextUrl.clone();
    // Sin sesión, la raíz muestra la landing; el resto pide iniciar sesión
    url.pathname = pathname === "/" ? "/welcome" : "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Recursos públicos de la PWA (manifest, service worker, iconos) quedan fuera
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|icons/|manifest.webmanifest|sw.js|offline.html).*)",
  ],
};
