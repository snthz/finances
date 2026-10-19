import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";

// Contexto del usuario actual, accesible de forma síncrona (appSettings(), getT(), uid()…).
// - En peticiones (páginas, Server Actions, route handlers) se guarda junto al store de la petición
//   de Next, así lo ven también los Server Components hijos. Lo fija initScope()/requireAuth().
// - En tareas de fondo (watchers IMAP, cron) se usa runInScope(), que tiene prioridad.
// Sin contexto, uid() lanza un error: ninguna consulta debe correr sin saber de qué usuario es.

export type Scope = { userId: number | null; locale: Locale };

const g = globalThis as unknown as { __financeScopeAls?: AsyncLocalStorage<Scope>; __financeScopes?: WeakMap<object, Scope> };
const als = (g.__financeScopeAls ??= new AsyncLocalStorage<Scope>());
const byRequest = (g.__financeScopes ??= new WeakMap<object, Scope>());

export function currentScope(): Scope | null {
  const own = als.getStore();
  if (own) return own;
  const request = workUnitAsyncStorage.getStore();
  return request ? (byRequest.get(request) ?? null) : null;
}

/** Fija el contexto de la petición en curso (lo llama initScope). */
export function setRequestScope(scope: Scope) {
  const request = workUnitAsyncStorage.getStore();
  if (!request) throw new Error("setRequestScope() sólo funciona dentro de una petición");
  byRequest.set(request, scope);
}

/** Ejecuta `fn` con el contexto dado (tareas de fondo o de otro usuario). */
export function runInScope<T>(scope: Scope, fn: () => Promise<T>): Promise<T> {
  return als.run(scope, fn);
}

/** Id del usuario actual. Lanza si no hay usuario: evita consultas sin filtrar. */
export function uid(): number {
  const id = currentScope()?.userId;
  if (!id) throw new Error("No hay un usuario en el contexto (falta requireAuth() o runAsUser())");
  return id;
}

export function currentUserId(): number | null {
  return currentScope()?.userId ?? null;
}

export function currentLocale(): Locale {
  return currentScope()?.locale ?? DEFAULT_LOCALE;
}
