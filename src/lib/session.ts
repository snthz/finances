import "server-only";
import { jwtVerify, SignJWT } from "jose";
import { getSecret } from "./settings";

export const SESSION_COOKIE = "fin_session";
export const SESSION_DAYS = 30;

async function secretKey() {
  return new TextEncoder().encode(await getSecret());
}

export async function createSessionToken(userId: number) {
  return new SignJWT({})
    .setSubject(String(userId))
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(await secretKey());
}

/** Devuelve el id de usuario y la fecha de emisión si el token es válido. */
export async function verifySessionToken(token: string | undefined): Promise<{ userId: number; issuedAt: Date } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await secretKey(), { algorithms: ["HS256"] });
    const id = Number(payload.sub);
    if (!Number.isInteger(id) || id <= 0 || !payload.iat) return null;
    return { userId: id, issuedAt: new Date(payload.iat * 1000) };
  } catch {
    return null;
  }
}

/** Instante desde el que valen las sesiones nuevas (redondeado al segundo, como el `iat` del token). */
export function sessionCutoff() {
  return new Date(Math.floor(Date.now() / 1000) * 1000);
}
