import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DB = ReturnType<typeof drizzle<typeof schema>>;

// Reutiliza la conexión entre recargas en desarrollo y entre bundles del mismo proceso.
// Drizzle se crea por cada versión del esquema: tras agregar una columna en desarrollo,
// la instancia vieja no la leería.
const g = globalThis as unknown as { __financeSql?: postgres.Sql; __financeDbs?: WeakMap<object, DB> };

/**
 * Algunos paneles (o URLs copiadas de Prisma) agregan `?schema=public`. postgres.js enviaría `schema`
 * como parámetro de conexión y Postgres lo rechaza ("unrecognized configuration parameter"):
 * se quita de la URL. La app siempre usa el esquema public (ver connection()).
 */
export function parseDatabaseUrl(raw: string) {
  try {
    const url = new URL(raw);
    const schemaParam = url.searchParams.get("schema");
    if (!schemaParam) return { url: raw, searchPath: undefined };
    url.searchParams.delete("schema");
    return { url: url.toString(), searchPath: schemaParam };
  } catch {
    return { url: raw, searchPath: undefined };
  }
}

/**
 * Crea la base de datos de DATABASE_URL si no existe (error 3D000), conectándose a la base
 * de mantenimiento del servidor. Requiere que el usuario pueda crear bases (en Dokploy lo es).
 */
export async function createDatabaseIfMissing(): Promise<{ ok: boolean; name: string; message?: string }> {
  const { url } = parseDatabaseUrl(process.env.DATABASE_URL ?? "");
  const target = new URL(url);
  const name = decodeURIComponent(target.pathname.slice(1));
  if (!name) return { ok: false, name, message: "la URL no incluye el nombre de la base de datos" };
  let lastError = "";
  for (const maintenance of ["postgres", "template1"]) {
    const admin = new URL(url);
    admin.pathname = `/${maintenance}`;
    const sql = postgres(admin.toString(), { max: 1, onnotice: () => {} });
    try {
      await sql.unsafe(`CREATE DATABASE "${name.replace(/"/g, '""')}"`);
      return { ok: true, name };
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "42P04") return { ok: true, name }; // ya existe (otra réplica la creó)
      lastError = (err as Error).message;
      if (code !== "3D000") break; // sólo se prueba template1 si "postgres" no existe
    } finally {
      await sql.end({ timeout: 2 });
    }
  }
  return { ok: false, name, message: lastError };
}

function connection() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL no está configurada");
  const { url, searchPath } = parseDatabaseUrl(raw);
  if (!g.__financeSql && searchPath && searchPath !== "public") {
    // Las migraciones de drizzle-kit apuntan a "public"."tabla" (FKs y enums): otro esquema las rompería.
    console.warn(`[db] se ignora ?schema=${searchPath} en DATABASE_URL: la app usa el esquema public de su propia base de datos.`);
  }
  return (g.__financeSql ??= postgres(url, { max: 10, idle_timeout: 30, onnotice: () => {} }));
}

function instance() {
  const map = (g.__financeDbs ??= new WeakMap());
  let db = map.get(schema);
  if (!db) {
    db = drizzle(connection(), { schema });
    map.set(schema, db);
  }
  return db;
}

// Lazy para que `next build` no necesite la base de datos
export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const inst = instance();
    const value = Reflect.get(inst, prop);
    return typeof value === "function" ? value.bind(inst) : value;
  },
});

export function sqlClient() {
  return connection();
}

export { schema };
